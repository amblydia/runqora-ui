// Shared by the custom domain components. They let your customers connect
// their own domains to your app, but they don't talk to DNS or issue
// certificates: every call goes through a `DomainSource` that you write for
// your backend, such as Cloudflare for SaaS, Vercel, or your own proxy.
//
// Your backend decides which DNS records a domain needs, and the components
// show them. That keeps them the same whatever serves the domain.

/** Whether a domain is serving your app yet. */
export type DomainStatus = "active" | "failed" | "pending";

/**
 * What a DNS record is for: sending the domain's traffic to you, proving
 * the customer owns it, or letting a certificate be issued for it.
 */
export type DnsRecordPurpose = "certificate" | "ownership" | "routing";

/** One DNS record the customer adds, or removes, at their DNS provider. */
export interface DnsRecord {
  /**
   * "remove" for a record that gets in the way, such as an old A record left
   * on the domain. Adding is the default.
   */
  action?: "add" | "remove";
  /**
   * The name as your backend gives it: in full, such as
   * "_cf-custom-hostname.shop.example.com", or relative to the domain, such
   * as "_vercel" or "@".
   */
  name: string;
  /** Shown under the record, such as "You can remove it once the domain is active." */
  note?: string | null;
  purpose: DnsRecordPurpose;
  /**
   * Whether your backend found the record. Leave it out when it can't tell
   * records apart and only knows the domain's status.
   */
  status?: "found" | "pending";
  /** Such as "CNAME", "TXT" or "A". */
  type: string;
  /** Such as "customers.example-saas.com". */
  value: string;
}

/** A domain a customer connected, with what it still needs. */
export interface CustomDomain {
  /** Whether its certificate is issued, when your backend tracks it separately. */
  certificate?: "active" | "failed" | "pending" | null;
  /** ISO 8601 date of the last check, if known. */
  checkedAt?: string | null;
  /** ISO 8601 date. */
  createdAt: string;
  /**
   * Such as "shop.example.com". Store it as `readHostname` returns it, in
   * ASCII, so it can't hold characters that make it read as another name.
   */
  hostname: string;
  id: string;
  /** The domain the app redirects the others to, if you support one. */
  primary?: boolean;
  /** The records to add. Usually empty once the domain is active. */
  records: DnsRecord[];
  status: DomainStatus;
  /** Why it isn't active, such as "The CNAME record points somewhere else." */
  statusMessage?: string | null;
}

/**
 * What a domain call returns. Errors are values rather than exceptions so
 * their message reaches the browser: Next.js hides the message of an error
 * thrown by a server action in production. The error is shown as it is.
 */
export type DomainResult<T> =
  | { data: T; ok: true }
  | { error: string; ok: false };

/**
 * The calls the custom domain components make. Write it for your backend.
 * Only `listDomains` is required, and the components hide what depends on
 * a call you leave out.
 *
 * Every call is made on behalf of the person using the screen, so your
 * backend must check who they are and only let them see and change their own
 * domains, whatever ids the browser sends.
 */
export interface DomainSource {
  /**
   * Connects a domain. The hostname is checked in the browser, but your
   * backend must check it again and refuse ones it can't serve.
   */
  addDomain?: (hostname: string) => Promise<DomainResult<CustomDomain>>;
  /**
   * Checks the domain's DNS again and returns its new state. `manual` is true
   * when someone chose Check now, and false for the checks made on their own,
   * so slower or costlier refreshes can be kept to manual ones.
   */
  checkDomain?: (
    id: string,
    options: { manual: boolean }
  ) => Promise<DomainResult<CustomDomain>>;
  /** Lists every domain the person may see. */
  listDomains: () => Promise<DomainResult<CustomDomain[]>>;
  /** Disconnects a domain. */
  removeDomain?: (id: string) => Promise<DomainResult<null>>;
  /** Makes a domain the primary one, and returns every domain after the change. */
  setPrimaryDomain?: (id: string) => Promise<DomainResult<CustomDomain[]>>;
}

const MAX_HOSTNAME_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;
const LABEL = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u;
const WHITESPACE = /\s/u;
const TRAILING_DOT = /\.$/u;
const IPV4 = /^\d+(?:\.\d+){3}$/u;

/**
 * Reads what someone typed as a hostname: a URL such as
 * "https://Shop.Example.com/path" becomes "shop.example.com", and
 * international names are encoded, as browsers send them. Returns an error
 * to show when it isn't a hostname that can have DNS records. Your backend
 * must check it again.
 */
export function readHostname(
  value: string
): { error: string } | { hostname: string } {
  const trimmed = value.trim();
  // URLs silently drop tabs and line breaks, which would join pasted cells.
  if (!trimmed || WHITESPACE.test(trimmed)) {
    return { error: "Enter a domain, such as shop.example.com." };
  }
  let hostname: string;
  try {
    const url = new URL(
      trimmed.includes("://") ? trimmed : `https://${trimmed}`
    );
    if (url.username || url.password || url.port) {
      return { error: "Enter just the domain, such as shop.example.com." };
    }
    hostname = url.hostname.replace(TRAILING_DOT, "");
  } catch {
    return { error: "Enter a domain, such as shop.example.com." };
  }
  if (hostname.startsWith("[") || IPV4.test(hostname)) {
    return { error: "Enter a domain name, not an IP address." };
  }
  const labels = hostname.split(".");
  if (
    hostname.length > MAX_HOSTNAME_LENGTH ||
    labels.length < 2 ||
    labels.some(
      (label) => label.length > MAX_LABEL_LENGTH || !LABEL.test(label)
    )
  ) {
    return { error: "That isn't a domain that can be connected." };
  }
  return { hostname };
}
