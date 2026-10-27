"use server";

// Server actions that give the file browser access to one bucket. Pass them
// to <FileBrowser source={{ list, getObject, ... }} />.
//
// Every server action is a public endpoint that anyone can call, so each one
// starts with `authorize()`. Write that check before you use the browser.

import { createS3Client, S3Error } from "@/lib/storage/s3";
import type {
  SignedUpload,
  StorageListing,
  StorageObjectDetails,
  StorageResult,
} from "@/lib/storage/types";

/**
 * Keeps the browser inside one folder of the bucket, such as "uploads/".
 * Keys outside it can't be read or changed, and the browser shows the folder
 * as the top. Leave empty to show the whole bucket.
 */
const ROOT = "";

/** Largest file the browser may upload, in bytes. One PUT can't exceed 5 GB. */
const MAX_UPLOAD_BYTES = 100 * 1000 * 1000;

/** How long links from Download and Copy link work, in seconds. */
const LINK_EXPIRY_SECONDS = 60 * 60;

/** How long a signed upload stays valid, in seconds. */
const UPLOAD_EXPIRY_SECONDS = 10 * 60;

const PAGE_SIZE = 100;
const MAX_KEY_BYTES = 1024;
const CONTROL_CHARACTERS = /\p{Cc}/u;

/** An error whose message is safe to show to the person using the browser. */
class StorageActionError extends Error {}

/**
 * Rejects when the person making the request may not use the bucket. For
 * example, with Better Auth:
 *
 *   async function authorize() {
 *     const session = await auth.api.getSession({ headers: await headers() });
 *     if (session?.user.role !== "admin") {
 *       throw new StorageActionError("You are not allowed to manage files.");
 *     }
 *   }
 */
function authorize(): Promise<void> {
  return Promise.reject(
    new StorageActionError(
      "Add an authorization check to lib/storage/actions.ts to use the file browser."
    )
  );
}

function readEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Set ${name} to use the file browser.`);
  }
  return value;
}

let client: ReturnType<typeof createS3Client> | undefined;

function getClient() {
  client ??= createS3Client({
    accessKeyId: readEnv("S3_ACCESS_KEY_ID"),
    bucket: readEnv("S3_BUCKET"),
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || "auto",
    secretAccessKey: readEnv("S3_SECRET_ACCESS_KEY"),
  });
  return client;
}

async function run<T>(task: () => Promise<T>): Promise<StorageResult<T>> {
  try {
    await authorize();
    return { data: await task(), ok: true };
  } catch (error) {
    if (error instanceof StorageActionError || error instanceof S3Error) {
      return { error: error.message, ok: false };
    }
    console.error(error);
    return { error: "Something went wrong. Try again.", ok: false };
  }
}

/** The bucket key for a key or folder the browser sent, checked. */
function toBucketKey(value: unknown, kind: "file" | "folder"): string {
  if (typeof value !== "string" || CONTROL_CHARACTERS.test(value)) {
    throw new StorageActionError("That name can't be used.");
  }
  if (kind === "file" && (value === "" || value.endsWith("/"))) {
    throw new StorageActionError("Enter a file name.");
  }
  if (kind === "folder" && value !== "" && !value.endsWith("/")) {
    throw new StorageActionError("That folder can't be opened.");
  }
  if (value.startsWith("/") || value.includes("//")) {
    throw new StorageActionError(
      "Names can't start with or contain empty folders."
    );
  }
  const key = ROOT + value;
  if (new TextEncoder().encode(key).length > MAX_KEY_BYTES) {
    throw new StorageActionError("That name is too long.");
  }
  return key;
}

/** The key as the browser sees it, without the root folder. */
function fromBucketKey(key: string): string {
  return key.slice(ROOT.length);
}

async function assertFree(key: string): Promise<void> {
  if (await getClient().headObject(key)) {
    throw new StorageActionError("A file with that name already exists.");
  }
}

export async function list(input: {
  cursor?: string | null;
  prefix: string;
  startsWith?: string;
}): Promise<StorageResult<StorageListing>> {
  return await run(async () => {
    const prefix = toBucketKey(input.prefix, "folder");
    const startsWith = input.startsWith ?? "";
    if (
      typeof startsWith !== "string" ||
      startsWith.includes("/") ||
      CONTROL_CHARACTERS.test(startsWith) ||
      startsWith.length > MAX_KEY_BYTES
    ) {
      throw new StorageActionError("Search for the start of one name.");
    }
    const listing = await getClient().listObjects({
      cursor: typeof input.cursor === "string" ? input.cursor : undefined,
      limit: PAGE_SIZE,
      prefix: prefix + startsWith,
    });
    return {
      folders: listing.folders.map(fromBucketKey),
      nextCursor: listing.nextCursor,
      objects: listing.objects
        // Some tools store an empty object as a folder marker.
        .filter((object) => object.key !== prefix)
        .map((object) => ({ ...object, key: fromBucketKey(object.key) })),
    };
  });
}

export async function getObject(
  key: string
): Promise<StorageResult<StorageObjectDetails>> {
  return await run(async () => {
    const object = await getClient().headObject(toBucketKey(key, "file"));
    if (!object) {
      throw new StorageActionError("The file no longer exists.");
    }
    return { ...object, key: fromBucketKey(object.key) };
  });
}

export async function getDownloadUrl(
  key: string,
  options: { download: boolean }
): Promise<StorageResult<string>> {
  return await run(() => {
    const bucketKey = toBucketKey(key, "file");
    return getClient().signDownloadUrl(bucketKey, {
      downloadAs:
        options.download === true
          ? bucketKey.slice(bucketKey.lastIndexOf("/") + 1)
          : undefined,
      expiresIn: LINK_EXPIRY_SECONDS,
    });
  });
}

export async function createUpload(input: {
  contentType: string;
  key: string;
  size: number;
}): Promise<StorageResult<SignedUpload>> {
  return await run(async () => {
    const key = toBucketKey(input.key, "file");
    if (
      !Number.isSafeInteger(input.size) ||
      input.size < 0 ||
      input.size > MAX_UPLOAD_BYTES
    ) {
      throw new StorageActionError(
        `Files can be up to ${MAX_UPLOAD_BYTES / 1000 / 1000} MB.`
      );
    }
    const contentType =
      typeof input.contentType === "string" &&
      input.contentType.length > 0 &&
      input.contentType.length <= 255
        ? input.contentType
        : "application/octet-stream";
    await assertFree(key);
    const signed = await getClient().signUploadUrl(key, {
      contentType,
      expiresIn: UPLOAD_EXPIRY_SECONDS,
      size: input.size,
    });
    return { ...signed, method: "PUT" };
  });
}

export async function moveObject(
  fromKey: string,
  toKey: string
): Promise<StorageResult<null>> {
  return await run(async () => {
    const from = toBucketKey(fromKey, "file");
    const to = toBucketKey(toKey, "file");
    if (from !== to) {
      await assertFree(to);
      await getClient().moveObject(from, to);
    }
    return null;
  });
}

export async function deleteObject(key: string): Promise<StorageResult<null>> {
  return await run(async () => {
    await getClient().deleteObject(toBucketKey(key, "file"));
    return null;
  });
}
