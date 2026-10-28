"use client";

import { useEffect, useRef, useState } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  CustomDomain,
  DnsRecord,
  DnsRecordPurpose,
  DomainResult,
} from "@/lib/domains/types";
import { cn } from "@/lib/utils";

export interface DomainSetupProps {
  /** Checks the domain again on its own until it's active. Defaults to true. */
  autoCheck?: boolean;
  className?: string;
  domain: CustomDomain;
  /** Called with the domain after each check, so a list can show its new state. */
  onChange?: (domain: CustomDomain) => void;
  /**
   * Checks the domain's DNS again. `manual` is true when someone chose Check
   * now, so your backend can keep slower or costlier refreshes to those.
   * Leave it out to hide Check now and automatic checks.
   */
  onCheck?: (options: {
    manual: boolean;
  }) => Promise<DomainResult<CustomDomain>>;
}

/** Seconds before each automatic check. The last one repeats. */
const CHECK_DELAYS = [10, 20, 30, 60, 120, 300];
/** Automatic checks stop after this long. Check now starts them again. */
const AUTO_CHECK_LIMIT_MS = 60 * 60 * 1000;
/** Each wait varies by this much either way, so many domains don't check at once. */
const JITTER = 0.2;
const COPIED_MS = 2000;

const PURPOSES: Record<DnsRecordPurpose, string> = {
  certificate: "Lets a certificate be issued for the domain",
  ownership: "Proves you own the domain",
  routing: "Sends the domain's traffic here",
};

const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

/** Whether the domain serves the app with its certificate in place. */
export function isDomainLive(domain: CustomDomain): boolean {
  return (
    domain.status === "active" &&
    (domain.certificate === undefined ||
      domain.certificate === null ||
      domain.certificate === "active")
  );
}

/** Whether checking again could still make the domain active. */
function isWaiting(domain: CustomDomain): boolean {
  return (
    !isDomainLive(domain) &&
    domain.status !== "failed" &&
    domain.certificate !== "failed"
  );
}

/** The status of a domain as a badge. */
export function DomainStatusBadge({ domain }: { domain: CustomDomain }) {
  if (domain.status === "failed" || domain.certificate === "failed") {
    return <Badge variant="destructive">Failed</Badge>;
  }
  if (domain.status === "pending") {
    return <Badge variant="outline">Waiting for DNS</Badge>;
  }
  if (!isDomainLive(domain)) {
    return <Badge variant="outline">Issuing certificate</Badge>;
  }
  return <Badge variant="secondary">Active</Badge>;
}

/** Copies a record's name or value, and says so. */
function CopyValue({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-start gap-2">
      <code className="bg-muted min-w-0 flex-1 rounded-md px-2 py-1.5 font-mono text-xs break-all">
        {value}
      </code>
      <Button
        aria-label={`Copy the ${label}`}
        onClick={copy}
        size="icon-sm"
        type="button"
        variant="outline"
      >
        {/* Two placeholders, as the shadcn CLI reads each one's names as written. */}
        {copied ? (
          <IconPlaceholder
            aria-hidden="true"
            hugeicons="Tick02Icon"
            lucide="CheckIcon"
            phosphor="CheckIcon"
            remixicon="RiCheckLine"
            tabler="IconCheck"
          />
        ) : (
          <IconPlaceholder
            aria-hidden="true"
            hugeicons="Copy01Icon"
            lucide="CopyIcon"
            phosphor="CopyIcon"
            remixicon="RiFileCopyLine"
            tabler="IconCopy"
          />
        )}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? `Copied the ${label}.` : ""}
      </span>
    </div>
  );
}

function RecordStatus({ record }: { record: DnsRecord }) {
  if (record.action === "remove") {
    return (
      <Badge className="ml-auto" variant="outline">
        {record.status === "found" ? "Still there" : "Removed"}
      </Badge>
    );
  }
  if (!record.status) {
    return null;
  }
  return (
    <Badge
      className="ml-auto"
      variant={record.status === "found" ? "secondary" : "outline"}
    >
      {record.status === "found" ? "Found" : "Not found yet"}
    </Badge>
  );
}

function Record({ record }: { record: DnsRecord }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="font-mono" variant="outline">
          {record.type}
        </Badge>
        <span className="text-muted-foreground text-sm">
          {record.action === "remove"
            ? "Stops the domain from working"
            : PURPOSES[record.purpose]}
        </span>
        <RecordStatus record={record} />
      </div>
      <dl className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground text-xs">Name</dt>
          <dd>
            <CopyValue
              label={`${record.type} record's name`}
              value={record.name}
            />
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted-foreground text-xs">Value</dt>
          <dd>
            <CopyValue
              label={`${record.type} record's value`}
              value={record.value}
            />
          </dd>
        </div>
      </dl>
      {record.note ? (
        <p className="text-muted-foreground text-xs">{record.note}</p>
      ) : null}
    </li>
  );
}

function recordKey(record: DnsRecord): string {
  return `${record.action ?? "add"}-${record.type}-${record.name}-${record.value}`;
}

function Records({ live, records }: { live: boolean; records: DnsRecord[] }) {
  const toAdd = records.filter((record) => record.action !== "remove");
  const toRemove = records.filter((record) => record.action === "remove");
  let intro =
    "Add these DNS records where you manage the domain, such as your registrar or DNS provider.";
  if (live) {
    intro = "These DNS records connect the domain.";
  }
  return (
    <div className="flex flex-col gap-2">
      {toAdd.length > 0 ? (
        <>
          <p className="text-sm">{intro}</p>
          <ul className="flex flex-col gap-2">
            {toAdd.map((record) => (
              <Record key={recordKey(record)} record={record} />
            ))}
          </ul>
        </>
      ) : null}
      {toRemove.length > 0 ? (
        <>
          <p className="text-sm">
            Remove these DNS records, which get in the way:
          </p>
          <ul className="flex flex-col gap-2">
            {toRemove.map((record) => (
              <Record key={recordKey(record)} record={record} />
            ))}
          </ul>
        </>
      ) : null}
      <p className="text-muted-foreground text-xs">
        Some DNS providers add your domain to the end of each name. If yours
        does, enter only the part before it.
      </p>
    </div>
  );
}

/** What to announce after a check, if anything. */
function describeChange(before: CustomDomain, after: CustomDomain): string {
  if (isDomainLive(after) && !isDomainLive(before)) {
    return `${after.hostname} is active.`;
  }
  if (!isWaiting(after) && isWaiting(before)) {
    return `${after.hostname} couldn't be connected.`;
  }
  return "";
}

/**
 * Waits for the page to be visible, so a hidden tab doesn't keep checking.
 * Returns a function that stops waiting.
 */
function whenVisible(callback: () => void): () => void {
  if (document.visibilityState === "visible") {
    callback();
    return () => undefined;
  }
  const listener = () => {
    if (document.visibilityState === "visible") {
      document.removeEventListener("visibilitychange", listener);
      callback();
    }
  };
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
}

/** The wait before automatic check number `attempt`, with some jitter. */
function delayFor(attempt: number): number {
  const seconds =
    CHECK_DELAYS[Math.min(attempt, CHECK_DELAYS.length - 1)] ?? 300;
  return seconds * 1000 * (1 - JITTER + Math.random() * 2 * JITTER);
}

/**
 * The DNS records a customer adds to connect a domain, each with a copy
 * button, and whether they've been found. Until the domain is active, it
 * checks again on its own, waiting longer each time.
 *
 * Give it `key={domain.id}` when it can switch to another domain, so it
 * starts fresh for each one.
 */
export function DomainSetup({
  autoCheck = true,
  className,
  domain,
  onChange,
  onCheck,
}: DomainSetupProps) {
  // The domain as last checked here, until the parent passes a new one.
  const [shown, setShown] = useState(domain);
  const [given, setGiven] = useState(domain);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState({ manual: false, text: "" });
  const [announcement, setAnnouncement] = useState("");
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  // Counts automatic checks for the backoff, and Check now restarts it.
  const [attempt, setAttempt] = useState(0);
  const [restarts, setRestarts] = useState(0);
  // Times are shown only in the browser, so they match its time zone.
  const [mounted, setMounted] = useState(false);
  const startedAt = useRef(Date.now());
  // Counts checks, so only the newest one's result is used.
  const request = useRef(0);
  // The newest check that has finished. While it lags, a check is running.
  const settled = useRef(0);
  const latest = useRef({ onChange, onCheck, shown });
  latest.current = { onChange, onCheck, shown };
  const canCheck = Boolean(onCheck);
  const waiting = isWaiting(shown);

  if (domain !== given) {
    setGiven(domain);
    setShown(domain);
  }

  useEffect(() => setMounted(true), []);

  async function check(manual: boolean): Promise<void> {
    const call = latest.current.onCheck;
    if (!call) {
      return;
    }
    request.current += 1;
    const id = request.current;
    const before = latest.current.shown;
    setChecking(true);
    let result: DomainResult<CustomDomain>;
    try {
      result = await call({ manual });
    } catch {
      // Such as a lost connection, or a server action from an older deploy.
      result = {
        error: "The domain couldn't be checked. Try again.",
        ok: false,
      };
    }
    if (id !== request.current) {
      return;
    }
    settled.current = id;
    setChecking(false);
    setLastChecked(Date.now());
    if (!result.ok) {
      setError({ manual, text: result.error });
      return;
    }
    setError({ manual: false, text: "" });
    setShown(result.data);
    setAnnouncement(describeChange(before, result.data));
    latest.current.onChange?.(result.data);
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: `check` reads the latest props through refs.
  useEffect(() => {
    if (
      !(autoCheck && canCheck && waiting) ||
      Date.now() - startedAt.current > AUTO_CHECK_LIMIT_MS
    ) {
      return;
    }
    let stopWaiting: () => void = () => undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      stopWaiting = whenVisible(() => {
        // Check now is already running, so this one isn't needed.
        if (settled.current !== request.current) {
          setAttempt((count) => count + 1);
          return;
        }
        check(false).then(() => {
          if (!cancelled) {
            setAttempt((count) => count + 1);
          }
        });
      });
    }, delayFor(attempt));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopWaiting();
    };
  }, [attempt, autoCheck, canCheck, restarts, waiting]);

  async function checkNow() {
    await check(true);
    // A manual check starts the automatic ones over, from the shortest wait.
    startedAt.current = Date.now();
    // It also cancels an automatic check that was already waiting.
    setAttempt(0);
    setRestarts((count) => count + 1);
  }

  const live = isDomainLive(shown);
  let checkedTime: number | null = lastChecked;
  if (checkedTime === null && shown.checkedAt) {
    checkedTime = Date.parse(shown.checkedAt);
  }
  const showTime =
    mounted && checkedTime !== null && !Number.isNaN(checkedTime);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <DomainStatusBadge domain={shown} />
        {shown.statusMessage ? (
          <p className="text-muted-foreground text-sm">{shown.statusMessage}</p>
        ) : null}
        {shown.status === "active" && shown.certificate === "pending" ? (
          <p className="text-muted-foreground text-sm">
            The domain is connected. Its certificate is being issued, which can
            take a few minutes.
          </p>
        ) : null}
      </div>

      {shown.records.length > 0 ? (
        <Records live={live} records={shown.records} />
      ) : null}

      {canCheck && !live ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            disabled={checking}
            onClick={checkNow}
            size="sm"
            type="button"
            variant="outline"
          >
            <IconPlaceholder
              aria-hidden="true"
              hugeicons="RefreshIcon"
              lucide="RefreshCwIcon"
              phosphor="ArrowClockwiseIcon"
              remixicon="RiRefreshLine"
              tabler="IconRefresh"
            />
            {checking ? "Checking…" : "Check now"}
          </Button>
          <p className="text-muted-foreground text-xs">
            {showTime && checkedTime !== null
              ? `Last checked at ${timeFormat.format(checkedTime)}. `
              : ""}
            DNS changes can take up to a few hours to be seen.
          </p>
        </div>
      ) : null}

      {/* An automatic check's error is said politely, so it doesn't interrupt. */}
      {error.text && error.manual ? (
        <p className="text-destructive text-sm" role="alert">
          {error.text}
        </p>
      ) : null}
      <p
        aria-live="polite"
        className={cn(
          "text-destructive text-sm",
          error.text && !error.manual ? null : "sr-only"
        )}
      >
        {error.manual ? "" : error.text}
      </p>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
