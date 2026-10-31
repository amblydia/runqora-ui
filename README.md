# Runqora UI

A [shadcn registry](https://ui.shadcn.com/docs/registry) of components for the
screens most SaaS apps need and shadcn/ui doesn't ship. Install them with the
shadcn CLI and own the code. Nothing runs on Runqora's side.

Docs: [runqora.dev](https://runqora.dev) · [Changelog](https://runqora.dev/docs/changelog)

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
2. **Audit log viewer.** See who did what in your app: filter by actor,
   action, outcome and date, and open an event to see what it changed. Events
   live in your own Postgres database, through any Postgres library or ORM,
   with server actions that scope every query to what the person may see.
3. **Webhooks.** Let your customers add and manage the endpoints your app
   sends webhooks to, and see each delivery's payload and responses, with
   resend. You bring the backend that sends them, your own code or a service
   such as [Svix](https://www.svix.com): the components call a small
   interface you write for it.
4. **Custom domains.** Let your customers connect their own domains: add
   one, see the DNS records to create, and watch it become active. Your
   backend serves the domains, such as Cloudflare for SaaS, Vercel or your
   own proxy, through a small interface you write for it.

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
set. CI uses [RustFS](https://rustfs.com). The audit store's tests run against
[PGlite](https://pglite.dev), and also against a Postgres server when
`POSTGRES_TEST_URL` is set, as in CI.

Registry source is in `apps/docs/registry`, listed in
`apps/docs/registry.json`. Components are written once, Radix-style, with an
`IconPlaceholder` for each icon. They may use another registry's items, such
as [Dice UI](https://diceui.com)'s, when those are published for both Radix
and Base UI, follow the project's icon library, and need no app-wide setup. The shadcn CLI adapts them to Base UI and to
the project's icon library when it installs them. A file that needs different
code on Base UI gets a copy at the same path under `apps/docs/registry/base/`.

To test installs the way CI does, start the built docs site and run:

```bash
bun scripts/test-install.ts --style base-nova --icons hugeicons \
  --registry http://localhost:3000
```

## License

[MIT](LICENSE)
