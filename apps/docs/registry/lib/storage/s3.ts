// A small client for Amazon S3 and services that speak its API, such as
// Cloudflare R2. It runs on the server only, as it holds the secret key.
// File contents never pass through it: the browser downloads and uploads
// through signed URLs.

import { AwsClient } from "aws4fetch";
import type {
  StorageListing,
  StorageObject,
  StorageObjectDetails,
} from "@/lib/storage/types";

export interface S3ClientConfig {
  accessKeyId: string;
  bucket: string;
  /**
   * Base URL of an S3-compatible service, such as the one `r2Endpoint`
   * returns. Requests then use path-style URLs (`<endpoint>/<bucket>/<key>`).
   * Leave it out for Amazon S3.
   */
  endpoint?: string;
  /** Replaces the global `fetch`, for tests. */
  fetch?: typeof fetch;
  /** The bucket's region, such as "eu-central-1". R2 uses "auto". */
  region: string;
  secretAccessKey: string;
}

export type S3ErrorCode =
  | "conflict"
  | "invalid_credentials"
  | "not_found"
  | "permission_denied"
  | "rate_limited"
  | "unavailable"
  | "unknown";

/** An error from the bucket, with a message that can be shown to people. */
export class S3Error extends Error {
  readonly code: S3ErrorCode;

  constructor(message: string, options: ErrorOptions & { code: S3ErrorCode }) {
    super(message, { cause: options.cause });
    this.code = options.code;
    this.name = "S3Error";
  }
}

/** The endpoint of the R2 buckets in one Cloudflare account. */
export function r2Endpoint(accountId: string): string {
  return `https://${accountId}.r2.cloudflarestorage.com`;
}

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_PAGE_SIZE = 1000;
const MAX_URL_EXPIRY_SECONDS = 604_800;
const METADATA_PREFIX = "x-amz-meta-";
const TRAILING_SLASHES = /\/+$/u;
const NON_ASCII_OR_QUOTE = /[^\x20-\x7e]|["\\]/gu;

const REJECTED: [S3ErrorCode, string] = [
  "invalid_credentials",
  "The bucket rejected the access key.",
];
const DENIED: [S3ErrorCode, string] = [
  "permission_denied",
  "The access key is not allowed to do this in the bucket.",
];
const WRONG_REGION: [S3ErrorCode, string] = [
  "invalid_credentials",
  "The bucket is in a different region than the one configured.",
];

/** S3 error codes that deserve a more precise message than the HTTP status. */
const KNOWN_ERRORS: Record<string, [S3ErrorCode, string]> = {
  AccessDenied: DENIED,
  AuthorizationHeaderMalformed: WRONG_REGION,
  ExpiredToken: REJECTED,
  InvalidAccessKeyId: REJECTED,
  InvalidToken: REJECTED,
  NoSuchBucket: ["not_found", "The bucket does not exist."],
  NoSuchKey: ["not_found", "The file does not exist."],
  PermanentRedirect: WRONG_REGION,
  SignatureDoesNotMatch: REJECTED,
  SlowDown: ["rate_limited", "The bucket is limiting requests. Try again."],
};

function known([code, message]: [S3ErrorCode, string]): S3Error {
  return new S3Error(message, { code });
}

function errorFromStatus(status: number): S3Error {
  if (status === 401) {
    return known(REJECTED);
  }
  if (status === 403) {
    return known(DENIED);
  }
  if (status === 404) {
    return known(["not_found", "The file or bucket does not exist."]);
  }
  if (status === 409 || status === 412) {
    return known(["conflict", "The file changed while this ran."]);
  }
  if (status === 429) {
    return known(["rate_limited", "The bucket is limiting requests."]);
  }
  if (status >= 500) {
    return known(["unavailable", "The bucket is unavailable. Try again."]);
  }
  return known(["unknown", "The bucket returned an unexpected error."]);
}

async function errorFromResponse(response: Response): Promise<S3Error> {
  // HEAD responses have no body, so the status is the fallback.
  const body = await response.text().catch(() => "");
  const match = KNOWN_ERRORS[readTag(body, "Code") ?? ""];
  return match ? known(match) : errorFromStatus(response.status);
}

function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

/** A `Content-Disposition` that saves the file as `filename`, even with non-ASCII names. */
function attachment(filename: string): string {
  const fallback = filename.replace(NON_ASCII_OR_QUOTE, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.floor(value), min), max);
}

function bucketUrl(config: S3ClientConfig): string {
  if (config.endpoint) {
    return `${config.endpoint.replace(TRAILING_SLASHES, "")}/${config.bucket}`;
  }
  // A dot in the bucket name breaks the TLS certificate of virtual-hosted URLs.
  if (config.bucket.includes(".")) {
    return `https://s3.${config.region}.amazonaws.com/${config.bucket}`;
  }
  return `https://${config.bucket}.s3.${config.region}.amazonaws.com`;
}

// S3 sends XML with fixed shapes and escapes "<" and "&" inside values, so
// reading tags by position is enough and avoids an XML parser dependency.

const ENTITY = /&(?:#x[0-9a-f]+|#\d+|amp|apos|gt|lt|quot);/giu;
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
};

function decodeEntities(value: string): string {
  return value.replace(ENTITY, (match) => {
    const name = match.slice(1, -1).toLowerCase();
    if (name.startsWith("#x")) {
      return String.fromCodePoint(Number.parseInt(name.slice(2), 16));
    }
    if (name.startsWith("#")) {
      return String.fromCodePoint(Number.parseInt(name.slice(1), 10));
    }
    return NAMED_ENTITIES[name] ?? match;
  });
}

/** The raw content of every `<tag>` element, in order. */
function readBlocks(xml: string, tag: string): string[] {
  const open = `<${tag}>`;
  const close = `</${tag}>`;
  const blocks: string[] = [];
  let from = 0;
  while (from < xml.length) {
    const start = xml.indexOf(open, from);
    const end = start === -1 ? -1 : xml.indexOf(close, start + open.length);
    if (end === -1) {
      break;
    }
    blocks.push(xml.slice(start + open.length, end));
    from = end + close.length;
  }
  return blocks;
}

function readTag(xml: string, tag: string): string | undefined {
  const [value] = readBlocks(xml, tag);
  return value === undefined ? undefined : decodeEntities(value);
}

function toIsoDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseListing(xml: string): StorageListing {
  const objects: StorageObject[] = [];
  for (const block of readBlocks(xml, "Contents")) {
    const key = readTag(block, "Key");
    if (key !== undefined) {
      objects.push({
        etag: readTag(block, "ETag")?.replaceAll('"', "") ?? null,
        key,
        lastModified: toIsoDate(readTag(block, "LastModified")),
        size: Number(readTag(block, "Size") ?? 0),
      });
    }
  }
  const folders = readBlocks(xml, "CommonPrefixes")
    .map((block) => readTag(block, "Prefix"))
    .filter((prefix) => prefix !== undefined);

  return {
    folders,
    nextCursor:
      readTag(xml, "IsTruncated") === "true"
        ? (readTag(xml, "NextContinuationToken") ?? null)
        : null,
    objects,
  };
}

export type S3Client = ReturnType<typeof createS3Client>;

export function createS3Client(config: S3ClientConfig) {
  const send = config.fetch ?? fetch;
  const base = bucketUrl(config);
  const aws = new AwsClient({
    accessKeyId: config.accessKeyId,
    region: config.region,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
  });

  async function request(
    url: string,
    method: string,
    headers?: Record<string, string>
  ): Promise<Response> {
    let response: Response;
    try {
      const signed = await aws.sign(url, { headers, method });
      response = await send(signed, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new S3Error("The bucket could not be reached.", {
        cause: error,
        code: "unavailable",
      });
    }
    if (!response.ok) {
      throw await errorFromResponse(response);
    }
    return response;
  }

  async function presign(
    key: string,
    method: "GET" | "PUT",
    expiresIn: number,
    options: {
      headers?: Record<string, string>;
      query?: Record<string, string>;
    }
  ): Promise<string> {
    const url = new URL(`${base}/${encodeKey(key)}`);
    url.searchParams.set(
      "X-Amz-Expires",
      String(clamp(expiresIn, 1, MAX_URL_EXPIRY_SECONDS))
    );
    for (const [name, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(name, value);
    }
    const signed = await aws.sign(url.toString(), {
      // Signed headers make the URL work only when they are sent as given.
      aws: { allHeaders: Boolean(options.headers), signQuery: true },
      headers: options.headers,
      method,
    });
    return signed.url;
  }

  /** Copies an object inside the bucket, with its content type and metadata. */
  async function copyObject(fromKey: string, toKey: string): Promise<void> {
    const response = await request(`${base}/${encodeKey(toKey)}`, "PUT", {
      "x-amz-copy-source": `/${config.bucket}/${encodeKey(fromKey)}`,
    });
    // A copy can fail after the 200 status was sent. The body then holds the error.
    const body = await response.text();
    if (body.includes("<Error>")) {
      throw await errorFromResponse(new Response(body, { status: 500 }));
    }
  }

  /** Deletes an object. Deleting a key that does not exist succeeds. */
  async function deleteObject(key: string): Promise<void> {
    await request(`${base}/${encodeKey(key)}`, "DELETE");
  }

  return {
    copyObject,
    deleteObject,

    /** Reads an object's details without its content. Null when it does not exist. */
    async headObject(key: string): Promise<StorageObjectDetails | null> {
      let response: Response;
      try {
        response = await request(`${base}/${encodeKey(key)}`, "HEAD");
      } catch (error) {
        if (error instanceof S3Error && error.code === "not_found") {
          return null;
        }
        throw error;
      }
      const metadata: Record<string, string> = {};
      for (const [name, value] of response.headers) {
        if (name.startsWith(METADATA_PREFIX)) {
          metadata[name.slice(METADATA_PREFIX.length)] = value;
        }
      }
      return {
        contentType: response.headers.get("content-type"),
        etag: response.headers.get("etag")?.replaceAll('"', "") ?? null,
        key,
        lastModified: toIsoDate(response.headers.get("last-modified")),
        metadata,
        size: Number(response.headers.get("content-length") ?? 0),
      };
    },

    /**
     * Lists one page of objects and folders under `prefix`. Folders are the
     * keys' common prefixes up to the next "/".
     */
    async listObjects(
      input: { cursor?: string | null; limit?: number; prefix?: string } = {}
    ): Promise<StorageListing> {
      const url = new URL(base);
      url.searchParams.set("list-type", "2");
      url.searchParams.set("delimiter", "/");
      url.searchParams.set(
        "max-keys",
        String(clamp(input.limit ?? MAX_PAGE_SIZE, 1, MAX_PAGE_SIZE))
      );
      if (input.prefix) {
        url.searchParams.set("prefix", input.prefix);
      }
      if (input.cursor) {
        url.searchParams.set("continuation-token", input.cursor);
      }
      const response = await request(url.toString(), "GET");
      return parseListing(await response.text());
    },

    /** Moves an object: S3 has no rename, so this copies it, then deletes the original. */
    async moveObject(fromKey: string, toKey: string): Promise<void> {
      await copyObject(fromKey, toKey);
      await deleteObject(fromKey);
    },

    /**
     * A URL that reads the object until it expires. With `downloadAs`, opening
     * it saves the file under that name instead of showing it.
     */
    signDownloadUrl(
      key: string,
      options: { downloadAs?: string; expiresIn: number }
    ): Promise<string> {
      return presign(key, "GET", options.expiresIn, {
        query: options.downloadAs
          ? { "response-content-disposition": attachment(options.downloadAs) }
          : undefined,
      });
    },

    /**
     * A URL that stores one file at `key` with a PUT request. The type and
     * size are signed, so a different file fails. Send the returned headers.
     */
    async signUploadUrl(
      key: string,
      options: { contentType: string; expiresIn: number; size: number }
    ): Promise<{ headers: Record<string, string>; url: string }> {
      const headers = {
        "content-length": String(options.size),
        "content-type": options.contentType,
      };
      const url = await presign(key, "PUT", options.expiresIn, { headers });
      // Browsers set Content-Length themselves and refuse to send it.
      return { headers: { "content-type": options.contentType }, url };
    },
  };
}
