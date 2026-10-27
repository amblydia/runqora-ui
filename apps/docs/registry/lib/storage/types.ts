// Shared by the file browser components, which run in the browser, and by the
// code that talks to the bucket, which runs on the server. Keys are full
// object keys, such as "invoices/2026/october.pdf". Folders are key prefixes
// ending with "/", such as "invoices/2026/". The top of the bucket is "".

/** One object in a listing. */
export interface StorageObject {
  /** Entity tag, usually the MD5 of the content. */
  etag: string | null;
  key: string;
  /** ISO 8601 date. */
  lastModified: string | null;
  /** Size in bytes. */
  size: number;
}

/** Everything known about one object, read when its details open. */
export interface StorageObjectDetails extends StorageObject {
  contentType: string | null;
  /** User metadata, sent as `x-amz-meta-*` headers when the object was stored. */
  metadata: Record<string, string>;
}

/** One page of a folder. */
export interface StorageListing {
  /** Subfolders, as full prefixes ending with "/". */
  folders: string[];
  /** Pass to `list` to get the next page. Null on the last page. */
  nextCursor: string | null;
  objects: StorageObject[];
}

/** A signed request that uploads one file straight to the bucket. */
export interface SignedUpload {
  /** Headers the browser must send unchanged, as they are part of the signature. */
  headers: Record<string, string>;
  method: "PUT";
  url: string;
}

/**
 * What a storage call returns. Errors are values rather than exceptions so
 * their message reaches the browser: Next.js hides the message of an error
 * thrown by a server action in production.
 */
export type StorageResult<T> =
  | { data: T; ok: true }
  | { error: string; ok: false };

/** How a file reaches the bucket after `createUpload` signed it. */
export type UploadOutcome = "blocked" | "ok" | "rejected";

/**
 * The calls the file browser makes. `list` is required. Leave out any other
 * call and the browser hides what depends on it, so a read-only browser has
 * no `createUpload`, `moveObject` or `deleteObject`.
 */
export interface StorageSource {
  /** Signs an upload of one file to `key`. */
  createUpload?: (input: {
    contentType: string;
    key: string;
    size: number;
  }) => Promise<StorageResult<SignedUpload>>;
  deleteObject?: (key: string) => Promise<StorageResult<null>>;
  /**
   * A temporary link to the object. With `download`, opening the link saves
   * the file instead of showing it.
   */
  getDownloadUrl?: (
    key: string,
    options: { download: boolean }
  ) => Promise<StorageResult<string>>;
  getObject?: (key: string) => Promise<StorageResult<StorageObjectDetails>>;
  /**
   * Lists one page of the folder `prefix`. With `startsWith`, only names in
   * that folder starting with it are listed, as buckets can only search by the
   * start of a key.
   */
  list: (input: {
    cursor?: string | null;
    prefix: string;
    startsWith?: string;
  }) => Promise<StorageResult<StorageListing>>;
  /** Renames or moves the object at `fromKey` to `toKey`. */
  moveObject?: (fromKey: string, toKey: string) => Promise<StorageResult<null>>;
  /**
   * Sends the file to the signed URL from the browser. Leave it out to use a
   * PUT request with XMLHttpRequest, which reports progress.
   */
  sendUpload?: (
    upload: SignedUpload,
    file: File,
    onProgress: (fraction: number) => void
  ) => Promise<UploadOutcome>;
}

/** The last part of a key or folder, such as "october.pdf" or "2026". */
export function getObjectName(key: string): string {
  const trimmed = key.endsWith("/") ? key.slice(0, -1) : key;
  return trimmed.slice(trimmed.lastIndexOf("/") + 1);
}

const UNITS = ["bytes", "KB", "MB", "GB", "TB"] as const;
const STEP = 1000;

/** A size for people, such as "48.2 KB". Uses decimal units, as most providers do. */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unit = 0;
  while (value >= STEP && unit < UNITS.length - 1) {
    value /= STEP;
    unit += 1;
  }
  if (unit === 0) {
    return value === 1 ? "1 byte" : `${value} bytes`;
  }
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${UNITS[unit]}`;
}
