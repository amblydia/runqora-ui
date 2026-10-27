import type {
  StorageObjectDetails,
  StorageResult,
  StorageSource,
} from "@/lib/storage/types";

// An in-memory bucket for the docs previews. It answers like the server
// actions would, with a short delay, and forgets everything on reload.

const LATENCY_MS = 300;
const UPLOAD_STEPS = 10;
const UPLOAD_STEP_MS = 80;

/** Files whose preview is a real image in public/demo. */
const PREVIEWS: Record<string, string> = {
  "images/logo.svg": "/demo/logo.svg",
  "images/office.svg": "/demo/office.svg",
};

const SAMPLE: [key: string, size: number, contentType: string, date: string][] =
  [
    ["README.md", 1840, "text/markdown", "2026-03-02T09:12:00Z"],
    [
      "exports/users-2026-10-01.csv",
      284_112,
      "text/csv",
      "2026-10-01T03:00:00Z",
    ],
    [
      "exports/users-2026-10-08.csv",
      291_406,
      "text/csv",
      "2026-10-08T03:00:00Z",
    ],
    ["images/logo.svg", 488, "image/svg+xml", "2026-01-14T16:40:00Z"],
    ["images/office.svg", 497, "image/svg+xml", "2026-05-21T11:05:00Z"],
    [
      "invoices/2025/december.pdf",
      51_877,
      "application/pdf",
      "2026-01-03T08:30:00Z",
    ],
    [
      "invoices/2026/october.pdf",
      48_213,
      "application/pdf",
      "2026-10-02T08:30:00Z",
    ],
    [
      "invoices/2026/september.pdf",
      47_950,
      "application/pdf",
      "2026-09-02T08:30:00Z",
    ],
  ];

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ok<T>(data: T): StorageResult<T> {
  return { data, ok: true };
}

function fail<T>(error: string): StorageResult<T> {
  return { error, ok: false };
}

export function createDemoStorage(): StorageSource {
  const objects = new Map<string, StorageObjectDetails>(
    SAMPLE.map(([key, size, contentType, date]) => [
      key,
      {
        contentType,
        etag: null,
        key,
        lastModified: date,
        metadata: {},
        size,
      },
    ])
  );
  const pending = new Map<string, StorageObjectDetails>();

  return {
    async createUpload({ contentType, key, size }) {
      await wait(LATENCY_MS);
      if (objects.has(key)) {
        return fail("A file with that name already exists.");
      }
      const url = `memory:${key}`;
      pending.set(url, {
        contentType,
        etag: null,
        key,
        lastModified: null,
        metadata: {},
        size,
      });
      return ok({ headers: {}, method: "PUT", url });
    },

    async deleteObject(key) {
      await wait(LATENCY_MS);
      objects.delete(key);
      return ok(null);
    },

    async getDownloadUrl(key, { download }) {
      await wait(LATENCY_MS);
      const preview = PREVIEWS[key];
      if (preview && !download) {
        return ok(new URL(preview, window.location.origin).toString());
      }
      const text = `This is ${key} from the Runqora UI docs demo. A real bucket returns a signed link to the file.\n`;
      return ok(URL.createObjectURL(new Blob([text], { type: "text/plain" })));
    },

    async getObject(key) {
      await wait(LATENCY_MS);
      const object = objects.get(key);
      return object ? ok(object) : fail("The file no longer exists.");
    },

    async list({ prefix, startsWith = "" }) {
      await wait(LATENCY_MS);
      const folders = new Set<string>();
      const files: StorageObjectDetails[] = [];
      for (const object of objects.values()) {
        if (!object.key.startsWith(prefix + startsWith)) {
          continue;
        }
        const rest = object.key.slice(prefix.length);
        const slash = rest.indexOf("/");
        if (slash === -1) {
          files.push(object);
        } else {
          folders.add(prefix + rest.slice(0, slash + 1));
        }
      }
      return ok({
        folders: [...folders].sort(),
        nextCursor: null,
        objects: files.sort((a, b) => a.key.localeCompare(b.key)),
      });
    },

    async moveObject(fromKey, toKey) {
      await wait(LATENCY_MS);
      const object = objects.get(fromKey);
      if (!object) {
        return fail("The file no longer exists.");
      }
      if (fromKey !== toKey) {
        if (objects.has(toKey)) {
          return fail("A file with that name already exists.");
        }
        objects.delete(fromKey);
        objects.set(toKey, { ...object, key: toKey });
      }
      return ok(null);
    },

    async sendUpload(upload, _file, onProgress) {
      const object = pending.get(upload.url);
      if (!object) {
        return "rejected";
      }
      for (let step = 1; step <= UPLOAD_STEPS; step += 1) {
        // biome-ignore lint/performance/noAwaitInLoops: the steps pretend to be upload progress.
        await wait(UPLOAD_STEP_MS);
        onProgress(step / UPLOAD_STEPS);
      }
      pending.delete(upload.url);
      objects.set(object.key, {
        ...object,
        lastModified: new Date().toISOString(),
      });
      return "ok";
    },
  };
}
