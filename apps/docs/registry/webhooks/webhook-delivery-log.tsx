"use client";

import { useEffect, useRef, useState } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
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
  DeliveryStatusBadge,
  WebhookDeliveryDetails,
} from "@/components/webhooks/webhook-delivery-details";
import { cn } from "@/lib/utils";
import {
  getEventLabel,
  showHidden,
  type WebhookDelivery,
  type WebhookDeliveryFilter,
  type WebhookDeliveryPage,
  type WebhookDeliveryRecord,
  type WebhookEndpoint,
  type WebhookEventType,
  type WebhookSource,
} from "@/lib/webhooks/types";

export interface WebhookDeliveryLogProps {
  className?: string;
  /** Filter to start with when `filter` isn't controlled. */
  defaultFilter?: WebhookDeliveryFilter;
  /**
   * Your app's events, with names to show for them. Leave it out to hide the
   * event filter and show event codes as they are.
   */
  eventTypes?: WebhookEventType[];
  /** The deliveries to show. Set it to control filtering, for example from the URL. */
  filter?: WebhookDeliveryFilter;
  /** Called when someone changes the filter. */
  onFilterChange?: (filter: WebhookDeliveryFilter) => void;
  /**
   * Shows one endpoint's deliveries at a time, for backends that list them
   * per endpoint, such as Svix. The log opens on the first endpoint unless the
   * filter names one, and offers no "All endpoints". It needs `listEndpoints`
   * or an `endpointId` in the filter.
   */
  requireEndpoint?: boolean;
  /**
   * The calls the log makes. Without `getDelivery`, deliveries don't open;
   * without `listEndpoints`, there's no endpoint filter; without
   * `resendDelivery`, there's no Resend button.
   */
  source: Pick<WebhookSource, "listDeliveries"> &
    Partial<
      Pick<WebhookSource, "getDelivery" | "listEndpoints" | "resendDelivery">
    >;
}

/** The details sheet of one delivery. It stays mounted while it closes, so it can animate out. */
interface Panel {
  id: string;
  open: boolean;
}

type Loaded =
  | { page: WebhookDeliveryPage; status: "ready" }
  | { error: string; status: "failed" }
  | { status: "loading" };

const SKELETON_ROWS = ["first", "second", "third", "fourth"];
const FOCUS_RING =
  "rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";
const NO_EVENT_TYPES: WebhookEventType[] = [];

/** The filter without empty fields, so equal filters compare equal. */
function clean(filter: WebhookDeliveryFilter): WebhookDeliveryFilter {
  const result: WebhookDeliveryFilter = {};
  if (filter.endpointId) {
    result.endpointId = filter.endpointId;
  }
  if (filter.eventTypes && filter.eventTypes.length > 0) {
    result.eventTypes = [...filter.eventTypes].sort();
  }
  if (filter.status) {
    result.status = filter.status;
  }
  return result;
}

function EventTypeFilter({
  eventTypes,
  onChange,
  value,
}: {
  eventTypes: WebhookEventType[];
  onChange: (eventTypes: string[]) => void;
  value: string[];
}) {
  return (
    <Faceted
      items={eventTypes}
      multiple
      onValueChange={(next) => onChange(next ?? [])}
      value={value}
    >
      <FacetedTrigger asChild>
        <Button aria-label="Filter by event" className="w-48" variant="outline">
          <FacetedValue placeholder="All events" />
        </Button>
      </FacetedTrigger>
      <FacetedContent className="w-64">
        <FacetedInput aria-label="Search events" placeholder="Search…" />
        <FacetedList>
          <FacetedEmpty>No events found.</FacetedEmpty>
          <FacetedGroup>
            {eventTypes.map((eventType) => (
              <FacetedItem
                key={eventType.value}
                keywords={[eventType.label]}
                value={eventType.value}
              >
                <span className="truncate">{eventType.label}</span>
                <FacetedItemIndicator />
              </FacetedItem>
            ))}
          </FacetedGroup>
          <FacetedClear>Show all events</FacetedClear>
        </FacetedList>
      </FacetedContent>
    </Faceted>
  );
}

function Toolbar({
  endpoints,
  eventTypes,
  filter,
  onChange,
  onRefresh,
  requireEndpoint,
}: {
  endpoints: WebhookEndpoint[] | null;
  eventTypes: WebhookEventType[];
  filter: WebhookDeliveryFilter;
  onChange: (filter: WebhookDeliveryFilter) => void;
  onRefresh: () => void;
  requireEndpoint: boolean;
}) {
  const update = (changes: Partial<WebhookDeliveryFilter>) =>
    onChange({ ...filter, ...changes });
  // An endpoint picked from a link may not be in the list, such as a deleted one.
  const missingEndpoint =
    filter.endpointId &&
    !endpoints?.some((endpoint) => endpoint.id === filter.endpointId)
      ? filter.endpointId
      : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {endpoints ? (
        <NativeSelect
          aria-label="Filter by endpoint"
          className="max-w-72"
          onChange={(event) =>
            update({ endpointId: event.currentTarget.value || undefined })
          }
          value={filter.endpointId ?? ""}
        >
          {requireEndpoint ? null : (
            <NativeSelectOption value="">All endpoints</NativeSelectOption>
          )}
          {missingEndpoint ? (
            <NativeSelectOption value={missingEndpoint}>
              {showHidden(missingEndpoint)}
            </NativeSelectOption>
          ) : null}
          {endpoints.map((endpoint) => (
            <NativeSelectOption key={endpoint.id} value={endpoint.id}>
              {showHidden(endpoint.description || endpoint.url)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      ) : null}
      {eventTypes.length > 0 ? (
        <EventTypeFilter
          eventTypes={eventTypes}
          onChange={(next) => update({ eventTypes: next })}
          value={filter.eventTypes ?? []}
        />
      ) : null}
      <NativeSelect
        aria-label="Filter by status"
        onChange={(event) => {
          const { value } = event.currentTarget;
          update({
            status:
              value === "succeeded" || value === "failed" || value === "pending"
                ? value
                : undefined,
          });
        }}
        value={filter.status ?? ""}
      >
        <NativeSelectOption value="">Any status</NativeSelectOption>
        <NativeSelectOption value="succeeded">Succeeded</NativeSelectOption>
        <NativeSelectOption value="failed">Failed</NativeSelectOption>
        <NativeSelectOption value="pending">Pending</NativeSelectOption>
      </NativeSelect>
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

function DeliveryRow({
  delivery,
  endpointName,
  label,
  onOpen,
}: {
  delivery: WebhookDelivery;
  endpointName: string | null;
  label: string;
  onOpen?: () => void;
}) {
  return (
    <TableRow>
      <TableCell className="w-full max-w-0">
        <div className="flex min-w-0 flex-col">
          {onOpen ? (
            <button
              className={cn("truncate text-left font-medium", FOCUS_RING)}
              data-delivery-id={delivery.id}
              onClick={onOpen}
              type="button"
            >
              {label}
            </button>
          ) : (
            <span className="truncate font-medium">{label}</span>
          )}
          {label === delivery.eventType ? null : (
            <code className="text-muted-foreground truncate font-mono text-xs">
              {delivery.eventType}
            </code>
          )}
        </div>
      </TableCell>
      <TableCell>
        <DeliveryStatusBadge delivery={delivery} />
      </TableCell>
      <TableCell className="text-muted-foreground hidden max-w-64 truncate font-mono text-xs md:table-cell">
        {endpointName}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <RelativeTimeCard
          className="tabular-nums"
          date={delivery.createdAt}
          side="left"
        />
      </TableCell>
    </TableRow>
  );
}

function DeliveryTable({
  getEndpointName,
  getLabel,
  loaded,
  onOpen,
}: {
  getEndpointName: (delivery: WebhookDelivery) => string | null;
  getLabel: (eventType: string) => string;
  loaded: Loaded;
  onOpen?: (delivery: WebhookDelivery) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table aria-busy={loaded.status === "loading"}>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Endpoint</TableHead>
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
            ? loaded.page.deliveries.map((delivery) => (
                <DeliveryRow
                  delivery={delivery}
                  endpointName={getEndpointName(delivery)}
                  key={delivery.id}
                  label={getLabel(delivery.eventType)}
                  onOpen={onOpen ? () => onOpen(delivery) : undefined}
                />
              ))
            : null}
        </TableBody>
      </Table>
    </div>
  );
}

function NoDeliveries({
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
            hugeicons="WebhookIcon"
            lucide="WebhookIcon"
            phosphor="WebhooksLogoIcon"
            remixicon="RiWebhookLine"
            tabler="IconWebhook"
          />
        </EmptyMedia>
        <EmptyTitle>
          {filtered ? "No deliveries match these filters" : "No deliveries yet"}
        </EmptyTitle>
        <EmptyDescription>
          {filtered
            ? "Try fewer filters."
            : "Webhooks sent to your endpoints show up here."}
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
 * The filter to load. With `requireEndpoint`, the first endpoint stands in
 * until one is chosen.
 */
function effectiveFilter(
  chosen: WebhookDeliveryFilter,
  requireEndpoint: boolean,
  endpoints: WebhookEndpoint[] | null
): WebhookDeliveryFilter {
  const first = endpoints?.[0]?.id;
  return requireEndpoint && !chosen.endpointId && first
    ? { ...chosen, endpointId: first }
    : chosen;
}

/** Whether the filter narrows the list, leaving out a required endpoint. */
function isFiltered(
  filter: WebhookDeliveryFilter,
  requireEndpoint: boolean
): boolean {
  const { endpointId: _endpointId, ...narrowing } = filter;
  return JSON.stringify(requireEndpoint ? narrowing : filter) !== "{}";
}

/** What the log shows instead of its table, if anything. */
function emptyView({
  endpointsError,
  loaded,
  noEndpoint,
  waitingForEndpoints,
}: {
  endpointsError: string | null;
  loaded: Loaded;
  noEndpoint: boolean;
  waitingForEndpoints: boolean;
}): { error: string } | { empty: true } | null {
  if (loaded.status === "failed") {
    return { error: loaded.error };
  }
  if (noEndpoint && endpointsError) {
    return { error: endpointsError };
  }
  if (noEndpoint && !waitingForEndpoints) {
    return { empty: true };
  }
  if (loaded.status === "ready" && loaded.page.deliveries.length === 0) {
    return { empty: true };
  }
  return null;
}

/** The loaded list with one delivery's new status. */
function withDelivery(loaded: Loaded, delivery: WebhookDeliveryRecord): Loaded {
  if (loaded.status !== "ready") {
    return loaded;
  }
  const { attempts: _attempts, payload: _payload, ...summary } = delivery;
  return {
    page: {
      ...loaded.page,
      deliveries: loaded.page.deliveries.map((item) =>
        item.id === summary.id ? { ...item, ...summary } : item
      ),
    },
    status: "ready",
  };
}

/**
 * The webhooks your app has sent, newest first: filter by endpoint, event and
 * status, and open a delivery to see its payload, each attempt's response,
 * and to resend it. Every call goes through `source`, so the log works with
 * any backend.
 */
export function WebhookDeliveryLog({
  className,
  defaultFilter = {},
  eventTypes = NO_EVENT_TYPES,
  filter: controlledFilter,
  onFilterChange,
  requireEndpoint = false,
  source,
}: WebhookDeliveryLogProps) {
  const [ownFilter, setOwnFilter] = useState(defaultFilter);
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[] | null>(null);
  const [endpointsError, setEndpointsError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloads, setReloads] = useState(0);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [message, setMessage] = useState("");
  // Counts page requests, so a page that arrives after a newer one is dropped.
  const request = useRef(0);
  const container = useRef<HTMLDivElement>(null);
  const { getDelivery, listDeliveries, listEndpoints, resendDelivery } = source;

  const filter = effectiveFilter(
    clean(controlledFilter ?? ownFilter),
    requireEndpoint,
    endpoints
  );
  const noEndpoint = requireEndpoint && !filter.endpointId;
  // Compared as text, so a controlled filter rebuilt on every render doesn't reload.
  const filterKey = JSON.stringify(filter);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloads` is a counter that asks for a fresh page.
  useEffect(() => {
    request.current += 1;
    const id = request.current;
    setLoaded({ status: "loading" });
    if (noEndpoint) {
      return;
    }
    listDeliveries({
      filter: JSON.parse(filterKey) as WebhookDeliveryFilter,
    }).then((result) => {
      if (id === request.current) {
        setLoaded(
          result.ok
            ? { page: result.data, status: "ready" }
            : { error: result.error, status: "failed" }
        );
      }
    });
  }, [filterKey, listDeliveries, noEndpoint, reloads]);

  useEffect(() => {
    if (!listEndpoints) {
      return;
    }
    let current = true;
    listEndpoints().then((result) => {
      if (!current) {
        return;
      }
      // Without the list, the log still works, just without the endpoint filter.
      if (result.ok) {
        setEndpoints(result.data);
      } else {
        setEndpointsError(result.error);
      }
    });
    return () => {
      current = false;
    };
  }, [listEndpoints]);

  const endpointUrls = new Map(
    endpoints?.map((endpoint) => [endpoint.id, endpoint.url])
  );
  const getEndpointName = (delivery: WebhookDelivery) => {
    const url =
      delivery.endpointUrl ?? endpointUrls.get(delivery.endpointId) ?? null;
    return url === null ? null : showHidden(url);
  };
  const getLabel = (eventType: string) => getEventLabel(eventTypes, eventType);

  function changeFilter(next: WebhookDeliveryFilter) {
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
    const result = await listDeliveries({ cursor: page.nextCursor, filter });
    setLoadingMore(false);
    if (id !== request.current) {
      return;
    }
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setLoaded({
      page: {
        deliveries: [...page.deliveries, ...result.data.deliveries],
        nextCursor: result.data.nextCursor,
      },
      status: "ready",
    });
  }

  /** The sheet has no trigger of its own, so focus goes back to its row. */
  function focusRow(id: string) {
    requestAnimationFrame(() => {
      container.current
        ?.querySelector<HTMLElement>(`[data-delivery-id="${CSS.escape(id)}"]`)
        ?.focus();
    });
  }

  const view = emptyView({
    endpointsError,
    loaded,
    noEndpoint,
    waitingForEndpoints:
      noEndpoint && Boolean(listEndpoints) && endpoints === null,
  });
  const failed = view && "error" in view ? view.error : null;
  const isEmpty = Boolean(view && "empty" in view);

  return (
    <div
      className={cn("flex w-full flex-col gap-4", className)}
      ref={container}
    >
      <Toolbar
        endpoints={endpoints}
        eventTypes={eventTypes}
        filter={filter}
        onChange={changeFilter}
        onRefresh={() => {
          setMessage("");
          setReloads((count) => count + 1);
        }}
        requireEndpoint={requireEndpoint}
      />

      <p
        aria-live="polite"
        className={cn(
          "text-muted-foreground text-sm",
          // Hidden rather than removed while empty, so it's announced when it fills.
          message ? null : "sr-only"
        )}
      >
        {message}
      </p>

      {failed ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>The deliveries couldn't be loaded</EmptyTitle>
            <EmptyDescription>{failed}</EmptyDescription>
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
        <NoDeliveries
          filtered={isFiltered(filter, requireEndpoint)}
          onClear={() =>
            changeFilter(
              requireEndpoint ? { endpointId: filter.endpointId } : {}
            )
          }
        />
      ) : null}

      {failed || isEmpty ? null : (
        <DeliveryTable
          getEndpointName={getEndpointName}
          getLabel={getLabel}
          loaded={loaded}
          onOpen={
            getDelivery
              ? (delivery) => setPanel({ id: delivery.id, open: true })
              : undefined
          }
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
        <WebhookDeliveryDetails
          deliveryId={panel.id}
          eventTypes={eventTypes}
          onOpenChange={(open) => {
            setPanel({ ...panel, open });
            if (!open) {
              focusRow(panel.id);
            }
          }}
          // Shows the new status without reloading the list.
          onResent={(delivery) =>
            setLoaded((current) => withDelivery(current, delivery))
          }
          open={panel.open}
          source={{ getDelivery, resendDelivery }}
        />
      ) : null}
    </div>
  );
}
