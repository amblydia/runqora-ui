// Connects the audit log to your database, and records events. Import it only
// from server code, such as server actions and route handlers.
//
// It uses the Postgres store. On another database, replace `auditStore` with
// your own `AuditStore`, and keep the rest.

import { isIP } from "node:net";
import { headers } from "next/headers";
import { createPostgresAuditStore } from "@/lib/audit/postgres";
import type { AuditEvent, NewAuditEvent } from "@/lib/audit/types";

/**
 * Runs one query on your Postgres database and returns its rows. Replace the
 * body with the library you use:
 *
 *   pg:              pool.query(text, params).then((result) => result.rows)
 *   postgres.js:     sql.unsafe(text, params)
 *   Neon serverless: sql.query(text, params)
 *   Prisma:          prisma.$queryRawUnsafe(text, ...params)
 *   Drizzle:         the library under it, through `db.$client`
 */
function query(
  _text: string,
  _params: unknown[]
): Promise<Record<string, unknown>[]> {
  return Promise.reject(
    new Error(
      "Connect lib/audit/server.ts to your database to use the audit log."
    )
  );
}

export const auditStore = createPostgresAuditStore({ query });

/**
 * The address of the person making the request. Clients can send any of these
 * headers themselves, so read the one that what sits in front of your app sets:
 *
 *   Cloudflare:     list.get("cf-connecting-ip")
 *   Vercel:         list.get("x-real-ip")
 *   nginx, Traefik: the header you set there, from the address it saw
 *
 * By default it's the last `x-forwarded-for` entry, which the nearest proxy
 * added. Behind more than one proxy, that is the address of the one before it.
 */
function clientAddress(list: Pick<Headers, "get">): string | null {
  const address = list.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return address && isIP(address) ? address : null;
}

/** The address and browser of the request being handled, if any. */
async function requestDetails(): Promise<{
  ipAddress: string | null;
  userAgent: string | null;
}> {
  try {
    const list = await headers();
    return {
      ipAddress: clientAddress(list),
      userAgent: list.get("user-agent"),
    };
  } catch {
    // Called outside a request, such as from a scheduled job.
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Writes one event to the audit log. Call it on the server once an action has
 * happened, or failed. The address and browser of the current request are
 * filled in unless the event has its own.
 *
 *   await recordAuditEvent({
 *     action: "member.role_changed",
 *     actor: { id: user.id, name: user.name, email: user.email },
 *     target: { type: "member", id: member.id, name: member.name },
 *     changes: [{ field: "role", before: "member", after: "admin" }],
 *     tenantId: organization.id,
 *   });
 */
export async function recordAuditEvent(
  event: NewAuditEvent
): Promise<AuditEvent> {
  const request = await requestDetails();
  return await auditStore.insert({
    ...event,
    ipAddress:
      event.ipAddress === undefined ? request.ipAddress : event.ipAddress,
    userAgent:
      event.userAgent === undefined ? request.userAgent : event.userAgent,
  });
}
