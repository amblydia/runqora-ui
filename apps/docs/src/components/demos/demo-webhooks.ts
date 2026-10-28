import type {
  WebhookAttempt,
  WebhookDelivery,
  WebhookDeliveryRecord,
  WebhookEndpoint,
  WebhookEventType,
  WebhookResult,
  WebhookSource,
} from "@/lib/webhooks/types";

// In-memory webhooks for the docs previews. They answer like a backend would,
// with a short delay, but nothing is sent anywhere. The deliveries are made
// up and spread over the last few days so the dates stay recent.

const LATENCY_MS = 300;
const PAGE_SIZE = 15;
const DELIVERY_COUNT = 48;
const MINUTE_MS = 60 * 1000;
const SECRET_BYTES = 24;

export const DEMO_EVENT_TYPES: WebhookEventType[] = [
  {
    description: "A customer paid an invoice.",
    label: "Invoice paid",
    value: "invoice.paid",
  },
  {
    description: "A payment attempt was declined.",
    label: "Invoice payment failed",
    value: "invoice.payment_failed",
  },
  { label: "Customer created", value: "customer.created" },
  { label: "Customer updated", value: "customer.updated" },
  { label: "Subscription started", value: "subscription.created" },
  { label: "Subscription canceled", value: "subscription.canceled" },
];

/** The delivery the details preview opens: one that failed several times. */
export const DEMO_FAILED_DELIVERY_ID = "dlv_0005";

function wait(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, LATENCY_MS));
}

function ok<T>(data: T): WebhookResult<T> {
  return { data, ok: true };
}

function fail<T>(error: string): WebhookResult<T> {
  return { error, ok: false };
}

/** Picks from a list by number, so every page view gets the same deliveries. */
function pick<T>(list: T[], seed: number): T {
  return list[seed % list.length] as T;
}

function makeSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SECRET_BYTES));
  return `whsec_${btoa(String.fromCharCode(...bytes))}`;
}

function makeEndpoints(now: number): WebhookEndpoint[] {
  return [
    {
      createdAt: new Date(now - 40 * 24 * 60 * MINUTE_MS).toISOString(),
      description: "Billing sync",
      enabled: true,
      eventTypes: [
        "invoice.paid",
        "invoice.payment_failed",
        "subscription.created",
        "subscription.canceled",
      ],
      id: "ep_billing",
      url: "https://api.northwind.dev/webhooks/acme",
    },
    {
      createdAt: new Date(now - 12 * 24 * 60 * MINUTE_MS).toISOString(),
      description: "CRM",
      enabled: true,
      eventTypes: [],
      id: "ep_crm",
      url: "https://hooks.crm.example.com/in/8f2c41",
    },
    {
      createdAt: new Date(now - 90 * 24 * 60 * MINUTE_MS).toISOString(),
      description: "Old server",
      disabledReason: "Turned off after failing for 5 days in a row.",
      enabled: false,
      eventTypes: ["customer.created"],
      id: "ep_legacy",
      url: "https://legacy.northwind.dev/hooks",
    },
  ];
}

function makePayload(eventType: string, index: number, createdAt: string) {
  const customer = `cus_${(4100 + index * 7).toString(36)}`;
  if (eventType.startsWith("invoice.")) {
    return {
      data: {
        amount: 1900 + (index % 5) * 1000,
        currency: "usd",
        customer,
        id: `in_${(9000 + index * 13).toString(36)}`,
      },
      timestamp: createdAt,
      type: eventType,
    };
  }
  if (eventType.startsWith("subscription.")) {
    return {
      data: { customer, id: `sub_${(7000 + index).toString(36)}`, plan: "pro" },
      timestamp: createdAt,
      type: eventType,
    };
  }
  return {
    data: { email: `customer${index}@example.com`, id: customer },
    timestamp: createdAt,
    type: eventType,
  };
}

function requestHeaders(messageId: string, time: number) {
  return {
    "content-type": "application/json",
    "user-agent": "Acme-Webhooks/1.0",
    "webhook-id": messageId,
    "webhook-signature": "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
    "webhook-timestamp": String(Math.floor(time / 1000)),
  };
}

type Answer = Pick<
  WebhookAttempt,
  "error" | "responseBody" | "responseHeaders" | "statusCode"
>;

const SUCCESS = {
  responseBody: '{"received":true}',
  responseHeaders: { "content-type": "application/json" },
  statusCode: 200,
};

const FAILURES: Answer[] = [
  {
    responseBody:
      "<html><body><h1>502 Bad Gateway</h1><p>nginx</p></body></html>",
    responseHeaders: { "content-type": "text/html" },
    statusCode: 502,
  },
  {
    error: "Timed out after 15 seconds.",
    statusCode: null,
  },
  {
    responseBody: '{"error":"internal_error","message":"Lookup failed"}',
    responseHeaders: { "content-type": "application/json" },
    statusCode: 500,
  },
];

/** Minutes after an event that each retry happens. */
const RETRY_MINUTES = [0, 1, 6, 36, 156];

interface DemoDelivery extends WebhookDeliveryRecord {
  /** Kept so `listDeliveries` can show it without loading the attempts. */
  endpointUrl: string;
}

function makeAttempts(
  outcome: "failed" | "retrying" | "succeeded",
  index: number,
  messageId: string,
  created: number
): WebhookAttempt[] {
  const count = outcome === "succeeded" ? 1 + (index % 4 === 0 ? 1 : 0) : 4;
  const attempts: WebhookAttempt[] = [];
  for (let attempt = 0; attempt < count; attempt += 1) {
    const time = created + (RETRY_MINUTES[attempt] ?? 0) * MINUTE_MS + 400;
    const last = attempt === count - 1;
    const result: Answer =
      outcome === "succeeded" && last
        ? SUCCESS
        : pick(FAILURES, index + attempt);
    attempts.push({
      attemptedAt: new Date(time).toISOString(),
      durationMs:
        result.statusCode === null
          ? 15_000
          : 80 + ((index * 37 + attempt * 11) % 400),
      error: null,
      id: `att_${index}_${attempt}`,
      requestHeaders: requestHeaders(messageId, time),
      responseBody: null,
      responseHeaders: {},
      succeeded: result.statusCode === 200,
      trigger: "automatic",
      ...result,
    });
  }
  return attempts.reverse();
}

function makeDelivery(
  index: number,
  now: number,
  endpoints: WebhookEndpoint[]
): DemoDelivery {
  // Most go to the billing endpoint and the CRM, a few to the old server.
  const endpoint =
    index % 13 === 12
      ? (endpoints[2] as WebhookEndpoint)
      : pick(endpoints.slice(0, 2), index * 3 + 1);
  const choices =
    endpoint.eventTypes.length > 0
      ? endpoint.eventTypes
      : DEMO_EVENT_TYPES.map((type) => type.value);
  const eventType = pick(choices, index * 5 + 2);
  const created = now - index * 83 * MINUTE_MS - (index % 7) * MINUTE_MS;
  const createdAt = new Date(created).toISOString();
  const messageId = `msg_${(31_000_000 + index * 7919).toString(36)}`;

  let outcome: "failed" | "retrying" | "succeeded" = "succeeded";
  if (endpoint.id === "ep_legacy" || index % 9 === 5) {
    outcome = "failed";
  } else if (endpoint.id === "ep_crm" && index % 6 === 1) {
    outcome = "retrying";
  }
  const attempts = makeAttempts(outcome, index, messageId, created);

  return {
    attemptCount: attempts.length,
    attempts,
    createdAt,
    endpointId: endpoint.id,
    endpointUrl: endpoint.url,
    eventType,
    id: `dlv_${String(index).padStart(4, "0")}`,
    messageId,
    nextAttemptAt:
      outcome === "retrying"
        ? new Date(now + (20 + (index % 40)) * MINUTE_MS).toISOString()
        : null,
    payload: makePayload(eventType, index, createdAt),
    status: outcome === "retrying" ? "pending" : outcome,
  };
}

function summary(delivery: DemoDelivery): WebhookDelivery {
  const { attempts: _attempts, payload: _payload, ...rest } = delivery;
  return rest;
}

/** A fresh set of in-memory webhooks, with the same calls as a real backend. */
export function createDemoWebhooks(): WebhookSource {
  const now = Date.now();
  let endpoints = makeEndpoints(now);
  const secrets = new Map(
    endpoints.map((endpoint) => [endpoint.id, makeSecret()])
  );
  const deliveries: DemoDelivery[] = Array.from(
    { length: DELIVERY_COUNT },
    (_, index) => makeDelivery(index, now, endpoints)
  );
  let created = 0;

  const findEndpoint = (id: string) =>
    endpoints.find((endpoint) => endpoint.id === id);

  return {
    async createEndpoint(input) {
      await wait();
      // A real backend checks the URL too, and refuses private addresses.
      if (!input.url.startsWith("https://")) {
        return fail("Use an https:// URL.");
      }
      created += 1;
      const endpoint: WebhookEndpoint = {
        createdAt: new Date().toISOString(),
        description: input.description,
        enabled: true,
        eventTypes: input.eventTypes,
        id: `ep_new_${created}`,
        url: input.url,
      };
      const secret = makeSecret();
      endpoints = [...endpoints, endpoint];
      secrets.set(endpoint.id, secret);
      return ok({ endpoint, secret });
    },

    async deleteEndpoint(id) {
      await wait();
      endpoints = endpoints.filter((endpoint) => endpoint.id !== id);
      return ok(null);
    },

    async getDelivery(id) {
      await wait();
      const delivery = deliveries.find((item) => item.id === id);
      return delivery
        ? ok(structuredClone(delivery))
        : fail("That delivery doesn't exist.");
    },

    async listDeliveries({ cursor, filter }) {
      await wait();
      const matching = deliveries.filter(
        (delivery) =>
          (!filter.endpointId || delivery.endpointId === filter.endpointId) &&
          (!filter.status || delivery.status === filter.status) &&
          (!filter.eventTypes ||
            filter.eventTypes.length === 0 ||
            filter.eventTypes.includes(delivery.eventType))
      );
      const start = cursor ? Number(cursor) : 0;
      const end = start + PAGE_SIZE;
      return ok({
        deliveries: matching.slice(start, end).map(summary),
        nextCursor: end < matching.length ? String(end) : null,
      });
    },

    async listEndpoints() {
      await wait();
      return ok(endpoints.map((endpoint) => ({ ...endpoint })));
    },

    async resendDelivery(id) {
      await wait();
      const delivery = deliveries.find((item) => item.id === id);
      if (!delivery) {
        return fail("That delivery doesn't exist.");
      }
      if (!findEndpoint(delivery.endpointId)?.enabled) {
        return fail("Turn the endpoint on to resend to it.");
      }
      const time = Date.now();
      delivery.attempts.unshift({
        attemptedAt: new Date(time).toISOString(),
        durationMs: 142,
        id: `att_resend_${time}`,
        requestHeaders: requestHeaders(delivery.messageId ?? "", time),
        trigger: "manual",
        ...SUCCESS,
        succeeded: true,
      });
      delivery.attemptCount = delivery.attempts.length;
      delivery.status = "succeeded";
      delivery.nextAttemptAt = null;
      return ok(null);
    },

    async revealSecret(endpointId) {
      await wait();
      const secret = secrets.get(endpointId);
      return secret ? ok(secret) : fail("That endpoint doesn't exist.");
    },

    async rotateSecret(endpointId) {
      await wait();
      if (!findEndpoint(endpointId)) {
        return fail("That endpoint doesn't exist.");
      }
      const secret = makeSecret();
      secrets.set(endpointId, secret);
      return ok(secret);
    },

    async sendTestEvent({ endpointId, eventType }) {
      await wait();
      const endpoint = findEndpoint(endpointId);
      if (!endpoint) {
        return fail("That endpoint doesn't exist.");
      }
      if (!endpoint.enabled) {
        return fail("Turn the endpoint on to send it a test event.");
      }
      const index = deliveries.length;
      const time = Date.now();
      const createdAt = new Date(time).toISOString();
      const messageId = `msg_test_${time.toString(36)}`;
      deliveries.unshift({
        attemptCount: 1,
        attempts: [
          {
            attemptedAt: createdAt,
            durationMs: 120,
            id: `att_test_${time}`,
            requestHeaders: requestHeaders(messageId, time),
            trigger: "manual",
            ...SUCCESS,
            succeeded: true,
          },
        ],
        createdAt,
        endpointId,
        endpointUrl: endpoint.url,
        eventType,
        id: `dlv_test_${time}`,
        messageId,
        nextAttemptAt: null,
        payload: makePayload(eventType, index, createdAt),
        status: "succeeded",
      });
      return ok(null);
    },

    async updateEndpoint(id, changes) {
      await wait();
      const endpoint = findEndpoint(id);
      if (!endpoint) {
        return fail("That endpoint doesn't exist.");
      }
      if (changes.url !== undefined && !changes.url.startsWith("https://")) {
        return fail("Use an https:// URL.");
      }
      const updated: WebhookEndpoint = {
        ...endpoint,
        ...changes,
        disabledReason:
          changes.enabled === true ? null : endpoint.disabledReason,
      };
      endpoints = endpoints.map((item) => (item.id === id ? updated : item));
      return ok({ ...updated });
    },
  };
}
