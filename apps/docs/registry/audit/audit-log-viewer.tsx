"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { AuditEventDetails } from "@/components/audit/audit-event-details";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Faceted,
  FacetedClear,
  FacetedContent,
  FacetedEmpty,
  FacetedGroup,
  FacetedInput,
  FacetedItem,
  FacetedItemIndicator,
  FacetedList,
  FacetedTrigger,
  FacetedValue,
} from "@/components/ui/faceted";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { RelativeTimeCard } from "@/components/ui/relative-time-card";
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
  type AuditActionOption,
  type AuditEvent,
  type AuditLogFilter,
  type AuditLogPage,
  type AuditLogSource,
  describeActor,
} from "@/lib/audit/types";
import { cn } from "@/lib/utils";

export interface AuditLogViewerProps {
  /**
   * The actions the filter offers, with names to show for them. Leave it out
   * to hide the action filter and show action codes as they are.
   */
  actions?: AuditActionOption[];
  className?: string;
  /** Filter to start with when `filter` isn't controlled. */
  defaultFilter?: AuditLogFilter;
  /** The events to show. Set it to control filtering, for example from the URL. */
  filter?: AuditLogFilter;
  /** Called when someone changes the filter. */
  onFilterChange?: (filter: AuditLogFilter) => void;
  /** The calls that read the log. */
  source: AuditLogSource;
}

/** The details sheet of one event. It stays mounted while it closes, so it can animate out. */
interface Panel {
  event: AuditEvent;
  open: boolean;
}

type Loaded =
  | { page: AuditLogPage; status: "ready" }
  | { error: string; status: "failed" }
  | { status: "loading" };

const SKELETON_ROWS = ["first", "second", "third", "fourth"];
const FOCUS_RING =
  "rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";
const NO_ACTIONS: AuditActionOption[] = [];

/** The filter without empty fields, so equal filters compare equal. */
function clean(filter: AuditLogFilter): AuditLogFilter {
  const result: AuditLogFilter = {};
  if (filter.actions && filter.actions.length > 0) {
    result.actions = [...filter.actions].sort();
  }
  for (const field of ["actor", "from", "outcome", "target", "to"] as const) {
    const value = filter[field];
    if (value) {
      Object.assign(result, { [field]: value });
    }
  }
  return result;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** An ISO date as the value of a date input, in the local time zone. */
function toDateInput(iso: string | undefined, offsetMs = 0): string {
  if (!iso) {
    return "";
  }
  const date = new Date(Date.parse(iso) + offsetMs);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The start of a day picked in a date input, as an ISO date. */
function fromDateInput(value: string, addDays = 0): string | undefined {
  const [year, month, day] = value.split("-").map(Number);
  if (!(year && month && day)) {
    return;
  }
  return new Date(year, month - 1, day + addDays).toISOString();
}

/** Who did it, or what it was done to, in two lines. */
function Party({ detail, name }: { detail: string | null; name: string }) {
  return (
    <span className="flex min-w-0 flex-col">
      <span className="truncate">{name}</span>
      {detail ? (
        <span className="text-muted-foreground truncate text-xs">{detail}</span>
      ) : null}
    </span>
  );
}

function ActionFilter({
  actions,
  onChange,
  value,
}: {
  actions: AuditActionOption[];
  onChange: (actions: string[]) => void;
  value: string[];
}) {
  return (
    <Faceted
      items={actions}
      multiple
      onValueChange={(next) => onChange(next ?? [])}
      value={value}
    >
      <FacetedTrigger asChild>
        <Button
          aria-label="Filter by action"
          className="w-48"
          variant="outline"
        >
          <FacetedValue placeholder="All actions" />
        </Button>
      </FacetedTrigger>
      <FacetedContent className="w-64">
        <FacetedInput aria-label="Search actions" placeholder="Search…" />
        <FacetedList>
          <FacetedEmpty>No actions found.</FacetedEmpty>
          <FacetedGroup>
            {actions.map((action) => (
              <FacetedItem
                key={action.value}
                keywords={[action.label]}
                value={action.value}
              >
                <span className="truncate">{action.label}</span>
                <FacetedItemIndicator />
              </FacetedItem>
            ))}
          </FacetedGroup>
          <FacetedClear>Show all actions</FacetedClear>
        </FacetedList>
      </FacetedContent>
    </Faceted>
  );
}

/** Actors are matched by id or email, exactly, so that's what the search offers. */
function ActorFilter({
  actor,
  onFilter,
}: {
  actor: string;
  onFilter: (actor: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onFilter(
      String(new FormData(event.currentTarget).get("actor") ?? "").trim()
    );
  }

  return (
    <search>
      <form onSubmit={submit}>
        <Input
          aria-label="Show events by the actor with this id or email"
          className="w-56"
          defaultValue={actor}
          name="actor"
          placeholder="Actor id or email…"
          spellCheck={false}
          type="search"
        />
      </form>
    </search>
  );
}

function Toolbar({
  actions,
  filter,
  onChange,
  onRefresh,
}: {
  actions: AuditActionOption[];
  filter: AuditLogFilter;
  onChange: (filter: AuditLogFilter) => void;
  onRefresh: () => void;
}) {
  const update = (changes: Partial<AuditLogFilter>) =>
    onChange({ ...filter, ...changes });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ActorFilter
        actor={filter.actor ?? ""}
        key={filter.actor ?? ""}
        onFilter={(actor) => update({ actor })}
      />
      {actions.length > 0 ? (
        <ActionFilter
          actions={actions}
          onChange={(next) => update({ actions: next })}
          value={filter.actions ?? []}
        />
      ) : null}
      <NativeSelect
        aria-label="Filter by outcome"
        onChange={(event) => {
          const { value } = event.currentTarget;
          update({
            outcome:
              value === "success" || value === "failure" ? value : undefined,
          });
        }}
        value={filter.outcome ?? ""}
      >
        <NativeSelectOption value="">Any outcome</NativeSelectOption>
        <NativeSelectOption value="success">Succeeded</NativeSelectOption>
        <NativeSelectOption value="failure">Failed</NativeSelectOption>
      </NativeSelect>
      <label className="text-muted-foreground flex items-center gap-2 text-sm">
        From
        <Input
          className="w-auto"
          max={toDateInput(filter.to, -1) || undefined}
          onChange={(event) =>
            update({ from: fromDateInput(event.currentTarget.value) })
          }
          type="date"
          value={toDateInput(filter.from)}
        />
      </label>
      <label className="text-muted-foreground flex items-center gap-2 text-sm">
        To
        <Input
          className="w-auto"
          min={toDateInput(filter.from) || undefined}
          onChange={(event) =>
            // The day picked is included, so the filter ends at the next midnight.
            update({ to: fromDateInput(event.currentTarget.value, 1) })
          }
          type="date"
          value={toDateInput(filter.to, -1)}
        />
      </label>
      <Button
        aria-label="Refresh"
        onClick={onRefresh}
        size="icon"
        variant="outline"
      >
        <IconPlaceholder
          hugeicons="RefreshIcon"
          lucide="RefreshCwIcon"
          phosphor="ArrowClockwiseIcon"
          remixicon="RiRefreshLine"
          tabler="IconRefresh"
        />
      </Button>
    </div>
  );
}

function EventRow({
  event,
  label,
  onOpen,
}: {
  event: AuditEvent;
  label: string;
  onOpen: () => void;
}) {
  const { actor, target } = event;
  const actorDetail = actor.name ? actor.email : null;

  return (
    <TableRow>
      <TableCell className="w-full max-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <button
            className={cn("truncate text-left font-medium", FOCUS_RING)}
            onClick={onOpen}
            type="button"
          >
            {label}
          </button>
          {event.outcome === "failure" ? (
            <Badge variant="destructive">Failed</Badge>
          ) : null}
        </div>
        <span className="text-muted-foreground block truncate text-xs sm:hidden">
          {describeActor(actor)}
        </span>
      </TableCell>
      <TableCell className="hidden max-w-56 sm:table-cell">
        <Party detail={actorDetail} name={describeActor(actor)} />
      </TableCell>
      <TableCell className="hidden max-w-56 md:table-cell">
        {target ? (
          <Party detail={target.type} name={target.name ?? target.id} />
        ) : null}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <RelativeTimeCard
          className="tabular-nums"
          date={event.occurredAt}
          side="left"
        />
      </TableCell>
    </TableRow>
  );
}

function EventTable({
  getLabel,
  loaded,
  onOpen,
}: {
  getLabel: (action: string) => string;
  loaded: Loaded;
  onOpen: (event: AuditEvent) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table aria-busy={loaded.status === "loading"}>
        <TableHeader>
          <TableRow>
            <TableHead>Action</TableHead>
            <TableHead className="hidden sm:table-cell">Actor</TableHead>
            <TableHead className="hidden md:table-cell">Target</TableHead>
            <TableHead className="text-right">Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loaded.status === "loading"
            ? SKELETON_ROWS.map((row) => (
                <TableRow key={row}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-5 w-full max-w-80" />
                  </TableCell>
                </TableRow>
              ))
            : null}
          {loaded.status === "ready"
            ? loaded.page.events.map((event) => (
                <EventRow
                  event={event}
                  key={event.id}
                  label={getLabel(event.action)}
                  onOpen={() => onOpen(event)}
                />
              ))
            : null}
        </TableBody>
      </Table>
    </div>
  );
}

function NoEvents({
  filtered,
  onClear,
}: {
  filtered: boolean;
  onClear: () => void;
}) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconPlaceholder
            hugeicons="Search01Icon"
            lucide="SearchIcon"
            phosphor="MagnifyingGlassIcon"
            remixicon="RiSearchLine"
            tabler="IconSearch"
          />
        </EmptyMedia>
        <EmptyTitle>
          {filtered ? "No events match these filters" : "No events yet"}
        </EmptyTitle>
        <EmptyDescription>
          {filtered
            ? "Try a longer period or fewer filters."
            : "Actions recorded in the audit log show up here."}
        </EmptyDescription>
      </EmptyHeader>
      {filtered ? (
        <Button onClick={onClear} variant="outline">
          Clear filters
        </Button>
      ) : null}
    </Empty>
  );
}

/**
 * Shows the audit log, newest first: filter by actor, action, outcome and
 * date, and open an event to see everything recorded about it. Every call
 * goes through `source`, so the viewer works with any backend.
 */
export function AuditLogViewer({
  actions = NO_ACTIONS,
  className,
  defaultFilter = {},
  filter: controlledFilter,
  onFilterChange,
  source,
}: AuditLogViewerProps) {
  const [ownFilter, setOwnFilter] = useState(defaultFilter);
  const filter = clean(controlledFilter ?? ownFilter);
  // Compared as text, so a controlled filter rebuilt on every render doesn't reload.
  const filterKey = JSON.stringify(filter);
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloads, setReloads] = useState(0);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [message, setMessage] = useState("");
  // Counts page requests, so a page that arrives after a newer one is dropped.
  const request = useRef(0);
  const { list } = source;
  const labels = new Map(actions.map((action) => [action.value, action.label]));
  const getLabel = (action: string) => labels.get(action) ?? action;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloads` is a counter that asks for a fresh page.
  useEffect(() => {
    request.current += 1;
    const id = request.current;
    setLoaded({ status: "loading" });
    list({ filter: JSON.parse(filterKey) as AuditLogFilter }).then((result) => {
      if (id === request.current) {
        setLoaded(
          result.ok
            ? { page: result.data, status: "ready" }
            : { error: result.error, status: "failed" }
        );
      }
    });
  }, [filterKey, list, reloads]);

  function changeFilter(next: AuditLogFilter) {
    const cleaned = clean(next);
    setMessage("");
    setOwnFilter(cleaned);
    onFilterChange?.(cleaned);
  }

  async function loadMore() {
    if (loaded.status !== "ready" || !loaded.page.nextCursor) {
      return;
    }
    const { page } = loaded;
    const id = request.current;
    setLoadingMore(true);
    const result = await list({ cursor: page.nextCursor, filter });
    setLoadingMore(false);
    // The filter changed or the log reloaded while this page loaded.
    if (id !== request.current) {
      return;
    }
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setLoaded({
      page: {
        events: [...page.events, ...result.data.events],
        nextCursor: result.data.nextCursor,
      },
      status: "ready",
    });
  }

  const filtered = filterKey !== "{}";
  const isEmpty = loaded.status === "ready" && loaded.page.events.length === 0;

  return (
    <div className={cn("flex w-full flex-col gap-4", className)}>
      <Toolbar
        actions={actions}
        filter={filter}
        onChange={changeFilter}
        onRefresh={() => {
          setMessage("");
          setReloads((count) => count + 1);
        }}
      />

      {filter.target ? (
        <p className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
          Showing events about{" "}
          <code className="text-foreground font-mono text-xs">
            {filter.target}
          </code>
          <Button
            onClick={() => changeFilter({ ...filter, target: undefined })}
            size="sm"
            variant="ghost"
          >
            Show all targets
          </Button>
        </p>
      ) : null}

      <p
        aria-live="polite"
        className="text-muted-foreground text-sm empty:hidden"
      >
        {message}
      </p>

      {loaded.status === "failed" ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>The audit log couldn't be loaded</EmptyTitle>
            <EmptyDescription>{loaded.error}</EmptyDescription>
          </EmptyHeader>
          <Button
            onClick={() => setReloads((count) => count + 1)}
            variant="outline"
          >
            Try again
          </Button>
        </Empty>
      ) : null}

      {isEmpty ? (
        <NoEvents filtered={filtered} onClear={() => changeFilter({})} />
      ) : null}

      {loaded.status === "failed" || isEmpty ? null : (
        <EventTable
          getLabel={getLabel}
          loaded={loaded}
          onOpen={(event) => setPanel({ event, open: true })}
        />
      )}

      {loaded.status === "ready" && loaded.page.nextCursor ? (
        <Button
          className="self-center"
          disabled={loadingMore}
          onClick={loadMore}
          variant="outline"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </Button>
      ) : null}

      {panel ? (
        <AuditEventDetails
          event={panel.event}
          eventId={panel.event.id}
          getActionLabel={getLabel}
          onFilter={(next) => {
            setPanel({ ...panel, open: false });
            changeFilter(next);
          }}
          onOpenChange={(open) => setPanel({ ...panel, open })}
          open={panel.open}
        />
      ) : null}
    </div>
  );
}
