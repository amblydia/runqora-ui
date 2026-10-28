"use server";

// Server actions that let the audit log viewer read the log. Pass them to
// <AuditLogViewer source={{ list: listAuditEvents, getEvent: getAuditEvent }} />.
//
// Every server action is a public endpoint that anyone can call, so each one
// starts with `authorize()`, which also decides which events the request may
// see. Write that check before you use the viewer.

import { auditStore } from "@/lib/audit/server";
import type {
  AuditCursor,
  AuditEvent,
  AuditLogFilter,
  AuditLogPage,
  AuditOutcome,
  AuditResult,
  AuditScope,
} from "@/lib/audit/types";

const PAGE_SIZE = 50;
const MAX_ACTIONS = 50;
const MAX_VALUE_LENGTH = 320;
const CONTROL_CHARACTERS = /\p{Cc}/u;
/** Dates before 1970 or after 9999 are refused, as no event has them. */
const LAST_DATE = Date.UTC(9999, 11, 31, 23, 59, 59, 999);

/** An error whose message is safe to show to the person using the viewer. */
class AuditActionError extends Error {}

/**
 * Rejects when the person making the request may not see the audit log, and
 * otherwise returns the events they may see. For example, with Better Auth
 * and its organization plugin, for the admins of the active organization:
 *
 *   async function authorize(): Promise<AuditScope> {
 *     const requestHeaders = await headers();
 *     const session = await auth.api.getSession({ headers: requestHeaders });
 *     const tenantId = session?.session.activeOrganizationId;
 *     const member = tenantId
 *       ? await auth.api
 *           .getActiveMember({ headers: requestHeaders })
 *           .catch(() => null)
 *       : null;
 *     // A member can have several roles, such as "admin,member".
 *     const roles = member?.role.split(",") ?? [];
 *     if (!(tenantId && roles.some((role) => role === "owner" || role === "admin"))) {
 *       throw new AuditActionError("You are not allowed to see the audit log.");
 *     }
 *     return { tenantId };
 *   }
 *
 * Return `{ actorId: session.user.id }` to show people their own activity,
 * and `{ all: true }` only to those who may see every event.
 */
function authorize(): Promise<AuditScope> {
  return Promise.reject(
    new AuditActionError(
      "Add an authorization check to lib/audit/actions.ts to see the audit log."
    )
  );
}

async function run<T>(
  task: (scope: AuditScope) => Promise<T>
): Promise<AuditResult<T>> {
  try {
    const scope = await authorize();
    return { data: await task(scope), ok: true };
  } catch (error) {
    if (error instanceof AuditActionError) {
      return { error: error.message, ok: false };
    }
    console.error(error);
    return { error: "Something went wrong. Try again.", ok: false };
  }
}

function isText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_VALUE_LENGTH &&
    !CONTROL_CHARACTERS.test(value)
  );
}

function readText(value: unknown, message: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return;
  }
  if (!isText(value)) {
    throw new AuditActionError(message);
  }
  return value;
}

function readDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return;
  }
  const time = typeof value === "string" ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(time) || time < 0 || time > LAST_DATE) {
    throw new AuditActionError("Choose a valid date.");
  }
  return new Date(time).toISOString();
}

function readActions(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return;
  }
  const invalid = new AuditActionError("That action filter can't be used.");
  if (!Array.isArray(value) || value.length > MAX_ACTIONS) {
    throw invalid;
  }
  // A new array, checked item by item: `every` would skip the holes of a
  // sparse array.
  const actions: string[] = [];
  for (const action of value) {
    if (!isText(action)) {
      throw invalid;
    }
    actions.push(action);
  }
  return actions.length > 0 ? actions : undefined;
}

function readOutcome(value: unknown): AuditOutcome | undefined {
  if (value === undefined || value === null || value === "") {
    return;
  }
  if (value !== "success" && value !== "failure") {
    throw new AuditActionError("That outcome can't be used.");
  }
  return value;
}

/** The filter the browser sent, checked. Unknown fields are dropped. */
function readFilter(value: unknown): AuditLogFilter {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value !== "object") {
    throw new AuditActionError("That filter can't be used.");
  }
  const input = value as Record<string, unknown>;
  const filter: AuditLogFilter = {
    actions: readActions(input.actions),
    actor: readText(input.actor, "Enter an id or an email."),
    from: readDate(input.from),
    outcome: readOutcome(input.outcome),
    target: readText(input.target, "Enter the id of what was changed."),
    to: readDate(input.to),
  };
  if (filter.from && filter.to && filter.from >= filter.to) {
    throw new AuditActionError("The start date must be before the end date.");
  }
  return filter;
}

function encodeCursor(cursor: AuditCursor | null): string | null {
  return cursor
    ? Buffer.from(JSON.stringify([cursor.occurredAt, cursor.id])).toString(
        "base64url"
      )
    : null;
}

function decodeCursor(value: unknown): AuditCursor | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  const message = "The next page can't be loaded. Reload the log.";
  if (typeof value !== "string" || value.length > MAX_VALUE_LENGTH) {
    throw new AuditActionError(message);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch (error) {
    throw new AuditActionError(message, { cause: error });
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 2 ||
    typeof parsed[0] !== "string" ||
    Number.isNaN(Date.parse(parsed[0])) ||
    !isText(parsed[1])
  ) {
    throw new AuditActionError(message);
  }
  return { id: parsed[1], occurredAt: new Date(parsed[0]).toISOString() };
}

export async function listAuditEvents(input: {
  cursor?: string | null;
  filter: AuditLogFilter;
}): Promise<AuditResult<AuditLogPage>> {
  // A server action gets whatever the browser sends, whatever its types say.
  const sent: unknown = input;
  return await run(async (scope) => {
    const fields =
      typeof sent === "object" && sent !== null
        ? (sent as Record<string, unknown>)
        : {};
    const filter = readFilter(fields.filter);
    const cursor = decodeCursor(fields.cursor);
    const page = await auditStore.list({
      cursor,
      filter,
      limit: PAGE_SIZE,
      scope,
    });
    return { events: page.events, nextCursor: encodeCursor(page.next) };
  });
}

export async function getAuditEvent(
  id: string
): Promise<AuditResult<AuditEvent>> {
  return await run(async (scope) => {
    if (!isText(id)) {
      throw new AuditActionError("That event doesn't exist.");
    }
    const event = await auditStore.get({ id, scope });
    if (!event) {
      // Also for events outside the scope, so their existence doesn't leak.
      throw new AuditActionError("That event doesn't exist.");
    }
    return event;
  });
}
