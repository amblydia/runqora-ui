// Shared by the webhook components. They manage the endpoints your app sends
// webhooks to and show what was sent, but they don't send anything: every call
// goes through a `WebhookSource` that you write for your backend, whether
// that's your own code or a service such as Svix.
//
// A delivery is one event sent to one endpoint. It can take several attempts:
// failed ones are retried, and people can resend it.

/** An event your app sends, as the endpoint form offers it. */
export interface WebhookEventType {
  /** Shown under the name in the endpoint form. */
  description?: string;
  /** Such as "Invoice paid". */
  label: string;
  /** Such as "invoice.paid". */
  value: string;
}

/** A URL that receives webhooks. */
export interface WebhookEndpoint {
  /** ISO 8601 date. */
  createdAt: string;
  description: string | null;
  /** Why it was turned off, such as "Failed for 5 days in a row". */
  disabledReason?: string | null;
  enabled: boolean;
  /** The events it receives. Empty means every event. */
  eventTypes: string[];
  id: string;
  url: string;
}

/** What a new endpoint, or a change to one, is made of. */
export interface WebhookEndpointInput {
  description: string | null;
  /** Empty means every event. */
  eventTypes: string[];
  url: string;
}

/** Whether a delivery has been accepted by the endpoint. */
export type WebhookDeliveryStatus = "failed" | "pending" | "succeeded";

/** One event sent to one endpoint. */
export interface WebhookDelivery {
  /** How many attempts have been made. */
  attemptCount?: number;
  /** ISO 8601 date the event was created. */
  createdAt: string;
  endpointId: string;
  /** The endpoint's URL, to show which one it went to. */
  endpointUrl?: string | null;
  /** Such as "invoice.paid". */
  eventType: string;
  id: string;
  /**
   * The id the receiver sees, such as the `webhook-id` header of Standard
   * Webhooks. It stays the same across attempts.
   */
  messageId?: string | null;
  /** ISO 8601 date of the next retry, while one is planned. */
  nextAttemptAt?: string | null;
  status: WebhookDeliveryStatus;
}

/** One try at sending a delivery, and what the endpoint answered. */
export interface WebhookAttempt {
  /** ISO 8601 date. */
  attemptedAt: string;
  durationMs?: number | null;
  /** Why no answer came, such as "Timed out after 15 seconds". */
  error?: string | null;
  id: string;
  requestHeaders?: Record<string, string>;
  /** The body the endpoint answered with, as text. It's shown as plain text. */
  responseBody?: string | null;
  responseHeaders?: Record<string, string>;
  /** The HTTP status the endpoint answered with. Null when it didn't answer. */
  statusCode: number | null;
  succeeded: boolean;
  /** "manual" for a resend, "automatic" for the first try and retries. */
  trigger?: "automatic" | "manual";
  /** The URL it was sent to, if the endpoint has changed since. */
  url?: string | null;
}

/** Everything known about one delivery, read when its details open. */
export interface WebhookDeliveryRecord extends WebhookDelivery {
  /** Newest first. */
  attempts: WebhookAttempt[];
  /** The event's body: JSON, or text shown as it is. */
  payload: unknown;
}

/** Which deliveries to show. Every field narrows the list; leave it out to match all. */
export interface WebhookDeliveryFilter {
  endpointId?: string;
  /** Only these events. */
  eventTypes?: string[];
  status?: WebhookDeliveryStatus;
}

/** One page of deliveries, newest first. */
export interface WebhookDeliveryPage {
  deliveries: WebhookDelivery[];
  /** Pass to `listDeliveries` to get the next page. Null on the last page. */
  nextCursor: string | null;
}

/** A new endpoint, with its signing secret if the backend shows it once. */
export interface CreatedWebhookEndpoint {
  endpoint: WebhookEndpoint;
  /** Shown once after creating, for the endpoint's owner to copy. */
  secret: string | null;
}

/**
 * What a webhook call returns. Errors are values rather than exceptions so
 * their message reaches the browser: Next.js hides the message of an error
 * thrown by a server action in production. The error is shown as it is.
 */
export type WebhookResult<T> =
  | { data: T; ok: true }
  | { error: string; ok: false };

/**
 * The calls the webhook components make. Write it for your backend. Each
 * component needs only some of them, and hides what depends on a call you
 * leave out, so a read-only delivery log needs only `listDeliveries`.
 *
 * Every call is made on behalf of the person using the screen, so your
 * backend must check who they are and only let them see and change their own
 * endpoints and deliveries, whatever ids the browser sends.
 */
export interface WebhookSource {
  /** Adds an endpoint. */
  createEndpoint?: (
    input: WebhookEndpointInput
  ) => Promise<WebhookResult<CreatedWebhookEndpoint>>;
  deleteEndpoint?: (id: string) => Promise<WebhookResult<null>>;
  /** Reads one delivery with its payload and attempts. */
  getDelivery?: (id: string) => Promise<WebhookResult<WebhookDeliveryRecord>>;
  /** Lists one page of the deliveries that match `filter`, newest first. */
  listDeliveries: (input: {
    cursor?: string | null;
    filter: WebhookDeliveryFilter;
  }) => Promise<WebhookResult<WebhookDeliveryPage>>;
  /** Lists every endpoint the person may see. Never include signing secrets. */
  listEndpoints: () => Promise<WebhookResult<WebhookEndpoint[]>>;
  /** Sends a delivery again, as a new attempt with the same message id. */
  resendDelivery?: (id: string) => Promise<WebhookResult<null>>;
  /** Reads an endpoint's signing secret, to show it on request. */
  revealSecret?: (endpointId: string) => Promise<WebhookResult<string>>;
  /**
   * Replaces an endpoint's signing secret. Returns the new secret to show
   * once, or null if it can only be seen through `revealSecret`.
   */
  rotateSecret?: (endpointId: string) => Promise<WebhookResult<string | null>>;
  /** Sends a sample of `eventType` to one endpoint. */
  sendTestEvent?: (input: {
    endpointId: string;
    eventType: string;
  }) => Promise<WebhookResult<null>>;
  /** Changes an endpoint. Only the fields given change. */
  updateEndpoint?: (
    id: string,
    changes: Partial<WebhookEndpointInput> & { enabled?: boolean }
  ) => Promise<WebhookResult<WebhookEndpoint>>;
}

/** A name for an event, such as "Invoice paid", or its code if it has none. */
export function getEventLabel(
  eventTypes: WebhookEventType[],
  value: string
): string {
  return (
    eventTypes.find((eventType) => eventType.value === value)?.label ?? value
  );
}

/**
 * Characters that are invisible or change how the text around them reads,
 * such as control characters, zero-width characters and bidirectional
 * overrides. Text from a customer or from their endpoint could use them to
 * read differently from what it is.
 */
const HIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
/** Characters that look blank but are letters or marks, such as Hangul fillers. */
const BLANK_CODES = new Set([0x03_4f, 0x11_5f, 0x11_60, 0x31_64, 0xff_a0]);
const LAYOUT_CHARACTERS = new Set(["\t", "\n", "\r"]);

/**
 * The text with its hidden characters written out as `\u` escapes, so it
 * shows exactly what it contains. Tabs and line breaks are kept.
 */
export function showHidden(text: string): string {
  let result = "";
  for (const char of text) {
    const point = char.codePointAt(0) ?? 0;
    if (
      (HIDDEN.test(char) && !LAYOUT_CHARACTERS.has(char)) ||
      BLANK_CODES.has(point)
    ) {
      const code = point.toString(16);
      result +=
        code.length > 4 ? `\\u{${code}}` : `\\u${code.padStart(4, "0")}`;
    } else {
      result += char;
    }
  }
  return result;
}
