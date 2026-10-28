// Shared by the audit log components, which run in the browser, and by the
// code that reads and writes the log, which runs on the server. An event says
// who (the actor) did what (the action) to what (the target), and when.

/** Whether the action went through. */
export type AuditOutcome = "failure" | "success";

/** Who did it. */
export interface AuditActor {
  email: string | null;
  /** Your id for the actor, such as a user id. Null for the system. */
  id: string | null;
  name: string | null;
  /** Such as "user", "api_key" or "system". */
  type: string;
}

/** What it was done to. */
export interface AuditTarget {
  id: string;
  name: string | null;
  /** Such as "project", "member" or "invoice". */
  type: string;
}

/** One field the action changed. Values are anything JSON can hold. */
export interface AuditChange {
  after: unknown;
  before: unknown;
  field: string;
}

/** One entry in the audit log. */
export interface AuditEvent {
  /** Such as "member.role_changed". */
  action: string;
  actor: AuditActor;
  changes: AuditChange[];
  id: string;
  ipAddress: string | null;
  /** Anything else worth keeping, as JSON. */
  metadata: Record<string, unknown>;
  /** ISO 8601 date. */
  occurredAt: string;
  outcome: AuditOutcome;
  target: AuditTarget | null;
  userAgent: string | null;
}

/** Which events to show. Every field narrows the list; leave it out to match all. */
export interface AuditLogFilter {
  /** Only these actions. */
  actions?: string[];
  /** The actor's id or email, exactly. */
  actor?: string;
  /** Only events at or after this ISO 8601 date. */
  from?: string;
  outcome?: AuditOutcome;
  /** The target's id, exactly. */
  target?: string;
  /** Only events before this ISO 8601 date. */
  to?: string;
}

/** One page of events, newest first. */
export interface AuditLogPage {
  events: AuditEvent[];
  /** Pass to `list` to get the next page. Null on the last page. */
  nextCursor: string | null;
}

/**
 * What an audit log call returns. Errors are values rather than exceptions so
 * their message reaches the browser: Next.js hides the message of an error
 * thrown by a server action in production.
 */
export type AuditResult<T> =
  | { data: T; ok: true }
  | { error: string; ok: false };

/** The calls the audit log components make. */
export interface AuditLogSource {
  /** Reads one event, to open it from a link. */
  getEvent?: (id: string) => Promise<AuditResult<AuditEvent>>;
  /** Lists one page of the events that match `filter`, newest first. */
  list: (input: {
    cursor?: string | null;
    filter: AuditLogFilter;
  }) => Promise<AuditResult<AuditLogPage>>;
}

/** An action as the filter offers it, such as "Changed a member's role". */
export interface AuditActionOption {
  label: string;
  value: string;
}

/**
 * The events a request may see. The store applies it to every query, whatever
 * the browser asks for. Use `{ all: true }` only for people who may see
 * everything, such as the admins of a single-tenant app.
 */
export type AuditScope =
  | { all: true }
  | { actorId?: string; tenantId: string }
  | { actorId: string; tenantId?: string };

/** An event to record. The store fills in the id, and the time if it's left out. */
export interface NewAuditEvent {
  action: string;
  actor: Partial<AuditActor>;
  changes?: AuditChange[];
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
  /** ISO 8601 date. Now if left out. */
  occurredAt?: string;
  outcome?: AuditOutcome;
  target?: AuditTarget | null;
  /** The organization, workspace or account the event belongs to. */
  tenantId?: string | null;
  userAgent?: string | null;
}

/** Where a page of events ends. */
export interface AuditCursor {
  id: string;
  occurredAt: string;
}

/** Where events are kept. `lib/audit/postgres.ts` implements it for Postgres. */
export interface AuditStore {
  get: (input: { id: string; scope: AuditScope }) => Promise<AuditEvent | null>;
  insert: (event: NewAuditEvent) => Promise<AuditEvent>;
  list: (input: {
    cursor: AuditCursor | null;
    filter: AuditLogFilter;
    limit: number;
    scope: AuditScope;
  }) => Promise<{ events: AuditEvent[]; next: AuditCursor | null }>;
}

/** How to name the actor, such as "Ada Lovelace", "ada@example.com" or "System". */
export function describeActor(actor: AuditActor): string {
  return actor.name ?? actor.email ?? actor.id ?? "System";
}
