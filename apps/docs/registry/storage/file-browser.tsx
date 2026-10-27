"use client";

import { type FormEvent, useEffect, useState } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { DeleteObjectDialog } from "@/components/storage/delete-object-dialog";
import { ObjectActions } from "@/components/storage/object-actions";
import { ObjectDetails } from "@/components/storage/object-details";
import { RenameObjectDialog } from "@/components/storage/rename-object-dialog";
import {
  UploadButton,
  type UploadSummary,
} from "@/components/storage/upload-button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
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
  formatBytes,
  getObjectName,
  type StorageListing,
  type StorageObject,
  type StorageSource,
} from "@/lib/storage/types";
import { cn } from "@/lib/utils";

export interface FileBrowserProps {
  className?: string;
  /** Folder to open first when `prefix` isn't controlled. */
  defaultPrefix?: string;
  /** Called when someone opens another folder, for example to keep it in the URL. */
  onPrefixChange?: (prefix: string) => void;
  /** The open folder, ending with "/", or "" for the top. Set it to control navigation. */
  prefix?: string;
  /** Name of the top folder in the breadcrumb. */
  rootLabel?: string;
  /** The calls that read and change the bucket. */
  source: StorageSource;
}

/** The dialog or sheet of one file. It stays mounted while it closes, so it can animate out. */
interface Panel {
  key: string;
  kind: "delete" | "details" | "rename";
  open: boolean;
}

type Loaded =
  | { listing: StorageListing; status: "ready" }
  | { error: string; status: "failed" }
  | { status: "loading" };

/** What can be done with a file. Each is left out when the source can't do it. */
interface FileActions {
  copyLink?: (key: string) => void;
  delete?: (key: string) => void;
  details?: (key: string) => void;
  download?: (key: string) => void;
  rename?: (key: string) => void;
}

const SKELETON_ROWS = ["first", "second", "third"];
const FOCUS_RING =
  "rounded-sm outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

/** Copies text that is still being fetched. Safari only allows that through a ClipboardItem. */
async function copyLater(text: Promise<string>): Promise<void> {
  if (typeof ClipboardItem === "undefined") {
    await navigator.clipboard.writeText(await text);
    return;
  }
  const blob = text.then((value) => new Blob([value], { type: "text/plain" }));
  await navigator.clipboard.write([new ClipboardItem({ "text/plain": blob })]);
}

function saveFrom(url: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = "";
  link.rel = "noopener";
  link.click();
}

function summarize(summary: UploadSummary): string {
  const done = summary.uploaded.length;
  const parts: string[] = [];
  if (done > 0) {
    parts.push(done === 1 ? "Uploaded 1 file." : `Uploaded ${done} files.`);
  }
  for (const failure of summary.failed) {
    parts.push(`${failure.name}: ${failure.error}`);
  }
  return parts.join(" ");
}

function FolderTrail({
  onOpen,
  prefix,
  rootLabel,
}: {
  onOpen: (prefix: string) => void;
  prefix: string;
  rootLabel: string;
}) {
  const names = prefix.split("/").filter(Boolean);
  const trail = [
    { name: rootLabel, prefix: "" },
    ...names.map((name, index) => ({
      name,
      prefix: `${names.slice(0, index + 1).join("/")}/`,
    })),
  ];

  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList>
        {trail.map((part, index) => (
          <BreadcrumbItem key={part.prefix}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            {index === trail.length - 1 ? (
              <BreadcrumbPage className="break-all">{part.name}</BreadcrumbPage>
            ) : (
              <BreadcrumbLink asChild>
                <button
                  className="break-all"
                  onClick={() => onOpen(part.prefix)}
                  type="button"
                >
                  {part.name}
                </button>
              </BreadcrumbLink>
            )}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

/** Buckets can only search by the start of a key, so that is what the filter offers. */
function NameFilter({
  filter,
  onFilter,
}: {
  filter: string;
  onFilter: (filter: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("q") ?? "");
    onFilter(value.replaceAll("/", ""));
  }

  return (
    <search>
      <form className="flex items-center gap-2" onSubmit={submit}>
        <Input
          aria-label="Show names that start with"
          className="w-44"
          defaultValue={filter}
          name="q"
          placeholder="Name starts with…"
          spellCheck={false}
          type="search"
        />
        {filter ? (
          <Button onClick={() => onFilter("")} type="button" variant="ghost">
            Clear
          </Button>
        ) : null}
      </form>
    </search>
  );
}

function FolderRow({
  folder,
  onOpen,
}: {
  folder: string;
  onOpen: (prefix: string) => void;
}) {
  return (
    <TableRow>
      <TableCell colSpan={4}>
        <button
          className={cn(
            "flex max-w-full items-center gap-2 font-medium",
            FOCUS_RING
          )}
          onClick={() => onOpen(folder)}
          type="button"
        >
          <IconPlaceholder
            aria-hidden="true"
            className="text-muted-foreground size-4 shrink-0"
            hugeicons="Folder01Icon"
            lucide="FolderIcon"
            phosphor="FolderIcon"
            remixicon="RiFolderLine"
            tabler="IconFolder"
          />
          <span className="truncate">{getObjectName(folder)}</span>
        </button>
      </TableCell>
    </TableRow>
  );
}

function FileRow({
  actions,
  object,
}: {
  actions: FileActions;
  object: StorageObject;
}) {
  const name = getObjectName(object.key);
  const label = (
    <>
      <IconPlaceholder
        aria-hidden="true"
        className="text-muted-foreground size-4 shrink-0"
        hugeicons="File01Icon"
        lucide="FileIcon"
        phosphor="FileIcon"
        remixicon="RiFileLine"
        tabler="IconFile"
      />
      <span className="truncate">{name}</span>
    </>
  );
  const forThis = (action?: (key: string) => void) =>
    action ? () => action(object.key) : undefined;
  const showDetails = forThis(actions.details);

  return (
    <TableRow>
      <TableCell className="w-full max-w-0">
        {showDetails ? (
          <button
            className={cn(
              "flex max-w-full items-center gap-2 text-left",
              FOCUS_RING
            )}
            onClick={showDetails}
            type="button"
          >
            {label}
          </button>
        ) : (
          <span className="flex items-center gap-2">{label}</span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground hidden whitespace-nowrap tabular-nums sm:table-cell">
        {formatBytes(object.size)}
      </TableCell>
      <TableCell className="text-muted-foreground hidden whitespace-nowrap tabular-nums md:table-cell">
        {object.lastModified
          ? dateFormat.format(new Date(object.lastModified))
          : null}
      </TableCell>
      <TableCell className="text-right">
        <ObjectActions
          object={{ key: object.key, name }}
          onCopyLink={forThis(actions.copyLink)}
          onDelete={forThis(actions.delete)}
          onDetails={showDetails}
          onDownload={forThis(actions.download)}
          onRename={forThis(actions.rename)}
        />
      </TableCell>
    </TableRow>
  );
}

function ListingTable({
  actions,
  loaded,
  onOpen,
}: {
  actions: FileActions;
  loaded: Loaded;
  onOpen: (prefix: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <Table aria-busy={loaded.status === "loading"}>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Size</TableHead>
            <TableHead className="hidden md:table-cell">
              Last modified
            </TableHead>
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
                    <Skeleton className="h-5 w-full max-w-64" />
                  </TableCell>
                </TableRow>
              ))
            : null}
          {loaded.status === "ready" ? (
            <>
              {loaded.listing.folders.map((folder) => (
                <FolderRow folder={folder} key={folder} onOpen={onOpen} />
              ))}
              {loaded.listing.objects.map((object) => (
                <FileRow actions={actions} key={object.key} object={object} />
              ))}
            </>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

function EmptyFolder({ filter }: { filter: string }) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconPlaceholder
            hugeicons="FolderOpenIcon"
            lucide="FolderOpenIcon"
            phosphor="FolderOpenIcon"
            remixicon="RiFolderOpenLine"
            tabler="IconFolderOpen"
          />
        </EmptyMedia>
        <EmptyTitle>
          {filter ? `No names start with “${filter}”` : "This folder is empty"}
        </EmptyTitle>
        <EmptyDescription>
          {filter
            ? "The filter looks at the start of names in this folder only."
            : "Files in this folder of the bucket show up here."}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** The details sheet and the rename and delete dialogs of the file they were opened for. */
function FilePanels({
  onChange,
  onDone,
  panel,
  source,
}: {
  onChange: (panel: Panel) => void;
  /** Called after a file changed, with what happened. */
  onDone: (message: string) => void;
  panel: Panel;
  source: StorageSource;
}) {
  const { deleteObject, moveObject } = source;
  const name = getObjectName(panel.key);
  const onOpenChange = (open: boolean) => onChange({ ...panel, open });

  if (panel.kind === "details") {
    return (
      <ObjectDetails
        objectKey={panel.key}
        onOpenChange={onOpenChange}
        open={panel.open}
        source={source}
      />
    );
  }
  if (panel.kind === "rename" && moveObject) {
    return (
      <RenameObjectDialog
        objectKey={panel.key}
        onOpenChange={onOpenChange}
        onRename={async (toKey) => {
          const result = await moveObject(panel.key, toKey);
          if (result.ok) {
            onDone(`Moved ${name} to ${toKey}.`);
          }
          return result;
        }}
        open={panel.open}
      />
    );
  }
  if (panel.kind === "delete" && deleteObject) {
    return (
      <DeleteObjectDialog
        objectKey={panel.key}
        onDelete={async () => {
          const result = await deleteObject(panel.key);
          if (result.ok) {
            onDone(`Deleted ${name}.`);
          }
          return result;
        }}
        onOpenChange={onOpenChange}
        open={panel.open}
      />
    );
  }
  return null;
}

/**
 * Browses one bucket: open folders, filter by the start of a name, upload,
 * and preview, download, link, rename or move, and delete files. Every call
 * goes through `source`, so the browser works with any backend.
 */
export function FileBrowser({
  className,
  defaultPrefix = "",
  onPrefixChange,
  prefix: controlledPrefix,
  rootLabel = "Files",
  source,
}: FileBrowserProps) {
  const [ownPrefix, setOwnPrefix] = useState(defaultPrefix);
  const prefix = controlledPrefix ?? ownPrefix;
  const [filter, setFilter] = useState("");
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const [loadingMore, setLoadingMore] = useState(false);
  const [reloads, setReloads] = useState(0);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [message, setMessage] = useState("");
  const { getDownloadUrl, list } = source;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `reloads` is a counter that asks for a fresh listing.
  useEffect(() => {
    let current = true;
    setLoaded({ status: "loading" });
    list({ prefix, startsWith: filter }).then((result) => {
      if (current) {
        setLoaded(
          result.ok
            ? { listing: result.data, status: "ready" }
            : { error: result.error, status: "failed" }
        );
      }
    });
    return () => {
      current = false;
    };
  }, [filter, list, prefix, reloads]);

  function reload(note: string) {
    setReloads((count) => count + 1);
    setMessage(note);
  }

  function open(next: string) {
    setFilter("");
    setMessage("");
    setOwnPrefix(next);
    onPrefixChange?.(next);
  }

  async function loadMore() {
    if (loaded.status !== "ready" || !loaded.listing.nextCursor) {
      return;
    }
    const { listing } = loaded;
    setLoadingMore(true);
    const result = await list({
      cursor: listing.nextCursor,
      prefix,
      startsWith: filter,
    });
    setLoadingMore(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setLoaded({
      listing: {
        folders: [...listing.folders, ...result.data.folders],
        nextCursor: result.data.nextCursor,
        objects: [...listing.objects, ...result.data.objects],
      },
      status: "ready",
    });
  }

  async function download(key: string) {
    const result = await getDownloadUrl?.(key, { download: true });
    if (result?.ok) {
      saveFrom(result.data);
    } else if (result) {
      setMessage(result.error);
    }
  }

  async function copyLink(key: string) {
    if (!getDownloadUrl) {
      return;
    }
    const link = getDownloadUrl(key, { download: false }).then((result) => {
      if (!result.ok) {
        throw new Error(result.error);
      }
      return result.data;
    });
    try {
      await copyLater(link);
      setMessage(`Copied a link to ${getObjectName(key)}.`);
    } catch {
      setMessage(
        await link.then(
          () => "The browser blocked copying the link.",
          (error: Error) => error.message
        )
      );
    }
  }

  const show = (kind: Panel["kind"]) => (key: string) =>
    setPanel({ key, kind, open: true });
  const actions: FileActions = {
    copyLink: getDownloadUrl ? copyLink : undefined,
    delete: source.deleteObject ? show("delete") : undefined,
    details: source.getObject ? show("details") : undefined,
    download: getDownloadUrl ? download : undefined,
    rename: source.moveObject ? show("rename") : undefined,
  };
  const isEmpty =
    loaded.status === "ready" &&
    loaded.listing.folders.length === 0 &&
    loaded.listing.objects.length === 0;

  return (
    <div className={cn("flex w-full flex-col gap-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FolderTrail onOpen={open} prefix={prefix} rootLabel={rootLabel} />
        <div className="flex flex-wrap items-center gap-2">
          <NameFilter filter={filter} key={prefix} onFilter={setFilter} />
          <Button
            aria-label="Refresh"
            onClick={() => reload("")}
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
          <UploadButton
            onComplete={(summary) => reload(summarize(summary))}
            prefix={prefix}
            source={source}
          />
        </div>
      </div>

      <p
        aria-live="polite"
        className="text-muted-foreground text-sm empty:hidden"
      >
        {message}
      </p>

      {loaded.status === "failed" ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyTitle>This folder couldn't be opened</EmptyTitle>
            <EmptyDescription>{loaded.error}</EmptyDescription>
          </EmptyHeader>
          <Button onClick={() => reload("")} variant="outline">
            Try again
          </Button>
        </Empty>
      ) : null}

      {isEmpty ? <EmptyFolder filter={filter} /> : null}

      {loaded.status === "failed" || isEmpty ? null : (
        <ListingTable actions={actions} loaded={loaded} onOpen={open} />
      )}

      {loaded.status === "ready" && loaded.listing.nextCursor ? (
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
        <FilePanels
          onChange={setPanel}
          onDone={reload}
          panel={panel}
          source={source}
        />
      ) : null}
    </div>
  );
}
