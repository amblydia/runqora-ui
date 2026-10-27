"use client";

import { type ReactNode, useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  formatBytes,
  getObjectName,
  type StorageObjectDetails,
  type StorageSource,
} from "@/lib/storage/types";

export interface ObjectDetailsProps {
  /** Key of the object to show. Its details load each time the sheet opens. */
  objectKey: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** Reads the details, and with `getDownloadUrl`, previews images, video and audio. */
  source: Pick<StorageSource, "getDownloadUrl" | "getObject">;
}

type State =
  | {
      details: StorageObjectDetails;
      previewUrl: string | null;
      status: "ready";
    }
  | { error: string; status: "failed" }
  | { status: "loading" };

const PREVIEW_TYPES = ["image/", "video/", "audio/"];

function canPreview(contentType: string | null): boolean {
  return PREVIEW_TYPES.some((type) => contentType?.startsWith(type));
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

async function load(
  source: ObjectDetailsProps["source"],
  key: string
): Promise<State> {
  if (!source.getObject) {
    return { error: "Details are not available.", status: "failed" };
  }
  const result = await source.getObject(key);
  if (!result.ok) {
    return { error: result.error, status: "failed" };
  }
  let previewUrl: string | null = null;
  if (source.getDownloadUrl && canPreview(result.data.contentType)) {
    const link = await source.getDownloadUrl(key, { download: false });
    previewUrl = link.ok ? link.data : null;
  }
  return { details: result.data, previewUrl, status: "ready" };
}

function Detail({ label, children }: { children: ReactNode; label: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 text-sm break-all">{children}</dd>
    </div>
  );
}

function Preview({
  contentType,
  name,
  url,
}: {
  contentType: string;
  name: string;
  url: string;
}) {
  const className = "max-h-64 w-full rounded-lg border bg-muted object-contain";
  if (contentType.startsWith("video/")) {
    return (
      // biome-ignore lint/a11y/useMediaCaption: files in a bucket rarely come with captions.
      <video className={className} controls preload="metadata" src={url} />
    );
  }
  if (contentType.startsWith("audio/")) {
    return (
      // biome-ignore lint/a11y/useMediaCaption: files in a bucket rarely come with captions.
      <audio className="w-full" controls preload="metadata" src={url} />
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: a signed URL that expires can't go through an image optimizer.
    <img
      alt={`Preview of ${name}`}
      className="bg-muted mx-auto h-auto max-h-64 w-auto max-w-full rounded-lg border object-contain"
      height={256}
      src={url}
      width={384}
    />
  );
}

function Body({ state }: { state: State }) {
  if (state.status === "loading") {
    return (
      <div aria-busy="true" className="flex flex-col gap-3">
        <span className="sr-only">Loading details</span>
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
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

  const { details, previewUrl } = state;
  const metadata = Object.entries(details.metadata);

  return (
    <div className="flex flex-col gap-6">
      {previewUrl && details.contentType ? (
        <Preview
          contentType={details.contentType}
          name={getObjectName(details.key)}
          url={previewUrl}
        />
      ) : null}
      <dl className="flex flex-col gap-3">
        <Detail label="Path">
          <span className="font-mono text-xs">{details.key}</span>
        </Detail>
        <Detail label="Size">{formatBytes(details.size)}</Detail>
        <Detail label="Type">{details.contentType ?? "Unknown"}</Detail>
        <Detail label="Last modified">
          {details.lastModified
            ? dateFormat.format(new Date(details.lastModified))
            : "Unknown"}
        </Detail>
        {details.etag ? (
          <Detail label="ETag">
            <span className="font-mono text-xs">{details.etag}</span>
          </Detail>
        ) : null}
      </dl>
      {metadata.length > 0 ? (
        <section>
          <h3 className="text-sm font-medium">Metadata</h3>
          <dl className="mt-2 flex flex-col gap-3">
            {metadata.map(([name, value]) => (
              <Detail key={name} label={name}>
                {value}
              </Detail>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

/** A side sheet with a preview and everything known about one object. */
export function ObjectDetails({
  objectKey,
  onOpenChange,
  open,
  source,
}: ObjectDetailsProps) {
  const [state, setState] = useState<State>({ status: "loading" });
  const { getDownloadUrl, getObject } = source;

  useEffect(() => {
    if (!open) {
      return;
    }
    let current = true;
    setState({ status: "loading" });
    load({ getDownloadUrl, getObject }, objectKey).then((next) => {
      if (current) {
        setState(next);
      }
    });
    return () => {
      current = false;
    };
  }, [getDownloadUrl, getObject, objectKey, open]);

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="break-all">
            {getObjectName(objectKey)}
          </SheetTitle>
          <SheetDescription>File details</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <Body state={state} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
