"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
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
import { cn } from "@/lib/utils";
import {
  getEventLabel,
  showHidden,
  type WebhookAttempt,
  type WebhookDelivery,
  type WebhookDeliveryRecord,
  type WebhookEventType,
  type WebhookSource,
} from "@/lib/webhooks/types";

export interface WebhookDeliveryDetailsProps {
  /** Id of the delivery to show. */
  deliveryId: string;
  /** Names for events, such as "Invoice paid". */
  eventTypes?: WebhookEventType[];
  onOpenChange: (open: boolean) => void;
  /**
   * Called with the delivery, loaded again, after a resend is accepted, so a
   * list can show its new status.
   */
  onResent?: (delivery: WebhookDeliveryRecord) => void;
  open: boolean;
  /** Reads the delivery, and resends it if `resendDelivery` is given. */
  source: Pick<WebhookSource, "getDelivery" | "resendDelivery">;
}

/** What was loaded, and for which delivery. */
type State =
  | { delivery: WebhookDeliveryRecord; id: string; status: "ready" }
  | { error: string; id: string; status: "failed" }
  | { status: "loading" };

const NO_MESSAGE = { error: false, text: "" };
/** Bodies longer than this are cut, so a huge response can't freeze the page. */
const MAX_BODY_LENGTH = 100_000;
const NO_EVENT_TYPES: WebhookEventType[] = [];

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "medium",
});

function formatDate(iso: string): string {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? iso : dateFormat.format(time);
}

/** A body as readable text: JSON indented, anything else as it is. */
function formatBody(body: unknown): string {
  if (typeof body === "string") {
    // Too long to show whole, so it's cut as it is rather than indented.
    if (body.length > MAX_BODY_LENGTH) {
      return body;
    }
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  return body === undefined ? "" : JSON.stringify(body, null, 2);
}

/** The status of a delivery as a badge. */
export function DeliveryStatusBadge({
  delivery,
}: {
  delivery: Pick<WebhookDelivery, "attemptCount" | "nextAttemptAt" | "status">;
}) {
  if (delivery.status === "succeeded") {
    return <Badge variant="secondary">Succeeded</Badge>;
  }
  if (delivery.status === "failed") {
    return <Badge variant="destructive">Failed</Badge>;
  }
  const retrying =
    Boolean(delivery.nextAttemptAt) && delivery.attemptCount !== 0;
  return <Badge variant="outline">{retrying ? "Retrying" : "Pending"}</Badge>;
}

function Detail({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm break-words">{children}</dd>
    </div>
  );
}

function CopyButton({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Button aria-label={label} onClick={copy} size="sm" variant="outline">
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
  );
}

/**
 * A body shown as plain text, never as HTML, whatever its content type says:
 * the receiving endpoint chose what it contains.
 */
function Body({ className, text }: { className?: string; text: string }) {
  const cut = text.length > MAX_BODY_LENGTH;
  return (
    <>
      <pre
        className={cn(
          "bg-muted max-h-80 overflow-auto rounded-lg p-3 font-mono text-xs break-all whitespace-pre-wrap",
          className
        )}
      >
        {showHidden(cut ? text.slice(0, MAX_BODY_LENGTH) : text)}
      </pre>
      {cut ? (
        <p className="text-muted-foreground mt-1 text-xs">
          Showing the first {MAX_BODY_LENGTH.toLocaleString()} characters.
        </p>
      ) : null}
    </>
  );
}

function Headers({
  headers,
  title,
}: {
  headers: Record<string, string>;
  title: string;
}) {
  const entries = Object.entries(headers);
  if (entries.length === 0) {
    return null;
  }
  return (
    <div>
      <h4 className="text-muted-foreground text-xs font-medium">{title}</h4>
      <dl className="mt-1 grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1 font-mono text-xs">
        {entries.map(([name, value]) => (
          <div className="contents" key={name}>
            <dt className="text-muted-foreground break-all">
              {showHidden(name)}
            </dt>
            <dd className="break-all">{showHidden(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function attemptStatus(attempt: WebhookAttempt): string {
  if (attempt.statusCode !== null) {
    return String(attempt.statusCode);
  }
  return attempt.succeeded ? "Sent" : "No response";
}

function Attempt({
  attempt,
  open,
}: {
  attempt: WebhookAttempt;
  open: boolean;
}) {
  const hasBody =
    attempt.responseBody !== null &&
    attempt.responseBody !== undefined &&
    attempt.responseBody !== "";

  // The body is only rendered once opened, so long responses cost nothing
  // until someone wants to read them.
  const [expanded, setExpanded] = useState(open);

  return (
    <li>
      <details
        className="group rounded-lg border"
        onToggle={(event) => setExpanded(event.currentTarget.open)}
        open={expanded}
      >
        <summary className="hover:bg-muted/50 focus-visible:ring-ring/50 flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-3 py-2 text-sm outline-none focus-visible:ring-[3px] [&::-webkit-details-marker]:hidden">
          <IconPlaceholder
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-90"
            hugeicons="ArrowRight01Icon"
            lucide="ChevronRightIcon"
            phosphor="CaretRightIcon"
            remixicon="RiArrowRightSLine"
            tabler="IconChevronRight"
          />
          <Badge
            className="font-mono"
            variant={attempt.succeeded ? "secondary" : "destructive"}
          >
            {attemptStatus(attempt)}
          </Badge>
          <time className="tabular-nums" dateTime={attempt.attemptedAt}>
            {formatDate(attempt.attemptedAt)}
          </time>
          {typeof attempt.durationMs === "number" ? (
            <span className="text-muted-foreground tabular-nums">
              {attempt.durationMs.toLocaleString()} ms
            </span>
          ) : null}
          {attempt.trigger === "manual" ? (
            <Badge variant="outline">Resent</Badge>
          ) : null}
        </summary>
        {expanded ? (
          <div className="flex flex-col gap-3 border-t px-3 py-3">
            {attempt.url ? (
              <p className="text-muted-foreground font-mono text-xs break-all">
                {showHidden(attempt.url)}
              </p>
            ) : null}
            {attempt.error ? (
              <p className="text-destructive text-sm break-words">
                {showHidden(attempt.error)}
              </p>
            ) : null}
            <div>
              <h4 className="text-muted-foreground text-xs font-medium">
                Response body
              </h4>
              {hasBody ? (
                <Body
                  className="mt-1"
                  text={formatBody(attempt.responseBody)}
                />
              ) : (
                <p className="text-muted-foreground mt-1 text-sm">Empty</p>
              )}
            </div>
            {attempt.responseHeaders ? (
              <Headers
                headers={attempt.responseHeaders}
                title="Response headers"
              />
            ) : null}
            {attempt.requestHeaders ? (
              <Headers
                headers={attempt.requestHeaders}
                title="Request headers"
              />
            ) : null}
          </div>
        ) : null}
      </details>
    </li>
  );
}

function Summary({
  delivery,
  label,
}: {
  delivery: WebhookDeliveryRecord;
  label: string;
}) {
  return (
    <dl className="flex flex-col gap-3">
      <Detail label="Event">
        <span className="flex flex-wrap items-center gap-2">
          {label === delivery.eventType ? null : <span>{label}</span>}
          <code className="font-mono text-xs">{delivery.eventType}</code>
        </span>
      </Detail>
      <Detail label="Status">
        <span className="flex flex-wrap items-center gap-2">
          <DeliveryStatusBadge delivery={delivery} />
          {delivery.status === "pending" && delivery.nextAttemptAt ? (
            <span className="text-muted-foreground">
              Next try{" "}
              <time dateTime={delivery.nextAttemptAt}>
                {formatDate(delivery.nextAttemptAt)}
              </time>
            </span>
          ) : null}
        </span>
      </Detail>
      {delivery.endpointUrl ? (
        <Detail label="Endpoint">
          <span className="font-mono text-xs break-all">
            {showHidden(delivery.endpointUrl)}
          </span>
        </Detail>
      ) : null}
      {delivery.messageId ? (
        <Detail label="Message id">
          <span className="font-mono text-xs break-all">
            {delivery.messageId}
          </span>
        </Detail>
      ) : null}
      <Detail label="Created">
        <time dateTime={delivery.createdAt}>
          {formatDate(delivery.createdAt)}
        </time>
      </Detail>
    </dl>
  );
}

function Resend({
  deliveryId,
  onResent,
  resendDelivery,
}: {
  deliveryId: string;
  onResent: () => void;
  resendDelivery: NonNullable<WebhookSource["resendDelivery"]>;
}) {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState(NO_MESSAGE);

  async function resend() {
    setPending(true);
    setMessage(NO_MESSAGE);
    const result = await resendDelivery(deliveryId);
    setPending(false);
    if (result.ok) {
      setMessage({ error: false, text: "Sent again." });
      onResent();
    } else {
      setMessage({ error: true, text: result.error });
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled={pending} onClick={resend} size="sm" variant="outline">
        <IconPlaceholder
          aria-hidden="true"
          hugeicons="SentIcon"
          lucide="SendIcon"
          phosphor="PaperPlaneTiltIcon"
          remixicon="RiSendPlaneLine"
          tabler="IconSend"
        />
        {pending ? "Resending…" : "Resend"}
      </Button>
      <p
        aria-live="polite"
        className={cn(
          "text-sm",
          message.error ? "text-destructive" : "text-muted-foreground",
          // Hidden rather than removed while empty, so it's announced when it fills.
          message.text ? null : "sr-only"
        )}
      >
        {message.text}
      </p>
    </div>
  );
}

function Content({
  delivery,
  label,
  onResent,
  resendDelivery,
}: {
  delivery: WebhookDeliveryRecord;
  label: string;
  onResent: () => void;
  resendDelivery?: WebhookSource["resendDelivery"];
}) {
  const payload = formatBody(delivery.payload);
  return (
    <div className="flex flex-col gap-6">
      <Summary delivery={delivery} label={label} />
      {resendDelivery ? (
        <Resend
          deliveryId={delivery.id}
          onResent={onResent}
          resendDelivery={resendDelivery}
        />
      ) : null}
      <section>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Payload</h3>
          <CopyButton label="Copy the payload" text={payload} />
        </div>
        <Body className="mt-2" text={payload} />
      </section>
      <section>
        <h3 className="text-sm font-medium">
          Attempts
          <span className="text-muted-foreground ml-2 font-normal tabular-nums">
            {delivery.attempts.length}
          </span>
        </h3>
        {delivery.attempts.length > 0 ? (
          <ol className="mt-2 flex flex-col gap-2">
            {delivery.attempts.map((attempt, index) => (
              <Attempt attempt={attempt} key={attempt.id} open={index === 0} />
            ))}
          </ol>
        ) : (
          <p className="text-muted-foreground mt-2 text-sm">
            It hasn't been sent yet.
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * A side sheet with one webhook delivery: its status, the payload that was
 * sent, and what the endpoint answered to each attempt, with a button to
 * send it again.
 */
export function WebhookDeliveryDetails({
  deliveryId,
  eventTypes = NO_EVENT_TYPES,
  onOpenChange,
  onResent,
  open,
  source,
}: WebhookDeliveryDetailsProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloads, setReloads] = useState(0);
  // Set by a resend, so the copy loaded next is passed to `onResent`.
  const resent = useRef(false);
  const onResentRef = useRef(onResent);
  onResentRef.current = onResent;
  const { getDelivery, resendDelivery } = source;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloads` is a counter that asks for a fresh copy.
  useEffect(() => {
    if (!open) {
      return;
    }
    if (!getDelivery) {
      setState({
        error: "The delivery can't be loaded.",
        id: deliveryId,
        status: "failed",
      });
      return;
    }
    let current = true;
    getDelivery(deliveryId).then((result) => {
      if (!current) {
        return;
      }
      setState(
        result.ok
          ? { delivery: result.data, id: deliveryId, status: "ready" }
          : { error: result.error, id: deliveryId, status: "failed" }
      );
      if (result.ok && resent.current) {
        resent.current = false;
        onResentRef.current?.(result.data);
      }
    });
    return () => {
      current = false;
    };
  }, [deliveryId, getDelivery, open, reloads]);

  // A different delivery starts from a skeleton rather than the last one.
  const shown: State =
    state.status !== "loading" && state.id !== deliveryId
      ? { status: "loading" }
      : state;
  const title =
    shown.status === "ready"
      ? getEventLabel(eventTypes, shown.delivery.eventType)
      : "Delivery";

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="break-words">{title}</SheetTitle>
          <SheetDescription>Webhook delivery</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          {shown.status === "loading" ? (
            <div aria-busy="true" className="flex flex-col gap-3">
              <span className="sr-only">Loading the delivery</span>
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : null}
          {shown.status === "failed" ? (
            <p className="text-destructive text-sm" role="alert">
              {shown.error}
            </p>
          ) : null}
          {shown.status === "ready" ? (
            <Content
              delivery={shown.delivery}
              // Keyed so a resend message doesn't carry over to another delivery.
              key={shown.delivery.id}
              label={title}
              onResent={() => {
                resent.current = true;
                setReloads((count) => count + 1);
              }}
              resendDelivery={resendDelivery}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
