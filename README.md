# Runqora UI

A [shadcn registry](https://ui.shadcn.com/docs/registry) of components for the
screens most SaaS apps need and shadcn/ui doesn't ship. Install them with the
shadcn CLI and own the code. Nothing runs on Runqora's side.

Docs: [runqora.dev](https://runqora.dev)

```bash
npx shadcn@latest registry add @runqora=https://runqora.dev/r/{style}/{name}.json
npx shadcn@latest add @runqora/file-browser @runqora/storage-actions
```

## Principles

- **shadcn's look.** Components use shadcn/ui and your theme's CSS variables,
  with no styles of their own.
- **Radix and Base UI.** Each component is published for both and tested in
  both.
- **Your icon library.** Icons follow the `iconLibrary` in `components.json`.
- **Your backend.** Components take data and callbacks. Where a server part
  can't be avoided, it ships as a small file you own.
- **Accessible and responsive**, with few dependencies.

## Roadmap

One set at a time. Each ships, gets announced and gets feedback before the
next starts.

1. **File browser for S3-compatible buckets**. Browse folders, preview, see
   details, upload, download, copy links, rename or move, and delete files in
   the Amazon S3 or Cloudflare R2 bucket you already have. Files go straight
   between the browser and the bucket through signed URLs, with server
   actions and a small S3 client you own.
2. **Audit log viewer.** A filterable activity table and a detail view for
   one entry.
3. **Webhooks.** Endpoint manager, delivery log, and a payload and response
   viewer with resend.

Not planned, because good registries already cover them:

- Sign-in, account and Better Auth admin screens:
  [Better Auth UI](https://better-auth-ui.com).
- Upload components: [UploadCN](https://uploadcn.dev) and
  [Better Upload](https://better-upload.com).
- Billing and usage: [BillingSDK](https://billingsdk.com).
- Status pages: [OpenStatus](https://openstatus.dev/registry).

## Development

Uses [Bun](https://bun.sh).

```bash
bun install
bun run dev              # docs site on http://localhost:3000
bun run registry:build   # writes apps/docs/public/r
bun run check            # lint, formatting and types
bun run test             # tests
```

The S3 client's tests also run against a real S3-compatible server when
`S3_TEST_ENDPOINT`, `S3_TEST_ACCESS_KEY_ID` and `S3_TEST_SECRET_ACCESS_KEY` are
set. CI uses [RustFS](https://rustfs.com).

Registry source is in `apps/docs/registry`, listed in
`apps/docs/registry.json`. Components are written once, Radix-style, with an
`IconPlaceholder` for each icon. The shadcn CLI adapts them to Base UI and to
the project's icon library when it installs them. A file that needs different
code on Base UI gets a copy at the same path under `apps/docs/registry/base/`.

To test installs the way CI does, start the built docs site and run:

```bash
bun scripts/test-install.ts --style base-nova --icons hugeicons \
  --registry http://localhost:3000
```

## License

[MIT](LICENSE)
