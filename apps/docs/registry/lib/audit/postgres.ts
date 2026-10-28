// An audit log store for Postgres, in plain SQL. It works with any Postgres
// library through one `query` function, so it adds no dependencies and doesn't
// care which ORM, if any, the rest of the app uses. Every value goes in as a
// query parameter.
//
// Create the table with the SQL from `auditTableSql()`, or add the equivalent to
// your ORM's schema so its migrations know about the table.

import type {
  AuditCursor,
  AuditEvent,
  AuditLogFilter,
  AuditScope,
  AuditStore,
  NewAuditEvent,
} from "@/lib/audit/types";

/**
 * Runs one query with `$1`, `$2`… placeholders and returns its rows. With
 * `pg`: `(text, params) => pool.query(text, params).then((r) => r.rows)`.
 */
export type PostgresQuery = (
  text: string,
  params: unknown[]
) => Promise<Record<string, unknown>[]>;

export interface PostgresAuditStoreConfig {
  query: PostgresQuery;
  /** Table name, optionally with a schema, such as "audit.events". */
  table?: string;
}

const TABLE_NAME = /^[a-z_][a-z0-9_]*(?:\.[a-z_][a-z0-9_]*)?$/u;

function checkTable(table: string): string {
  if (!TABLE_NAME.test(table)) {
    throw new Error(`"${table}" can't be used as an audit table name.`);
  }
  return table;
}

/**
 * The SQL that creates the table and its indexes. Times are kept to the
 * millisecond, as JavaScript dates are, so that page cursors match rows
 * exactly.
 */
export function auditTableSql(table = "audit_events"): string {
  const name = checkTable(table);
  const index = name.replace(".", "_");
  return `create table if not exists ${name} (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz(3) not null default now(),
  tenant_id text,
  action text not null,
  outcome text not null default 'success' check (outcome in ('success', 'failure')),
  actor_type text not null default 'user',
  actor_id text,
  actor_name text,
  actor_email text,
  target_type text,
  target_id text,
  target_name text,
  ip_address text,
  user_agent text,
  changes jsonb not null default '[]',
  metadata jsonb not null default '{}'
);
create index if not exists ${index}_time on ${name} (occurred_at desc, id desc);
create index if not exists ${index}_tenant_time on ${name} (tenant_id, occurred_at desc, id desc);`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

const COLUMNS =
  "id, occurred_at, action, outcome, actor_type, actor_id, actor_name, actor_email, target_type, target_id, target_name, ip_address, user_agent, changes, metadata";

/** Collects the conditions and parameters of one query. */
class Where {
  readonly conditions: string[] = [];
  readonly params: unknown[] = [];

  /** Adds a parameter and returns its placeholder. */
  param(value: unknown): string {
    this.params.push(value);
    return `$${this.params.length}`;
  }

  add(condition: string) {
    this.conditions.push(condition);
  }

  toString(): string {
    return this.conditions.length > 0
      ? `where ${this.conditions.join(" and ")}`
      : "";
  }
}

function applyScope(where: Where, scope: AuditScope) {
  if ("all" in scope) {
    if (scope.all !== true) {
      throw new Error("Invalid audit scope.");
    }
    return;
  }
  const { actorId, tenantId } = scope;
  // An empty id would otherwise drop out of the query and widen the scope.
  for (const id of [actorId, tenantId]) {
    if (id !== undefined && (typeof id !== "string" || id === "")) {
      throw new Error("An audit scope's ids must be non-empty strings.");
    }
  }
  if (!(tenantId || actorId)) {
    throw new Error("An audit scope needs a tenantId or an actorId.");
  }
  if (tenantId) {
    where.add(`tenant_id = ${where.param(tenantId)}`);
  }
  if (actorId) {
    where.add(`actor_id = ${where.param(actorId)}`);
  }
}

function applyFilter(where: Where, filter: AuditLogFilter) {
  if (filter.actions && filter.actions.length > 0) {
    const list = filter.actions.map((action) => where.param(action));
    where.add(`action in (${list.join(", ")})`);
  }
  if (filter.actor) {
    const actor = where.param(filter.actor);
    where.add(`(actor_id = ${actor} or lower(actor_email) = lower(${actor}))`);
  }
  if (filter.target) {
    where.add(`target_id = ${where.param(filter.target)}`);
  }
  if (filter.outcome) {
    where.add(`outcome = ${where.param(filter.outcome)}`);
  }
  if (filter.from) {
    where.add(`occurred_at >= ${where.param(filter.from)}::timestamptz`);
  }
  if (filter.to) {
    where.add(`occurred_at < ${where.param(filter.to)}::timestamptz`);
  }
}

function text(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

/** Libraries return `jsonb` parsed or as a string, depending on their settings. */
function json(value: unknown): unknown {
  return typeof value === "string" ? JSON.parse(value) : value;
}

/** Libraries return `timestamptz` as a Date or a string. */
function isoDate(value: unknown): string {
  return new Date(value instanceof Date ? value : String(value)).toISOString();
}

function toEvent(row: Record<string, unknown>): AuditEvent {
  const changes = json(row.changes);
  const metadata = json(row.metadata);
  const targetId = text(row.target_id);
  return {
    action: String(row.action),
    actor: {
      email: text(row.actor_email),
      id: text(row.actor_id),
      name: text(row.actor_name),
      type: text(row.actor_type) ?? "user",
    },
    changes: Array.isArray(changes) ? changes : [],
    id: String(row.id),
    ipAddress: text(row.ip_address),
    metadata:
      metadata && typeof metadata === "object" && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : {},
    occurredAt: isoDate(row.occurred_at),
    outcome: row.outcome === "failure" ? "failure" : "success",
    target:
      targetId === null
        ? null
        : {
            id: targetId,
            name: text(row.target_name),
            type: text(row.target_type) ?? "",
          },
    userAgent: text(row.user_agent),
  };
}

/** Keeps and reads audit events in a Postgres table. */
export function createPostgresAuditStore({
  query,
  table = "audit_events",
}: PostgresAuditStoreConfig): AuditStore {
  checkTable(table);

  return {
    async get({ id, scope }) {
      if (!UUID.test(id)) {
        return null;
      }
      const where = new Where();
      applyScope(where, scope);
      where.add(`id = ${where.param(id)}::uuid`);
      const rows = await query(
        `select ${COLUMNS} from ${table} ${where} limit 1`,
        where.params
      );
      return rows[0] ? toEvent(rows[0]) : null;
    },

    async insert(event: NewAuditEvent) {
      if (typeof event.action !== "string" || event.action === "") {
        throw new Error("An audit event needs an action.");
      }
      const values = [
        event.occurredAt ?? null,
        event.tenantId ?? null,
        event.action,
        event.outcome === "failure" ? "failure" : "success",
        event.actor.type ?? "user",
        event.actor.id ?? null,
        event.actor.name ?? null,
        event.actor.email ?? null,
        event.target?.type ?? null,
        event.target?.id ?? null,
        event.target?.name ?? null,
        event.ipAddress ?? null,
        event.userAgent ?? null,
        JSON.stringify(event.changes ?? []),
        JSON.stringify(event.metadata ?? {}),
      ];
      const rows = await query(
        `insert into ${table} (occurred_at, tenant_id, action, outcome, actor_type, actor_id, actor_name, actor_email, target_type, target_id, target_name, ip_address, user_agent, changes, metadata)
values (coalesce($1::timestamptz, now()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::text::jsonb, $15::text::jsonb)
returning ${COLUMNS}`,
        values
      );
      if (!rows[0]) {
        throw new Error("The audit event wasn't saved.");
      }
      return toEvent(rows[0]);
    },

    async list({ cursor, filter, limit, scope }) {
      if (!Number.isSafeInteger(limit) || limit < 1) {
        throw new Error("The page size must be a positive whole number.");
      }
      if (cursor && !UUID.test(cursor.id)) {
        return { events: [], next: null };
      }
      const where = new Where();
      applyScope(where, scope);
      applyFilter(where, filter);
      if (cursor) {
        const time = where.param(cursor.occurredAt);
        const id = where.param(cursor.id);
        where.add(`(occurred_at, id) < (${time}::timestamptz, ${id}::uuid)`);
      }
      // One extra row tells whether there is a next page.
      const rows = await query(
        `select ${COLUMNS} from ${table} ${where} order by occurred_at desc, id desc limit ${limit + 1}`,
        where.params
      );
      const events = rows.slice(0, limit).map(toEvent);
      const last = events.at(-1);
      return {
        events,
        next:
          rows.length > limit && last
            ? ({
                id: last.id,
                occurredAt: last.occurredAt,
              } satisfies AuditCursor)
            : null,
      };
    },
  };
}
