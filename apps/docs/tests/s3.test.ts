/// <reference types="bun" />

// Tests for the S3 client in registry/lib/storage/s3.ts.
//
// The first group fakes `fetch` and checks the requests and the parsing.
// The second runs against a real S3-compatible server when S3_TEST_ENDPOINT
// is set, as CI does with RustFS:
//
//   S3_TEST_ENDPOINT=http://localhost:9000 S3_TEST_ACCESS_KEY_ID=... \
//     S3_TEST_SECRET_ACCESS_KEY=... bun test

import { describe, expect, test } from "bun:test";
import { AwsClient } from "aws4fetch";
import { createS3Client, S3Error } from "@/lib/storage/s3";

const credentials = {
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
};

const SIGNATURE = /^[0-9a-f]{64}$/u;

const LIST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Name>assets</Name>
  <Prefix>uploads/</Prefix>
  <IsTruncated>true</IsTruncated>
  <NextContinuationToken>token+/=</NextContinuationToken>
  <Contents>
    <Key>uploads/q&amp;a &lt;final&gt; &#233;t&#xE9;.pdf</Key>
    <LastModified>2026-09-01T10:15:30.000Z</LastModified>
    <ETag>&quot;9b2cf535f27731c974343645a3985328&quot;</ETag>
    <Size>48213</Size>
  </Contents>
  <CommonPrefixes><Prefix>uploads/avatars/</Prefix></CommonPrefixes>
</ListBucketResult>`;

function fakeFetch(...responses: Response[]) {
  const requests: Request[] = [];
  const fetchFake = (input: RequestInfo | URL) => {
    requests.push(input instanceof Request ? input : new Request(input));
    const response = responses.shift();
    return response
      ? Promise.resolve(response)
      : Promise.reject(new TypeError("fetch failed"));
  };
  return { fetch: fetchFake as typeof fetch, requests };
}

function errorXml(code: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code></Error>`;
}

describe("with a fake fetch", () => {
  test("lists objects and folders", async () => {
    const { fetch, requests } = fakeFetch(new Response(LIST_XML));
    const s3 = createS3Client({
      ...credentials,
      bucket: "assets",
      fetch,
      region: "eu-central-1",
    });

    const listing = await s3.listObjects({
      cursor: "abc",
      limit: 50,
      prefix: "uploads/",
    });

    expect(listing).toEqual({
      folders: ["uploads/avatars/"],
      nextCursor: "token+/=",
      objects: [
        {
          etag: "9b2cf535f27731c974343645a3985328",
          key: "uploads/q&a <final> été.pdf",
          lastModified: "2026-09-01T10:15:30.000Z",
          size: 48_213,
        },
      ],
    });
    const url = new URL(requests[0]?.url ?? "");
    expect(url.origin).toBe("https://assets.s3.eu-central-1.amazonaws.com");
    expect(url.searchParams.get("list-type")).toBe("2");
    expect(url.searchParams.get("delimiter")).toBe("/");
    expect(url.searchParams.get("max-keys")).toBe("50");
    expect(url.searchParams.get("prefix")).toBe("uploads/");
    expect(url.searchParams.get("continuation-token")).toBe("abc");
    expect(requests[0]?.headers.get("authorization")).toStartWith(
      "AWS4-HMAC-SHA256"
    );
  });

  test("uses path-style URLs with an endpoint", async () => {
    const { fetch, requests } = fakeFetch(new Response(null, { status: 204 }));
    const s3 = createS3Client({
      ...credentials,
      bucket: "assets",
      endpoint: "https://account.r2.cloudflarestorage.com/",
      fetch,
      region: "auto",
    });

    await s3.deleteObject("a folder/r&d.txt");

    expect(requests[0]?.method).toBe("DELETE");
    expect(requests[0]?.url).toBe(
      "https://account.r2.cloudflarestorage.com/assets/a%20folder/r%26d.txt"
    );
  });

  test("reads details and metadata, and null for a missing object", async () => {
    const { fetch } = fakeFetch(
      new Response(null, {
        headers: {
          "content-length": "1024",
          "content-type": "image/png",
          etag: '"abc"',
          "last-modified": "Wed, 02 Sep 2026 08:00:00 GMT",
          "x-amz-meta-uploaded-by": "jean",
        },
      }),
      new Response(null, { status: 404 })
    );
    const s3 = createS3Client({
      ...credentials,
      bucket: "assets",
      fetch,
      region: "us-east-1",
    });

    expect(await s3.headObject("logo.png")).toEqual({
      contentType: "image/png",
      etag: "abc",
      key: "logo.png",
      lastModified: "2026-09-02T08:00:00.000Z",
      metadata: { "uploaded-by": "jean" },
      size: 1024,
    });
    expect(await s3.headObject("missing.png")).toBeNull();
  });

  test("turns S3 error codes and statuses into S3Errors", async () => {
    const { fetch } = fakeFetch(
      new Response(errorXml("AccessDenied"), { status: 403 }),
      new Response(errorXml("SignatureDoesNotMatch"), { status: 403 }),
      new Response("", { status: 503 })
    );
    const s3 = createS3Client({
      ...credentials,
      bucket: "assets",
      fetch,
      region: "us-east-1",
    });

    const codes: string[] = [];
    for (const _ of [1, 2, 3, 4]) {
      // biome-ignore lint/performance/noAwaitInLoops: each call takes the next fake response.
      await s3.listObjects().catch((error: unknown) => {
        expect(error).toBeInstanceOf(S3Error);
        codes.push((error as S3Error).code);
      });
    }
    // The fourth call finds no response, as if the network failed.
    expect(codes).toEqual([
      "permission_denied",
      "invalid_credentials",
      "unavailable",
      "unavailable",
    ]);
  });

  test("fails a copy whose 200 response holds an error", async () => {
    const { fetch } = fakeFetch(new Response(errorXml("InternalError")));
    const s3 = createS3Client({
      ...credentials,
      bucket: "assets",
      fetch,
      region: "us-east-1",
    });

    await expect(s3.moveObject("a.txt", "b.txt")).rejects.toBeInstanceOf(
      S3Error
    );
  });

  test("signs downloads that save under the file's name", async () => {
    const s3 = createS3Client({
      ...credentials,
      bucket: "assets",
      region: "us-east-1",
    });

    const url = new URL(
      await s3.signDownloadUrl("reports/résumé.pdf", {
        downloadAs: "résumé.pdf",
        expiresIn: 9_999_999,
      })
    );

    expect(url.searchParams.get("X-Amz-Expires")).toBe("604800");
    expect(url.searchParams.get("response-content-disposition")).toBe(
      `attachment; filename="r_sum_.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf`
    );
    expect(url.searchParams.get("X-Amz-Signature")).toMatch(SIGNATURE);
  });

  test("signs uploads for one type and size", async () => {
    const s3 = createS3Client({
      ...credentials,
      bucket: "assets",
      region: "us-east-1",
    });

    const upload = await s3.signUploadUrl("photo.jpg", {
      contentType: "image/jpeg",
      expiresIn: 600,
      size: 2048,
    });

    const url = new URL(upload.url);
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toBe(
      "content-length;content-type;host"
    );
    expect(upload.headers).toEqual({ "content-type": "image/jpeg" });
  });
});

const endpoint = process.env.S3_TEST_ENDPOINT;

describe.skipIf(!endpoint)("against an S3-compatible server", () => {
  const config = {
    accessKeyId: process.env.S3_TEST_ACCESS_KEY_ID ?? "",
    bucket: `runqora-test-${Date.now()}`,
    endpoint,
    region: process.env.S3_TEST_REGION ?? "us-east-1",
    secretAccessKey: process.env.S3_TEST_SECRET_ACCESS_KEY ?? "",
  };
  const s3 = createS3Client(config);

  async function upload(key: string, body: string, contentType: string) {
    const signed = await s3.signUploadUrl(key, {
      contentType,
      expiresIn: 60,
      size: new TextEncoder().encode(body).length,
    });
    return fetch(signed.url, {
      body,
      headers: signed.headers,
      method: "PUT",
    });
  }

  test("creates the test bucket", async () => {
    const aws = new AwsClient({ ...config, service: "s3" });
    const response = await aws.fetch(`${endpoint}/${config.bucket}`, {
      method: "PUT",
    });
    expect(response.status).toBe(200);
  });

  test("uploads with a signed URL and reads the details", async () => {
    const response = await upload("docs/a & b.txt", "hello", "text/plain");
    expect(response.status).toBe(200);

    const details = await s3.headObject("docs/a & b.txt");
    expect(details?.size).toBe(5);
    expect(details?.contentType).toBe("text/plain");
    expect(details?.lastModified).toBeString();
  });

  test("rejects an upload of another type than the one signed", async () => {
    const signed = await s3.signUploadUrl("docs/typed.txt", {
      contentType: "text/plain",
      expiresIn: 60,
      size: 5,
    });
    const response = await fetch(signed.url, {
      body: "hello",
      headers: { "content-type": "text/html" },
      method: "PUT",
    });
    expect(response.ok).toBe(false);
  });

  test("lists folders and files, page by page", async () => {
    await upload("docs/b.txt", "b", "text/plain");
    await upload("docs/c.txt", "c", "text/plain");
    await upload("docs/nested/d.txt", "d", "text/plain");

    const top = await s3.listObjects();
    expect(top.folders).toEqual(["docs/"]);
    expect(top.objects).toEqual([]);

    const first = await s3.listObjects({ limit: 2, prefix: "docs/" });
    expect(first.nextCursor).toBeString();
    const rest = await s3.listObjects({
      cursor: first.nextCursor,
      limit: 10,
      prefix: "docs/",
    });
    const keys = [...first.objects, ...rest.objects].map(
      (object) => object.key
    );
    const folders = [...first.folders, ...rest.folders];
    expect(keys.sort()).toEqual(["docs/a & b.txt", "docs/b.txt", "docs/c.txt"]);
    expect(folders).toEqual(["docs/nested/"]);
  });

  test("signs downloads that return the file", async () => {
    const url = await s3.signDownloadUrl("docs/a & b.txt", {
      downloadAs: "a & b.txt",
      expiresIn: 60,
    });
    const response = await fetch(url);
    expect(await response.text()).toBe("hello");
    expect(response.headers.get("content-disposition")).toContain("attachment");
  });

  test("moves and deletes files", async () => {
    await s3.moveObject("docs/b.txt", "moved/b.txt");
    expect(await s3.headObject("docs/b.txt")).toBeNull();
    expect((await s3.headObject("moved/b.txt"))?.size).toBe(1);

    await s3.deleteObject("moved/b.txt");
    expect(await s3.headObject("moved/b.txt")).toBeNull();
  });

  test("reports a wrong secret key", async () => {
    const wrong = createS3Client({ ...config, secretAccessKey: "wrong" });
    const error = await wrong.listObjects().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(S3Error);
    expect((error as S3Error).code).toBe("invalid_credentials");
  });
});
