import type {
  CustomDomain,
  DnsRecord,
  DomainResult,
  DomainSource,
} from "@/lib/domains/types";

// In-memory custom domains for the docs previews. They answer like a backend
// would, with a short delay, but nothing touches DNS. Each check finds one
// more record, so a new domain becomes active after a few checks.

const LATENCY_MS = 300;
const DAY_MS = 24 * 60 * 60 * 1000;
const TARGET = "customers.acme-app.com";

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
}

function ok<T>(data: T): DomainResult<T> {
  return { data, ok: true };
}

function fail<T>(error: string): DomainResult<T> {
  return { error, ok: false };
}

/** A made-up token, the same for a hostname every time. */
function token(hostname: string): string {
  let hash = 0;
  for (const char of hostname) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 2_147_483_647;
  }
  return `acme-verify-${hash.toString(36)}${(hash * 7).toString(36)}`;
}

/** The records a domain needs: a CNAME, or an A record for a root domain. */
function recordsFor(hostname: string): DnsRecord[] {
  const isRoot = hostname.split(".").length === 2;
  return [
    {
      name: `_acme-challenge.${hostname}`,
      note: "You can remove it once the domain is active.",
      purpose: "ownership",
      status: "pending",
      type: "TXT",
      value: token(hostname),
    },
    isRoot
      ? {
          name: hostname,
          purpose: "routing",
          status: "pending",
          type: "A",
          value: "203.0.113.10",
        }
      : {
          name: hostname,
          purpose: "routing",
          status: "pending",
          type: "CNAME",
          value: TARGET,
        },
  ];
}

function makeDomains(now: number): CustomDomain[] {
  return [
    {
      certificate: "active",
      checkedAt: new Date(now - 2 * 60 * 1000).toISOString(),
      createdAt: new Date(now - 30 * DAY_MS).toISOString(),
      hostname: "shop.northwind.dev",
      id: "dom_shop",
      primary: true,
      records: recordsFor("shop.northwind.dev").map((record) => ({
        ...record,
        status: "found",
      })),
      status: "active",
    },
    {
      certificate: "pending",
      checkedAt: new Date(now - 5 * 60 * 1000).toISOString(),
      createdAt: new Date(now - DAY_MS).toISOString(),
      hostname: "help.northwind.dev",
      id: "dom_help",
      records: recordsFor("help.northwind.dev").map((record, index) => ({
        ...record,
        status: index === 0 ? "found" : "pending",
      })),
      status: "pending",
      statusMessage: "The CNAME record wasn't found yet.",
    },
  ];
}

/** Finds one more record, and activates the domain once all are found. */
function advance(domain: CustomDomain): CustomDomain {
  const index = domain.records.findIndex(
    (record) => record.status === "pending"
  );
  const records = domain.records.map((record, position) =>
    position === index ? { ...record, status: "found" as const } : record
  );
  const done = records.every((record) => record.status === "found");
  return {
    ...domain,
    certificate: done ? "active" : domain.certificate,
    checkedAt: new Date().toISOString(),
    records,
    status: done ? "active" : "pending",
    statusMessage: done
      ? null
      : `The ${records.find((record) => record.status === "pending")?.type} record wasn't found yet.`,
  };
}

/** The pending domain the setup preview shows, as a fresh source has it. */
export function demoPendingDomain(): CustomDomain {
  return makeDomains(Date.now())[1] as CustomDomain;
}

/** A fresh set of in-memory domains, with the same calls as a real backend. */
export function createDemoDomains(): DomainSource {
  let domains = makeDomains(Date.now());
  let added = 0;

  const find = (id: string) => domains.find((domain) => domain.id === id);

  return {
    async addDomain(hostname) {
      await wait();
      // A real backend also refuses your own domain and public suffixes.
      if (domains.some((item) => item.hostname === hostname)) {
        return fail(`${hostname} is already connected.`);
      }
      added += 1;
      const domain: CustomDomain = {
        certificate: "pending",
        createdAt: new Date().toISOString(),
        hostname,
        id: `dom_new_${added}`,
        records: recordsFor(hostname),
        status: "pending",
        statusMessage: "The TXT record wasn't found yet.",
      };
      domains = [...domains, domain];
      return ok(domain);
    },

    async checkDomain(id) {
      await wait();
      const domain = find(id);
      if (!domain) {
        return fail("That domain doesn't exist.");
      }
      const checked = domain.status === "pending" ? advance(domain) : domain;
      domains = domains.map((item) => (item.id === id ? checked : item));
      return ok(checked);
    },

    async listDomains() {
      await wait();
      return ok(domains.map((domain) => ({ ...domain })));
    },

    async removeDomain(id) {
      await wait();
      domains = domains.filter((domain) => domain.id !== id);
      return ok(null);
    },

    async setPrimaryDomain(id) {
      await wait();
      if (find(id)?.status !== "active") {
        return fail("Only an active domain can be primary.");
      }
      domains = domains.map((domain) => ({
        ...domain,
        primary: domain.id === id,
      }));
      return ok(domains.map((domain) => ({ ...domain })));
    },
  };
}
