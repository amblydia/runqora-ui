"use client";

import { type ReactNode, useEffect, useState } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  type AuditEvent,
  type AuditLogFilter,
  type AuditLogSource,
  describeActor,
} from "@/lib/audit/types";

export interface AuditEventDetailsProps {
  /** The event, when it's already loaded. Otherwise it's read with `source.getEvent`. */
  event?: AuditEvent;
  /** Id of the event to show. */
  eventId: string;
  /** Names for actions, such as "Changed a member's role". */
  getActionLabel?: (action: string) => string;
  /**
   * Called with a filter for the events by the same actor or about the same
   * target. Leave it out to hide those links.
   */
  onFilter?: (filter: AuditLogFilter) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** Reads the event when `event` isn't given. */
  source?: Pick<AuditLogSource, "getEvent">;
}

type State =
  | { event: AuditEvent; status: "ready" }
  | { error: string; status: "failed" }
  | { status: "loading" };

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "full",
  timeStyle: "long",
});

/** A changed value as text. Strings show as they are, and anything else as JSON. */
function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Empty";
  }
  return typeof value === "string" ? value : JSON.stringify(value);
}

function Detail({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{children}</dd>
    </div>
  );
}

function Changes({ changes }: { changes: AuditEvent["changes"] }) {
  return (
    <section>
      <h3 className="text-sm font-medium">Changes</h3>
      <div className="mt-2 overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Field</TableHead>
              <TableHead>Before</TableHead>
              <TableHead>After</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changes.map((change, index) => (
              // Changes have no id, and the same field can change twice.
              // biome-ignore lint/suspicious/noArrayIndexKey: the list never reorders.
              <TableRow key={`${change.field}-${index}`}>
                <TableCell className="align-top font-medium">
                  {change.field}
                </TableCell>
                <TableCell className="text-muted-foreground align-top break-all whitespace-normal">
                  {formatValue(change.before)}
                </TableCell>
                <TableCell className="align-top break-all whitespace-normal">
                  {formatValue(change.after)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function RawEvent({ event }: { event: AuditEvent }) {
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(event, null, 2);

  async function copy() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Event as JSON</h3>
        <Button onClick={copy} size="sm" variant="outline">
          <IconPlaceholder
            aria-hidden="true"
            hugeicons="Copy01Icon"
            lucide="CopyIcon"
            phosphor="CopyIcon"
            remixicon="RiFileCopyLine"
            tabler="IconCopy"
          />
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="bg-muted mt-2 max-h-80 overflow-auto rounded-lg p-3 font-mono text-xs">
        {json}
      </pre>
    </section>
  );
}

function Summary({ event, label }: { event: AuditEvent; label: string }) {
  const { actor, target } = event;
  return (
    <dl className="flex flex-col gap-3">
      <Detail label="Action">
        <span className="flex flex-wrap items-center gap-2">
          {label === event.action ? null : <span>{label}</span>}
          <code className="font-mono text-xs">{event.action}</code>
          {event.outcome === "failure" ? (
            <Badge variant="destructive">Failed</Badge>
          ) : null}
        </span>
      </Detail>
      <Detail label="Actor">
        {describeActor(actor)}
        {actor.email && actor.name ? (
          <span className="text-muted-foreground block">{actor.email}</span>
        ) : null}
        <span className="text-muted-foreground block font-mono text-xs">
          {actor.id ? `${actor.type} · ${actor.id}` : actor.type}
        </span>
      </Detail>
      {target ? (
        <Detail label="Target">
          {target.name ?? target.id}
          <span className="text-muted-foreground block font-mono text-xs">
            {target.type ? `${target.type} · ${target.id}` : target.id}
          </span>
        </Detail>
      ) : null}
      <Detail label="Time">
        <time dateTime={event.occurredAt}>
          {dateFormat.format(new Date(event.occurredAt))}
        </time>
      </Detail>
      {event.ipAddress ? (
        <Detail label="IP address">
          <span className="font-mono text-xs">{event.ipAddress}</span>
        </Detail>
      ) : null}
      {event.userAgent ? (
        <Detail label="Browser">
          <span className="text-xs break-all">{event.userAgent}</span>
        </Detail>
      ) : null}
    </dl>
  );
}

/** Links to the other events by the same actor or about the same target. */
function FilterLinks({
  event,
  onFilter,
}: {
  event: AuditEvent;
  onFilter: (filter: AuditLogFilter) => void;
}) {
  const actorKey = event.actor.id ?? event.actor.email;
  const { target } = event;
  if (!(actorKey || target)) {
    return null;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {actorKey ? (
        <Button
          onClick={() => onFilter({ actor: actorKey })}
          size="sm"
          variant="outline"
        >
          Events by this actor
        </Button>
      ) : null}
      {target ? (
        <Button
          onClick={() => onFilter({ target: target.id })}
          size="sm"
          variant="outline"
        >
          Events about this target
        </Button>
      ) : null}
    </div>
  );
}

function Body({
  getActionLabel,
  onFilter,
  state,
}: {
  getActionLabel: (action: string) => string;
  onFilter?: (filter: AuditLogFilter) => void;
  state: State;
}) {
  if (state.status === "loading") {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <span className="sr-only">Loading the event</span>
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (state.status === "failed") {
    return (
      <p className="text-destructive text-sm" role="alert">
        {state.error}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Summary event={state.event} label={getActionLabel(state.event.action)} />
      {onFilter ? (
        <FilterLinks event={state.event} onFilter={onFilter} />
      ) : null}
      {state.event.changes.length > 0 ? (
        <Changes changes={state.event.changes} />
      ) : null}
      <RawEvent event={state.event} />
    </div>
  );
}

const sameAction = (action: string) => action;

/** A side sheet with everything recorded about one audit event. */
export function AuditEventDetails({
  event,
  eventId,
  getActionLabel = sameAction,
  onFilter,
  onOpenChange,
  open,
  source,
}: AuditEventDetailsProps) {
  const [loaded, setLoaded] = useState<State>({ status: "loading" });
  const getEvent = source?.getEvent;

  useEffect(() => {
    if (!open || event) {
      return;
    }
    if (!getEvent) {
      setLoaded({ error: "The event can't be loaded.", status: "failed" });
      return;
    }
    let current = true;
    setLoaded({ status: "loading" });
    getEvent(eventId).then((result) => {
      if (current) {
        setLoaded(
          result.ok
            ? { event: result.data, status: "ready" }
            : { error: result.error, status: "failed" }
        );
      }
    });
    return () => {
      current = false;
    };
  }, [event, eventId, getEvent, open]);

  const state: State = event ? { event, status: "ready" } : loaded;
  const title =
    state.status === "ready" ? getActionLabel(state.event.action) : "Event";

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="break-words">{title}</SheetTitle>
          <SheetDescription>Audit log event</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <Body
            getActionLabel={getActionLabel}
            onFilter={onFilter}
            state={state}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
