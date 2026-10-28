"use client";

import {
  type FormEvent,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import {
  DomainSetup,
  DomainStatusBadge,
  isDomainLive,
} from "@/components/domains/domain-setup";
import { RemoveDomainDialog } from "@/components/domains/remove-domain-dialog";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type CustomDomain,
  type DomainSource,
  readHostname,
} from "@/lib/domains/types";
import { cn } from "@/lib/utils";

export interface CustomDomainsProps {
  /** Checks pending domains again on their own while they're shown. Defaults to true. */
  autoCheck?: boolean;
  className?: string;
  /**
   * The calls the list makes. Each action shows only when its call is given,
   * so a read-only list needs only `listDomains`.
   */
  source: Pick<DomainSource, "listDomains"> &
    Partial<
      Pick<
        DomainSource,
        "addDomain" | "checkDomain" | "removeDomain" | "setPrimaryDomain"
      >
    >;
}

type Loaded =
  | { domains: CustomDomain[]; status: "ready" }
  | { error: string; status: "failed" }
  | { status: "loading" };

/** The remove dialog. It stays mounted while it closes, so it can animate out. */
interface Removing {
  domain: CustomDomain;
  open: boolean;
}

const SKELETON_ROWS = ["first", "second"];

function AddDomainForm({
  disabled,
  inputRef,
  onAdd,
}: {
  /** Set until the list has loaded, so a new domain has a list to join. */
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onAdd: (hostname: string) => Promise<string | null>;
}) {
  const id = useId();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const read = readHostname(String(new FormData(form).get("domain") ?? ""));
    if ("error" in read) {
      setError(read.error);
      inputRef.current?.focus();
      return;
    }
    setPending(true);
    const failure = await onAdd(read.hostname);
    setPending(false);
    if (failure) {
      setError(failure);
      inputRef.current?.focus();
      return;
    }
    setError("");
    form.reset();
  }

  return (
    <form noValidate onSubmit={submit}>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={id}>Add a domain</FieldLabel>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            aria-describedby={error ? `${id}-error` : undefined}
            aria-invalid={error ? true : undefined}
            autoCapitalize="none"
            autoComplete="off"
            className="font-mono sm:max-w-sm"
            id={id}
            inputMode="url"
            maxLength={300}
            name="domain"
            placeholder="shop.example.com"
            ref={inputRef}
            spellCheck={false}
          />
          <Button disabled={disabled || pending} type="submit">
            <IconPlaceholder
              aria-hidden="true"
              hugeicons="PlusSignIcon"
              lucide="PlusIcon"
              phosphor="PlusIcon"
              remixicon="RiAddLine"
              tabler="IconPlus"
            />
            {pending ? "Adding…" : "Add domain"}
          </Button>
        </div>
        <FieldError id={`${id}-error`}>{error}</FieldError>
      </Field>
    </form>
  );
}

function DomainActions({
  domain,
  onRemove,
  onSetPrimary,
}: {
  domain: CustomDomain;
  onRemove?: () => void;
  onSetPrimary?: () => void;
}) {
  if (!(onRemove || onSetPrimary)) {
    return null;
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Actions for ${domain.hostname}`}
          data-domain-actions={domain.id}
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
      <DropdownMenuContent align="end" className="min-w-44">
        {onSetPrimary ? (
          <DropdownMenuItem onClick={onSetPrimary}>
            <IconPlaceholder
              hugeicons="StarIcon"
              lucide="StarIcon"
              phosphor="StarIcon"
              remixicon="RiStarLine"
              tabler="IconStar"
            />
            Make primary
          </DropdownMenuItem>
        ) : null}
        {onSetPrimary && onRemove ? <DropdownMenuSeparator /> : null}
        {onRemove ? (
          <DropdownMenuItem onClick={onRemove} variant="destructive">
            <IconPlaceholder
              hugeicons="Delete02Icon"
              lucide="Trash2Icon"
              phosphor="TrashIcon"
              remixicon="RiDeleteBinLine"
              tabler="IconTrash"
            />
            Remove
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DomainItem({
  autoCheck,
  domain,
  expanded,
  onChange,
  onCheck,
  onRemove,
  onSetPrimary,
  onToggle,
}: {
  autoCheck: boolean;
  domain: CustomDomain;
  expanded: boolean;
  onChange: (domain: CustomDomain) => void;
  onCheck?: DomainSource["checkDomain"];
  onRemove?: () => void;
  onSetPrimary?: () => void;
  onToggle: () => void;
}) {
  const panelId = useId();
  return (
    <li className="rounded-lg border">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3">
        <span
          className="min-w-0 flex-1 truncate font-mono text-sm"
          title={domain.hostname}
        >
          {domain.hostname}
        </span>
        {domain.primary ? <Badge variant="outline">Primary</Badge> : null}
        <DomainStatusBadge domain={domain} />
        <Button
          aria-controls={panelId}
          aria-expanded={expanded}
          onClick={onToggle}
          size="sm"
          variant="ghost"
        >
          {expanded ? "Hide setup" : "Setup"}
        </Button>
        <DomainActions
          domain={domain}
          onRemove={onRemove}
          onSetPrimary={onSetPrimary}
        />
      </div>
      {expanded ? (
        <div className="border-t p-3" id={panelId}>
          <DomainSetup
            autoCheck={autoCheck}
            domain={domain}
            onChange={onChange}
            onCheck={
              onCheck ? (options) => onCheck(domain.id, options) : undefined
            }
          />
        </div>
      ) : null}
    </li>
  );
}

/**
 * The custom domains of an account: add one, follow its DNS setup until it's
 * active, make one primary, and remove them. Every call goes through
 * `source`, so it works with any backend.
 */
export function CustomDomains({
  autoCheck = true,
  className,
  source,
}: CustomDomainsProps) {
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [reloads, setReloads] = useState(0);
  // Domains whose setup is open. Pending ones open when the list loads or
  // they're added, and stay open once active, so the change can be read.
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [removing, setRemoving] = useState<Removing | null>(null);
  const [message, setMessage] = useState("");
  const request = useRef(0);
  const container = useRef<HTMLDivElement>(null);
  const addInput = useRef<HTMLInputElement>(null);
  const {
    addDomain,
    checkDomain,
    listDomains,
    removeDomain,
    setPrimaryDomain,
  } = source;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloads` is a counter that asks for a fresh list.
  useEffect(() => {
    request.current += 1;
    const id = request.current;
    setLoaded({ status: "loading" });
    listDomains().then((result) => {
      if (id !== request.current) {
        return;
      }
      if (result.ok) {
        setLoaded({ domains: result.data, status: "ready" });
        setOpenIds(
          result.data
            .filter((domain) => !isDomainLive(domain))
            .map((domain) => domain.id)
        );
      } else {
        setLoaded({ error: result.error, status: "failed" });
      }
    });
  }, [listDomains, reloads]);

  function updateList(change: (domains: CustomDomain[]) => CustomDomain[]) {
    setLoaded((current) =>
      current.status === "ready"
        ? { domains: change(current.domains), status: "ready" }
        : current
    );
  }

  /** Shows a checked domain. Which one is primary stays as the list has it. */
  function replace(domain: CustomDomain) {
    updateList((domains) =>
      domains.map((item) =>
        item.id === domain.id ? { ...domain, primary: item.primary } : item
      )
    );
  }

  async function add(hostname: string): Promise<string | null> {
    if (!addDomain) {
      return null;
    }
    setMessage("");
    const result = await addDomain(hostname);
    if (!result.ok) {
      return result.error;
    }
    updateList((domains) => [...domains, result.data]);
    setOpenIds((ids) => [...ids, result.data.id]);
    setMessage(`${result.data.hostname} was added.`);
    return null;
  }

  async function makePrimary(domain: CustomDomain) {
    if (!setPrimaryDomain) {
      return;
    }
    setMessage("");
    const result = await setPrimaryDomain(domain.id);
    if (result.ok) {
      // Only the primary flags change, so a domain added meanwhile stays.
      const primary = new Set(
        result.data.filter((item) => item.primary).map((item) => item.id)
      );
      updateList((domains) =>
        domains.map((item) => ({ ...item, primary: primary.has(item.id) }))
      );
      setMessage(`${domain.hostname} is now the primary domain.`);
    } else {
      setMessage(result.error);
    }
  }

  function closeRemove(open: boolean) {
    setRemoving((current) => (current ? { ...current, open } : current));
    const id = removing?.domain.id;
    if (open || !id) {
      return;
    }
    // Back to the domain's menu, or, once it's removed, to the add field.
    requestAnimationFrame(() => {
      const actions = container.current?.querySelector<HTMLElement>(
        `[data-domain-actions="${CSS.escape(id)}"]`
      );
      (actions ?? addInput.current ?? container.current)?.focus();
    });
  }

  const isEmpty = loaded.status === "ready" && loaded.domains.length === 0;

  return (
    <div
      className={cn("flex w-full flex-col gap-4 outline-none", className)}
      ref={container}
      tabIndex={-1}
    >
      {addDomain ? (
        <AddDomainForm
          disabled={loaded.status !== "ready"}
          inputRef={addInput}
          onAdd={add}
        />
      ) : null}

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

      {loaded.status === "loading" ? (
        <div aria-busy="true" className="flex flex-col gap-2">
          <span className="sr-only">Loading the domains</span>
          {SKELETON_ROWS.map((row) => (
            <Skeleton className="h-12 w-full rounded-lg" key={row} />
          ))}
        </div>
      ) : null}

      {loaded.status === "failed" ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>The domains couldn't be loaded</EmptyTitle>
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
                hugeicons="Globe02Icon"
                lucide="GlobeIcon"
                phosphor="GlobeIcon"
                remixicon="RiGlobalLine"
                tabler="IconWorld"
              />
            </EmptyMedia>
            <EmptyTitle>No custom domains yet</EmptyTitle>
            <EmptyDescription>
              Connect a domain you own to show your account at your own address.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : null}

      {loaded.status === "ready" && loaded.domains.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {loaded.domains.map((domain) => (
            <DomainItem
              autoCheck={autoCheck}
              domain={domain}
              expanded={openIds.includes(domain.id)}
              key={domain.id}
              onChange={replace}
              onCheck={checkDomain}
              onRemove={
                removeDomain
                  ? () => setRemoving({ domain, open: true })
                  : undefined
              }
              onSetPrimary={
                setPrimaryDomain && !domain.primary && isDomainLive(domain)
                  ? () => makePrimary(domain)
                  : undefined
              }
              onToggle={() =>
                setOpenIds((ids) =>
                  ids.includes(domain.id)
                    ? ids.filter((id) => id !== domain.id)
                    : [...ids, domain.id]
                )
              }
            />
          ))}
        </ul>
      ) : null}

      {removing && removeDomain ? (
        <RemoveDomainDialog
          domain={removing.domain}
          key={removing.domain.id}
          onOpenChange={closeRemove}
          onRemove={async () => {
            const result = await removeDomain(removing.domain.id);
            if (result.ok) {
              updateList((domains) =>
                domains.filter((item) => item.id !== removing.domain.id)
              );
              setMessage(`${removing.domain.hostname} was removed.`);
            }
            return result;
          }}
          open={removing.open}
        />
      ) : null}
    </div>
  );
}
