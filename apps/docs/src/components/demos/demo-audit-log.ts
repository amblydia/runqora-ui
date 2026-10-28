import type {
  AuditActionOption,
  AuditActor,
  AuditEvent,
  AuditLogFilter,
  AuditLogSource,
  AuditResult,
  AuditTarget,
} from "@/lib/audit/types";

// An in-memory audit log for the docs previews. It answers like the server
// actions would, with a short delay. The events are made up, and spread over
// the last few weeks so the dates stay recent.

const LATENCY_MS = 300;
const PAGE_SIZE = 20;
const EVENT_COUNT = 64;
const HOUR_MS = 60 * 60 * 1000;

export const DEMO_ACTIONS: AuditActionOption[] = [
  { label: "Signed in", value: "user.signed_in" },
  { label: "Invited a member", value: "member.invited" },
  { label: "Changed a member's role", value: "member.role_changed" },
  { label: "Removed a member", value: "member.removed" },
  { label: "Created a project", value: "project.created" },
  { label: "Renamed a project", value: "project.renamed" },
  { label: "Deleted a project", value: "project.deleted" },
  { label: "Created an API key", value: "api_key.created" },
  { label: "Revoked an API key", value: "api_key.revoked" },
  { label: "Changed the plan", value: "billing.plan_changed" },
];

const PEOPLE: AuditActor[] = [
  { email: "ada@acme.dev", id: "usr_ada", name: "Ada Lovelace", type: "user" },
  {
    email: "grace@acme.dev",
    id: "usr_grace",
    name: "Grace Hopper",
    type: "user",
  },
  { email: "alan@acme.dev", id: "usr_alan", name: "Alan Turing", type: "user" },
];

const CI_KEY: AuditActor = {
  email: null,
  id: "key_deploy",
  name: "Deploy key",
  type: "api_key",
};

const PROJECTS: AuditTarget[] = [
  { id: "prj_website", name: "Website", type: "project" },
  { id: "prj_mobile", name: "Mobile app", type: "project" },
  { id: "prj_api", name: "Public API", type: "project" },
];

const BROWSERS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36",
];

/** Picks from a list by number, so every page view gets the same log. */
function pick<T>(list: T[], seed: number): T {
  return list[seed % list.length] as T;
}

function makeEvent(index: number, now: number): AuditEvent {
  const action = pick(DEMO_ACTIONS, index * 7 + 3).value;
  const actor =
    action === "api_key.revoked" || index % 11 === 0
      ? CI_KEY
      : pick(PEOPLE, index * 5);
  const project = pick(PROJECTS, index * 3);
  const member = pick(PEOPLE, index + 1);
  const failed = action === "user.signed_in" && index % 4 === 0;

  let target: AuditTarget | null = project;
  let changes: AuditEvent["changes"] = [];
  let metadata: Record<string, unknown> = {};

  if (action.startsWith("member.")) {
    target = { id: member.id ?? "", name: member.name, type: "member" };
  }
  if (action === "member.role_changed") {
    changes = [{ after: "admin", before: "member", field: "role" }];
  }
  if (action === "member.invited") {
    metadata = { email: `new.member${index}@acme.dev`, role: "member" };
  }
  if (action === "project.renamed") {
    changes = [
      { after: project.name, before: `${project.name} (old)`, field: "name" },
    ];
  }
  if (action.startsWith("api_key.")) {
    target = { id: `key_${index}`, name: "CI key", type: "api_key" };
    metadata = { scopes: ["deploy:write", "projects:read"] };
  }
  if (action === "billing.plan_changed") {
    target = { id: "org_acme", name: "Acme", type: "organization" };
    changes = [
      { after: "pro", before: "starter", field: "plan" },
      { after: 10, before: 3, field: "seats" },
    ];
  }
  if (action === "user.signed_in") {
    target = null;
    metadata = failed
      ? { method: "password", reason: "wrong_password" }
      : { method: index % 2 === 0 ? "passkey" : "google" };
  }

  return {
    action,
    actor,
    changes,
    id: `evt_${String(EVENT_COUNT - index).padStart(4, "0")}`,
    ipAddress:
      actor.type === "api_key" ? "203.0.113.24" : `198.51.100.${index}`,
    metadata,
    occurredAt: new Date(
      now - index * 9 * HOUR_MS - index * 7 * 60_000
    ).toISOString(),
    outcome: failed ? "failure" : "success",
    target,
    userAgent:
      actor.type === "api_key" ? "acme-deploy/2.4" : pick(BROWSERS, index),
  };
}

function matches(event: AuditEvent, filter: AuditLogFilter): boolean {
  const actor = filter.actor?.toLowerCase();
  return !(
    (filter.actions?.length && !filter.actions.includes(event.action)) ||
    (actor &&
      event.actor.id !== filter.actor &&
      event.actor.email?.toLowerCase() !== actor) ||
    (filter.target && event.target?.id !== filter.target) ||
    (filter.outcome && event.outcome !== filter.outcome) ||
    (filter.from && event.occurredAt < filter.from) ||
    (filter.to && event.occurredAt >= filter.to)
  );
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ok<T>(data: T): AuditResult<T> {
  return { data, ok: true };
}

export function createDemoAuditLog(): AuditLogSource {
  const now = Date.now();
  const events = Array.from({ length: EVENT_COUNT }, (_, index) =>
    makeEvent(index, now)
  );

  return {
    async getEvent(id) {
      await wait(LATENCY_MS);
      const event = events.find((item) => item.id === id);
      return event
        ? ok(event)
        : { error: "That event doesn't exist.", ok: false };
    },

    async list({ cursor, filter }) {
      await wait(LATENCY_MS);
      const found = events.filter((event) => matches(event, filter));
      const start = cursor ? Number(cursor) : 0;
      const end = start + PAGE_SIZE;
      return ok({
        events: found.slice(start, end),
        nextCursor: end < found.length ? String(end) : null,
      });
    },
  };
}
