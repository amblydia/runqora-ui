/// <reference types="bun" />

// Tests for the Postgres audit store in registry/lib/audit/postgres.ts.
//
// The first group fakes `query` and checks the SQL and its parameters. The
// others run the store against real Postgres: always against PGlite, which is
// Postgres compiled to WebAssembly, and also against a Postgres server when
// POSTGRES_TEST_URL is set, as CI does:
//
//   POSTGRES_TEST_URL=postgres://postgres:secret@localhost:5432/postgres bun test

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { SQL } from "bun";
import {
  auditTableSql,
  createPostgresAuditStore,
  type PostgresQuery,
} from "@/lib/audit/postgres";
import type { AuditCursor, AuditScope, AuditStore } from "@/lib/audit/types";

const ALL: AuditScope = { all: true };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function recordingQuery(rows: Record<string, unknown>[] = []) {
  const calls: { params: unknown[]; text: string }[] = [];
  const query: PostgresQuery = (text, params) => {
    calls.push({ params, text });
    return Promise.resolve(rows);
  };
  return { calls, query };
}

describe("with a fake query", () => {
  test("puts every filter value in a parameter", async () => {
    const { calls, query } = recordingQuery();
    const store = createPostgresAuditStore({ query });
    await store.list({
      cursor: {
        id: "0b6b5b8e-3f4c-4d8e-9a59-0c6f1a9e2d11",
        occurredAt: "2026-10-01T00:00:00.000Z",
      },
      filter: {
        actions: ["member.invited", "x'); drop table audit_events; --"],
        actor: "ada@acme.dev",
        from: "2026-09-01T00:00:00.000Z",
        outcome: "failure",
        target: "prj_1",
        to: "2026-10-01T00:00:00.000Z",
      },
      limit: 50,
      scope: { tenantId: "org_1" },
    });
    const [call] = calls;
    expect(call?.text).not.toContain("drop table");
    expect(call?.text).not.toContain("ada@acme.dev");
    expect(call?.text).toContain("tenant_id = $1");
    expect(call?.text).toContain("limit 51");
    expect(call?.params).toEqual([
      "org_1",
      "member.invited",
      "x'); drop table audit_events; --",
      "ada@acme.dev",
      "prj_1",
      "failure",
      "2026-09-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
      "0b6b5b8e-3f4c-4d8e-9a59-0c6f1a9e2d11",
    ]);
  });

  test("applies the scope to reads by id", async () => {
    const { calls, query } = recordingQuery();
    const store = createPostgresAuditStore({ query });
    const id = "0b6b5b8e-3f4c-4d8e-9a59-0c6f1a9e2d11";
    await store.get({ id, scope: { actorId: "usr_1", tenantId: "org_1" } });
    expect(calls[0]?.text).toContain(
      "where tenant_id = $1 and actor_id = $2 and id = $3::uuid"
    );
    expect(calls[0]?.params).toEqual(["org_1", "usr_1", id]);
  });

  test("refuses a scope without a tenant or an actor", async () => {
    const { calls, query } = recordingQuery();
    const store = createPostgresAuditStore({ query });
    const scopes = [
      {},
      { tenantId: "" },
      { actorId: "usr_1", tenantId: "" },
      { actorId: "", tenantId: "org_1" },
      { all: false },
    ] as AuditScope[];
    await Promise.all(
      scopes.map((scope) =>
        expect(
          store.list({ cursor: null, filter: {}, limit: 10, scope })
        ).rejects.toThrow()
      )
    );
    expect(calls).toHaveLength(0);
  });

  test("skips the database for ids and cursors that aren't UUIDs", async () => {
    const { calls, query } = recordingQuery();
    const store = createPostgresAuditStore({ query });
    expect(await store.get({ id: "1 or 1=1", scope: ALL })).toBeNull();
    expect(
      await store.list({
        cursor: { id: "nope", occurredAt: "2026-10-01T00:00:00.000Z" },
        filter: {},
        limit: 10,
        scope: ALL,
      })
    ).toEqual({ events: [], next: null });
    expect(calls).toHaveLength(0);
  });

  test("rejects table names that aren't plain identifiers", () => {
    const { query } = recordingQuery();
    expect(() =>
      createPostgresAuditStore({ query, table: "events; drop table x" })
    ).toThrow();
    expect(() => auditTableSql('"events"')).toThrow();
    expect(() =>
      createPostgresAuditStore({ query, table: "audit.events" })
    ).not.toThrow();
  });

  test("matches the table SQL in the server setup docs", () => {
    const page = readFileSync(
      join(import.meta.dir, "../content/docs/audit/server.mdx"),
      "utf8"
    );
    const fence = "```sql\n";
    const start = page.indexOf(fence) + fence.length;
    const sql = page.slice(start, page.indexOf("\n```", start));
    expect(sql).toBe(auditTableSql());
  });

  test("reads rows whose dates and JSON come back as strings", async () => {
    const { query } = recordingQuery([
      {
        action: "member.role_changed",
        actor_email: "ada@acme.dev",
        actor_id: "usr_ada",
        actor_name: "Ada",
        actor_type: "user",
        changes: '[{"field":"role","before":"member","after":"admin"}]',
        id: "0b6b5b8e-3f4c-4d8e-9a59-0c6f1a9e2d11",
        ip_address: null,
        metadata: '{"via":"settings"}',
        occurred_at: "2026-10-01 10:15:30.123+00",
        outcome: "success",
        target_id: null,
        target_name: null,
        target_type: null,
        user_agent: null,
      },
    ]);
    const store = createPostgresAuditStore({ query });
    const page = await store.list({
      cursor: null,
      filter: {},
      limit: 10,
      scope: ALL,
    });
    expect(page.events[0]).toMatchObject({
      changes: [{ after: "admin", before: "member", field: "role" }],
      metadata: { via: "settings" },
      occurredAt: "2026-10-01T10:15:30.123Z",
      target: null,
    });
  });
});

/** Runs the same tests against one Postgres connection. */
function againstPostgres(
  name: string,
  connect: () => {
    close: () => Promise<void>;
    exec: (sql: string) => Promise<void>;
    query: PostgresQuery;
  },
  enabled = true
) {
  describe.skipIf(!enabled)(name, () => {
    const table = `audit_test_${Date.now()}`;
    let store: AuditStore;
    let query: PostgresQuery;
    let close = () => Promise.resolve();

    beforeAll(async () => {
      const connection = connect();
      ({ close } = connection);
      await connection.exec(auditTableSql(table));
      ({ query } = connection);
      store = createPostgresAuditStore({ query, table });

      // 30 events, a minute apart, over two tenants. Every third one failed.
      for (let index = 0; index < 30; index += 1) {
        // biome-ignore lint/performance/noAwaitInLoops: the events go in one by one, in order.
        await store.insert({
          action: index % 2 === 0 ? "project.created" : "member.invited",
          actor: {
            email: index % 5 === 0 ? "Ada@Acme.dev" : "grace@acme.dev",
            id: index % 5 === 0 ? "usr_ada" : "usr_grace",
            name: "Someone",
          },
          changes: [{ after: index, before: null, field: "count" }],
          metadata: { index },
          occurredAt: new Date(Date.UTC(2026, 9, 1, 12, index)).toISOString(),
          outcome: index % 3 === 0 ? "failure" : "success",
          target: { id: `prj_${index % 4}`, name: null, type: "project" },
          tenantId: index < 20 ? "org_a" : "org_b",
        });
      }
    });

    afterAll(async () => {
      await close();
    });

    test("records an event and reads it back", async () => {
      const event = await store.insert({
        action: "user.signed_in",
        actor: { id: "usr_new" },
        tenantId: "org_c",
      });
      expect(event.id).toMatch(UUID);
      expect(event.outcome).toBe("success");
      expect(event.actor.type).toBe("user");
      expect(Date.parse(event.occurredAt)).not.toBeNaN();
      expect(
        await store.get({ id: event.id, scope: { tenantId: "org_c" } })
      ).toEqual(event);
    });

    test("keeps each tenant to its own events", async () => {
      const page = await store.list({
        cursor: null,
        filter: {},
        limit: 100,
        scope: { tenantId: "org_b" },
      });
      expect(page.events).toHaveLength(10);
      expect(page.next).toBeNull();
      const [first] = page.events;
      expect(
        await store.get({ id: first?.id ?? "", scope: { tenantId: "org_a" } })
      ).toBeNull();
    });

    test("pages through events, newest first, without gaps", async () => {
      const seen: string[] = [];
      let cursor: AuditCursor | null = null;
      do {
        // biome-ignore lint/performance/noAwaitInLoops: each page needs the cursor of the one before.
        const page: Awaited<ReturnType<AuditStore["list"]>> = await store.list({
          cursor,
          filter: {},
          limit: 7,
          scope: { tenantId: "org_a" },
        });
        seen.push(...page.events.map((event) => event.occurredAt));
        cursor = page.next;
      } while (cursor);
      expect(seen).toHaveLength(20);
      expect(seen).toEqual([...seen].sort().reverse());
      expect(new Set(seen).size).toBe(20);
    });

    test("filters by action, actor, target, outcome and dates", async () => {
      const list = async (
        filter: Parameters<AuditStore["list"]>[0]["filter"]
      ) =>
        (
          await store.list({
            cursor: null,
            filter,
            limit: 100,
            scope: { tenantId: "org_a" },
          })
        ).events;

      expect(await list({ actions: ["member.invited"] })).toHaveLength(10);
      expect(await list({ actor: "ada@acme.dev" })).toHaveLength(4);
      expect(await list({ actor: "usr_ada" })).toHaveLength(4);
      expect(await list({ target: "prj_0" })).toHaveLength(5);
      expect(await list({ outcome: "failure" })).toHaveLength(7);
      expect(
        await list({
          from: new Date(Date.UTC(2026, 9, 1, 12, 5)).toISOString(),
          to: new Date(Date.UTC(2026, 9, 1, 12, 10)).toISOString(),
        })
      ).toHaveLength(5);
    });

    test("pages through events recorded in the same millisecond", async () => {
      const occurredAt = "2026-10-02T08:00:00.000Z";
      await Promise.all(
        Array.from({ length: 5 }, () =>
          store.insert({
            action: "x",
            actor: {},
            occurredAt,
            tenantId: "org_t",
          })
        )
      );
      const ids: string[] = [];
      let cursor: AuditCursor | null = null;
      do {
        // biome-ignore lint/performance/noAwaitInLoops: each page needs the cursor of the one before.
        const page: Awaited<ReturnType<AuditStore["list"]>> = await store.list({
          cursor,
          filter: {},
          limit: 2,
          scope: { tenantId: "org_t" },
        });
        ids.push(...page.events.map((event) => event.id));
        cursor = page.next;
      } while (cursor);
      expect(new Set(ids).size).toBe(5);
    });

    test("stores changes and metadata as JSON, not strings", async () => {
      const rows = await query(
        `select jsonb_typeof(changes) as changes, jsonb_typeof(metadata) as metadata from ${table} where tenant_id = $1`,
        ["org_a"]
      );
      expect(rows).toHaveLength(20);
      for (const row of rows) {
        expect(row).toEqual({ changes: "array", metadata: "object" });
      }
    });

    test("returns changes and metadata as they were recorded", async () => {
      const [event] = (
        await store.list({
          cursor: null,
          filter: { target: "prj_1" },
          limit: 1,
          scope: { tenantId: "org_b" },
        })
      ).events;
      expect(event?.changes).toEqual([
        { after: 29, before: null, field: "count" },
      ]);
      expect(event?.metadata).toEqual({ index: 29 });
      expect(event?.target).toEqual({
        id: "prj_1",
        name: null,
        type: "project",
      });
    });
  });
}

againstPostgres("against PGlite", () => {
  const db = new PGlite();
  return {
    close: () => db.close(),
    exec: async (sql) => {
      await db.exec(sql);
    },
    query: async (text, params) =>
      (await db.query<Record<string, unknown>>(text, params)).rows,
  };
});

const url = process.env.POSTGRES_TEST_URL;

againstPostgres(
  "against a Postgres server",
  () => {
    const sql = new SQL(url ?? "");
    return {
      close: () => sql.close(),
      exec: async (text) => {
        await sql.unsafe(text);
      },
      query: (text, params) => sql.unsafe(text, params),
    };
  },
  Boolean(url)
);
