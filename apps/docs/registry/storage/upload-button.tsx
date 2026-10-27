"use client";

import { type ChangeEvent, useRef, useState } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { Button } from "@/components/ui/button";
import type {
  SignedUpload,
  StorageSource,
  UploadOutcome,
} from "@/lib/storage/types";

export interface UploadSummary {
  failed: { error: string; name: string }[];
  /** Keys of the files that were stored. */
  uploaded: string[];
}

export interface UploadButtonProps {
  /** Disables the button, for example while the folder loads. */
  disabled?: boolean;
  /** Called once every chosen file has been uploaded or has failed. */
  onComplete?: (summary: UploadSummary) => void;
  /** Folder the files go into, ending with "/", or "" for the top of the bucket. */
  prefix: string;
  /** Signs each upload with `createUpload`, then sends the file with `sendUpload`. */
  source: Pick<StorageSource, "createUpload" | "sendUpload">;
}

const PERCENT = 100;

/**
 * Sends a file straight to the bucket. XMLHttpRequest is used because
 * `fetch` can't report upload progress.
 */
export function putFile(
  upload: SignedUpload,
  file: File,
  onProgress: (fraction: number) => void
): Promise<UploadOutcome> {
  return new Promise((resolve) => {
    const request = new XMLHttpRequest();
    request.open(upload.method, upload.url);
    for (const [name, value] of Object.entries(upload.headers)) {
      request.setRequestHeader(name, value);
    }
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(event.loaded / event.total);
      }
    });
    request.addEventListener("load", () => {
      resolve(
        request.status >= 200 && request.status < 300 ? "ok" : "rejected"
      );
    });
    // No response at all: the browser blocked the request, almost always for CORS.
    request.addEventListener("error", () => resolve("blocked"));
    request.send(file);
  });
}

const OUTCOME_ERRORS: Record<Exclude<UploadOutcome, "ok">, string> = {
  blocked:
    "The browser blocked the upload. The bucket needs a CORS rule that allows this site.",
  rejected: "The bucket rejected the upload.",
};

/**
 * Uploads files into one folder, one after another, with progress in the
 * button. Files go straight from the browser to the bucket.
 */
export function UploadButton({
  disabled,
  onComplete,
  prefix,
  source,
}: UploadButtonProps) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<{
    count: number;
    fraction: number;
    index: number;
  } | null>(null);

  async function uploadOne(
    file: File,
    onProgress: (fraction: number) => void
  ): Promise<string | null> {
    if (!source.createUpload) {
      return "Uploads are not available.";
    }
    const signed = await source.createUpload({
      contentType: file.type || "application/octet-stream",
      key: prefix + file.name,
      size: file.size,
    });
    if (!signed.ok) {
      return signed.error;
    }
    const send = source.sendUpload ?? putFile;
    const outcome = await send(signed.data, file, onProgress);
    return outcome === "ok" ? null : OUTCOME_ERRORS[outcome];
  }

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const files = [...(event.target.files ?? [])];
    // Clearing the input lets the same file be chosen again.
    event.target.value = "";
    const summary: UploadSummary = { failed: [], uploaded: [] };

    for (const [index, file] of files.entries()) {
      setProgress({ count: files.length, fraction: 0, index });
      // One at a time keeps progress readable and the bucket unflooded.
      // biome-ignore lint/performance/noAwaitInLoops: uploads run one after another on purpose.
      const error = await uploadOne(file, (fraction) =>
        setProgress({ count: files.length, fraction, index })
      );
      if (error) {
        summary.failed.push({ error, name: file.name });
      } else {
        summary.uploaded.push(prefix + file.name);
      }
    }

    setProgress(null);
    onComplete?.(summary);
  }

  if (!source.createUpload) {
    return null;
  }

  let label = "Upload";
  if (progress) {
    const percent = Math.round(progress.fraction * PERCENT);
    label =
      progress.count > 1
        ? `Uploading ${progress.index + 1} of ${progress.count} (${percent}%)`
        : `Uploading ${percent}%`;
  }

  return (
    <>
      <input
        aria-hidden="true"
        className="hidden"
        multiple
        onChange={upload}
        ref={input}
        tabIndex={-1}
        type="file"
      />
      <Button
        aria-live="polite"
        disabled={disabled || progress !== null}
        onClick={() => input.current?.click()}
      >
        <IconPlaceholder
          data-icon="inline-start"
          hugeicons="Upload04Icon"
          lucide="UploadIcon"
          phosphor="UploadSimpleIcon"
          remixicon="RiUploadLine"
          tabler="IconUpload"
        />
        {label}
      </Button>
    </>
  );
}
