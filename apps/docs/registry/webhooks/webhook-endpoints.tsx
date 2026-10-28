"use client";

import { useEffect, useRef, useState } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteWebhookEndpointDialog } from "@/components/webhooks/delete-webhook-endpoint-dialog";
import { SendTestEventDialog } from "@/components/webhooks/send-test-event-dialog";
import { WebhookEndpointDialog } from "@/components/webhooks/webhook-endpoint-dialog";
import { WebhookSecretDialog } from "@/components/webhooks/webhook-secret-dialog";
import { cn } from "@/lib/utils";
import {
  getEventLabel,
  showHidden,
  type WebhookEndpoint,
  type WebhookEventType,
  type WebhookSource,
} from "@/lib/webhooks/types";

export interface WebhookEndpointsProps {
  className?: string;
  /**
   * Your app's events, with names to show for them. Endpoints can pick from
   * these. Leave it out and every endpoint receives every event.
   */
  eventTypes?: WebhookEventType[];
  /** Shows an endpoint's deliveries, such as in a delivery log. Hidden when not given. */
  onViewDeliveries?: (endpoint: WebhookEndpoint) => void;
  /**
   * The calls the manager makes. Each action shows only when its call is
   * given, so a read-only list needs only `listEndpoints`.
   */
  source: Pick<WebhookSource, "listEndpoints"> &
    Partial<
      Pick<
        WebhookSource,
        | "createEndpoint"
        | "deleteEndpoint"
        | "revealSecret"
        | "rotateSecret"
        | "sendTestEvent"
        | "updateEndpoint"
      >
    >;
}

type DialogState =
  | { kind: "create" }
  | { endpoint: WebhookEndpoint; kind: "delete" | "edit" | "test" }
  | { endpoint: WebhookEndpoint; kind: "secret"; secret: string | null };

/** The open dialog. It stays mounted while it closes, so it can animate out. */
interface OpenDialog {
  dialog: DialogState;
  /** New for each opening, so a dialog never shows what the last one held. */
  key: number;
  open: boolean;
}

type Loaded =
  | { endpoints: WebhookEndpoint[]; status: "ready" }
  | { error: string; status: "failed" }
  | { status: "loading" };

const SKELETON_ROWS = ["first", "second", "third"];
const NO_EVENT_TYPES: WebhookEventType[] = [];
/** Event names shown in a row before the rest are counted. */
const SHOWN_EVENTS = 2;

function describeEvents(
  endpoint: WebhookEndpoint,
  eventTypes: WebhookEventType[]
): string {
  const { length } = endpoint.eventTypes;
  if (length === 0) {
    return "All events";
  }
  const names = endpoint.eventTypes
    .slice(0, SHOWN_EVENTS)
    .map((value) => getEventLabel(eventTypes, value))
    .join(", ");
  return length > SHOWN_EVENTS
    ? `${names} and ${length - SHOWN_EVENTS} more`
    : names;
}

interface EndpointActionHandlers {
  onDelete?: () => void;
  onEdit?: () => void;
  onSecret?: () => void;
  onTest?: () => void;
  onViewDeliveries?: () => void;
}

function EndpointActions({
  endpoint,
  onDelete,
  onEdit,
  onSecret,
  onTest,
  onViewDeliveries,
}: EndpointActionHandlers & { endpoint: WebhookEndpoint }) {
  const canView = Boolean(onViewDeliveries || onTest || onSecret);
  const canChange = Boolean(onEdit || onDelete);
  if (!(canView || canChange)) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Actions for ${showHidden(endpoint.url)}`}
          data-endpoint-actions={endpoint.id}
          size="icon-sm"
          variant="ghost"
        >
          <IconPlaceholder
            hugeicons="MoreHorizontalIcon"
            lucide="MoreHorizontalIcon"
            phosphor="DotsThreeIcon"
            remixicon="RiMoreLine"
            tabler="IconDots"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {canView ? (
          <DropdownMenuGroup>
            {onViewDeliveries ? (
              <DropdownMenuItem onClick={onViewDeliveries}>
                <IconPlaceholder
                  hugeicons="LeftToRightListBulletIcon"
                  lucide="ListIcon"
                  phosphor="ListBulletsIcon"
                  remixicon="RiListUnordered"
                  tabler="IconList"
                />
                View deliveries
              </DropdownMenuItem>
            ) : null}
            {onTest ? (
              <DropdownMenuItem onClick={onTest}>
                <IconPlaceholder
                  hugeicons="SentIcon"
                  lucide="SendIcon"
                  phosphor="PaperPlaneTiltIcon"
                  remixicon="RiSendPlaneLine"
                  tabler="IconSend"
                />
                Send test event
              </DropdownMenuItem>
            ) : null}
            {onSecret ? (
              <DropdownMenuItem onClick={onSecret}>
                <IconPlaceholder
                  hugeicons="Key01Icon"
                  lucide="KeyRoundIcon"
                  phosphor="KeyIcon"
                  remixicon="RiKey2Line"
                  tabler="IconKey"
                />
                Signing secret
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        ) : null}
        {canView && canChange ? <DropdownMenuSeparator /> : null}
        {canChange ? (
          <DropdownMenuGroup>
            {onEdit ? (
              <DropdownMenuItem onClick={onEdit}>
                <IconPlaceholder
                  hugeicons="Edit02Icon"
                  lucide="PencilIcon"
                  phosphor="PencilSimpleIcon"
                  remixicon="RiPencilLine"
                  tabler="IconPencil"
                />
                Edit
              </DropdownMenuItem>
            ) : null}
            {onDelete ? (
              <DropdownMenuItem onClick={onDelete} variant="destructive">
                <IconPlaceholder
                  hugeicons="Delete02Icon"
                  lucide="Trash2Icon"
                  phosphor="TrashIcon"
                  remixicon="RiDeleteBinLine"
                  tabler="IconTrash"
                />
                Delete
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EndpointRow({
  actions,
  endpoint,
  eventTypes,
  onToggle,
  toggling,
}: {
  actions: EndpointActionHandlers;
  endpoint: WebhookEndpoint;
  eventTypes: WebhookEventType[];
  onToggle?: (enabled: boolean) => void;
  toggling: boolean;
}) {
  const events = describeEvents(endpoint, eventTypes);
  const url = showHidden(endpoint.url);
  return (
    <TableRow>
      <TableCell className="w-full max-w-0">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-mono text-sm" title={url}>
            {url}
          </span>
          {endpoint.description ? (
            <span className="text-muted-foreground truncate text-xs">
              {showHidden(endpoint.description)}
            </span>
          ) : null}
          <span className="text-muted-foreground truncate text-xs md:hidden">
            {events}
          </span>
          {!endpoint.enabled && endpoint.disabledReason ? (
            <span className="text-destructive text-xs">
              {showHidden(endpoint.disabledReason)}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground hidden max-w-64 truncate md:table-cell">
        {events}
      </TableCell>
      <TableCell>
        {onToggle ? (
          <Switch
            aria-label={`Send webhooks to ${url}`}
            checked={endpoint.enabled}
            disabled={toggling}
            onCheckedChange={(checked) => onToggle(checked === true)}
          />
        ) : (
          <Badge variant={endpoint.enabled ? "secondary" : "outline"}>
            {endpoint.enabled ? "On" : "Off"}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <EndpointActions endpoint={endpoint} {...actions} />
      </TableCell>
    </TableRow>
  );
}

function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <Button data-add-endpoint="" onClick={onClick}>
      <IconPlaceholder
        aria-hidden="true"
        hugeicons="PlusSignIcon"
        lucide="PlusIcon"
        phosphor="PlusIcon"
        remixicon="RiAddLine"
        tabler="IconPlus"
      />
      Add endpoint
    </Button>
  );
}

/** The dialog that is open, wired to the source. */
function EndpointDialogs({
  dialog,
  eventTypes,
  onCreated,
  onDeleted,
  onOpenChange: onDialogChange,
  onTestSent,
  onUpdated,
  source,
}: {
  dialog: OpenDialog;
  eventTypes: WebhookEventType[];
  onCreated: (endpoint: WebhookEndpoint, secret: string | null) => void;
  onDeleted: (id: string) => void;
  onOpenChange: (key: number, open: boolean) => void;
  onTestSent: (message: string) => void;
  onUpdated: (endpoint: WebhookEndpoint) => void;
  source: WebhookEndpointsProps["source"];
}) {
  const { open } = dialog;
  const shown = dialog.dialog;
  const onOpenChange = (isOpen: boolean) => onDialogChange(dialog.key, isOpen);
  const {
    createEndpoint,
    deleteEndpoint,
    revealSecret,
    rotateSecret,
    sendTestEvent,
    updateEndpoint,
  } = source;

  if (shown.kind === "create") {
    return createEndpoint ? (
      <WebhookEndpointDialog
        eventTypes={eventTypes}
        onOpenChange={onOpenChange}
        onSave={async (input) => {
          const result = await createEndpoint(input);
          if (result.ok) {
            onCreated(result.data.endpoint, result.data.secret);
          }
          return result;
        }}
        open={open}
      />
    ) : null;
  }

  const { endpoint } = shown;
  switch (shown.kind) {
    case "edit":
      return updateEndpoint ? (
        <WebhookEndpointDialog
          endpoint={endpoint}
          eventTypes={eventTypes}
          onOpenChange={onOpenChange}
          onSave={async (input) => {
            const result = await updateEndpoint(endpoint.id, input);
            if (result.ok) {
              onUpdated(result.data);
            }
            return result;
          }}
          open={open}
        />
      ) : null;
    case "secret":
      return (
        <WebhookSecretDialog
          endpoint={endpoint}
          initialSecret={shown.secret}
          onOpenChange={onOpenChange}
          open={open}
          revealSecret={revealSecret}
          rotateSecret={rotateSecret}
        />
      );
    case "test":
      return sendTestEvent ? (
        <SendTestEventDialog
          endpoint={endpoint}
          eventTypes={eventTypes}
          onOpenChange={onOpenChange}
          onSend={async (eventType) => {
            const result = await sendTestEvent({
              endpointId: endpoint.id,
              eventType,
            });
            if (result.ok) {
              onTestSent(
                `A test ${getEventLabel(eventTypes, eventType)} event was sent to ${showHidden(endpoint.url)}.`
              );
            }
            return result;
          }}
          open={open}
        />
      ) : null;
    default:
      return deleteEndpoint ? (
        <DeleteWebhookEndpointDialog
          endpoint={endpoint}
          onDelete={async () => {
            const result = await deleteEndpoint(endpoint.id);
            if (result.ok) {
              onDeleted(endpoint.id);
            }
            return result;
          }}
          onOpenChange={onOpenChange}
          open={open}
        />
      ) : null;
  }
}

/**
 * The endpoints your customers webhooks go to: add, edit, turn off and
 * delete them, send a test event, and see or rotate their signing secrets.
 * Every call goes through `source`, so it works with any backend.
 */
export function WebhookEndpoints({
  className,
  eventTypes = NO_EVENT_TYPES,
  onViewDeliveries,
  source,
}: WebhookEndpointsProps) {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [reloads, setReloads] = useState(0);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [toggling, setToggling] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const dialogCount = useRef(0);
  const container = useRef<HTMLDivElement>(null);
  // Where focus goes when the open dialog closes, as it has no trigger.
  const returnFocus = useRef("[data-add-endpoint]");
  // Set when an endpoint is created with a secret to show once the form closes.
  const createdSecret = useRef<{
    endpoint: WebhookEndpoint;
    secret: string;
  } | null>(null);
  const {
    createEndpoint,
    deleteEndpoint,
    listEndpoints,
    revealSecret,
    rotateSecret,
    sendTestEvent,
    updateEndpoint,
  } = source;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloads` is a counter that asks for a fresh list.
  useEffect(() => {
    let current = true;
    setLoaded({ status: "loading" });
    listEndpoints().then((result) => {
      if (current) {
        setLoaded(
          result.ok
            ? { endpoints: result.data, status: "ready" }
            : { error: result.error, status: "failed" }
        );
      }
    });
    return () => {
      current = false;
    };
  }, [listEndpoints, reloads]);

  function open(next: DialogState) {
    returnFocus.current =
      next.kind === "create"
        ? "[data-add-endpoint]"
        : `[data-endpoint-actions="${CSS.escape(next.endpoint.id)}"]`;
    dialogCount.current += 1;
    setMessage("");
    setDialog({ dialog: next, key: dialogCount.current, open: true });
  }

  function changeOpen(key: number, isOpen: boolean) {
    // Such as a save that finished after its dialog was dismissed.
    if (key !== dialogCount.current) {
      return;
    }
    const created = createdSecret.current;
    if (!isOpen && created) {
      createdSecret.current = null;
      open({
        endpoint: created.endpoint,
        kind: "secret",
        secret: created.secret,
      });
      return;
    }
    setDialog((shown) => (shown ? { ...shown, open: isOpen } : shown));
    if (!isOpen) {
      const selector = returnFocus.current;
      requestAnimationFrame(() => {
        const target =
          container.current?.querySelector<HTMLElement>(selector) ??
          container.current?.querySelector<HTMLElement>("[data-add-endpoint]");
        target?.focus();
      });
    }
  }

  /** Applies a change to the loaded list. */
  function updateList(
    change: (endpoints: WebhookEndpoint[]) => WebhookEndpoint[]
  ) {
    setLoaded((shown) =>
      shown.status === "ready"
        ? { endpoints: change(shown.endpoints), status: "ready" }
        : shown
    );
  }

  function replace(endpoint: WebhookEndpoint) {
    updateList((endpoints) =>
      endpoints.map((item) => (item.id === endpoint.id ? endpoint : item))
    );
  }

  function setEnabled(id: string, enabled: boolean) {
    updateList((endpoints) =>
      endpoints.map((item) => (item.id === id ? { ...item, enabled } : item))
    );
  }

  async function toggle(endpoint: WebhookEndpoint, enabled: boolean) {
    if (!updateEndpoint) {
      return;
    }
    setMessage("");
    setToggling((ids) => [...ids, endpoint.id]);
    setEnabled(endpoint.id, enabled);
    const result = await updateEndpoint(endpoint.id, { enabled });
    setToggling((ids) => ids.filter((id) => id !== endpoint.id));
    if (result.ok) {
      replace(result.data);
    } else {
      setEnabled(endpoint.id, !enabled);
      setMessage(result.error);
    }
  }

  function actionsFor(endpoint: WebhookEndpoint): EndpointActionHandlers {
    return {
      onDelete: deleteEndpoint
        ? () => open({ endpoint, kind: "delete" })
        : undefined,
      onEdit: updateEndpoint
        ? () => open({ endpoint, kind: "edit" })
        : undefined,
      onSecret:
        revealSecret || rotateSecret
          ? () => open({ endpoint, kind: "secret", secret: null })
          : undefined,
      onTest:
        sendTestEvent && eventTypes.length > 0
          ? () => open({ endpoint, kind: "test" })
          : undefined,
      onViewDeliveries: onViewDeliveries
        ? () => onViewDeliveries(endpoint)
        : undefined,
    };
  }

  const isEmpty = loaded.status === "ready" && loaded.endpoints.length === 0;

  return (
    <div
      className={cn("flex w-full flex-col gap-4", className)}
      ref={container}
    >
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button
          aria-label="Refresh"
          onClick={() => {
            setMessage("");
            setReloads((count) => count + 1);
          }}
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
        {createEndpoint ? (
          <AddButton onClick={() => open({ kind: "create" })} />
        ) : null}
      </div>

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

      {loaded.status === "failed" ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>The endpoints couldn't be loaded</EmptyTitle>
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
            <EmptyTitle>No endpoints yet</EmptyTitle>
            <EmptyDescription>
              Add a URL to receive webhooks when things happen in your account.
            </EmptyDescription>
          </EmptyHeader>
          {createEndpoint ? (
            <AddButton onClick={() => open({ kind: "create" })} />
          ) : null}
        </Empty>
      ) : null}

      {loaded.status === "failed" || isEmpty ? null : (
        <div className="overflow-hidden rounded-lg border">
          <Table aria-busy={loaded.status === "loading"}>
            <TableHeader>
              <TableRow>
                <TableHead>Endpoint</TableHead>
                <TableHead className="hidden md:table-cell">Events</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loaded.status === "loading"
                ? SKELETON_ROWS.map((row) => (
                    <TableRow key={row}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-5 w-full max-w-96" />
                      </TableCell>
                    </TableRow>
                  ))
                : null}
              {loaded.status === "ready"
                ? loaded.endpoints.map((endpoint) => (
                    <EndpointRow
                      actions={actionsFor(endpoint)}
                      endpoint={endpoint}
                      eventTypes={eventTypes}
                      key={endpoint.id}
                      onToggle={
                        updateEndpoint
                          ? (enabled) => toggle(endpoint, enabled)
                          : undefined
                      }
                      toggling={toggling.includes(endpoint.id)}
                    />
                  ))
                : null}
            </TableBody>
          </Table>
        </div>
      )}

      {dialog ? (
        <EndpointDialogs
          dialog={dialog}
          eventTypes={eventTypes}
          key={dialog.key}
          onCreated={(endpoint, secret) => {
            updateList((endpoints) => [...endpoints, endpoint]);
            if (secret) {
              createdSecret.current = { endpoint, secret };
            }
          }}
          onDeleted={(id) =>
            updateList((endpoints) =>
              endpoints.filter((item) => item.id !== id)
            )
          }
          onOpenChange={changeOpen}
          onTestSent={setMessage}
          onUpdated={replace}
          source={source}
        />
      ) : null}
    </div>
  );
}
