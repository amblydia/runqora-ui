// Other shadcn registries we suggest for the screens Runqora doesn't build.
// Each one is listed in the shadcn registry directory, so `npx shadcn add
// @namespace/item` works without adding the registry first.

export interface Library {
  description: string;
  homepage: string;
  name: string;
  namespace: string;
  /** Publishes a separate build per shadcn style, so Base UI projects get Base UI code. */
  perStyle: boolean;
  /** Why it's on the list, in a sentence. */
  why: string;
}

export interface LibraryGroup {
  description: string;
  libraries: Library[];
  title: string;
}

export const libraryGroups: LibraryGroup[] = [
  {
    description: "Sign-in, account settings and everything around users.",
    libraries: [
      {
        description:
          "Sign-in and sign-up forms, account settings, organizations, API keys and admin user management for Better Auth.",
        homepage: "https://better-auth-ui.com",
        name: "Better Auth UI",
        namespace: "@better-auth-ui",
        perStyle: true,
        why: "If you use Better Auth, it covers the account screens, so Runqora doesn't.",
      },
    ],
    title: "Auth and accounts",
  },
  {
    description: "Pricing, plans and what a customer pays.",
    libraries: [
      {
        description:
          "Pricing tables, subscription management, usage meters and invoice history for SaaS billing.",
        homepage: "https://billingsdk.com",
        name: "BillingSDK",
        namespace: "@billingsdk",
        perStyle: false,
        why: "The most complete set of billing screens in the directory.",
      },
    ],
    title: "Billing",
  },
  {
    description:
      "Getting files into a bucket. Pair one with Runqora's file browser to manage them afterwards.",
    libraries: [
      {
        description:
          "Dropzones, upload queues and resumable uploads to S3 and R2, with blocks for every style.",
        homepage: "https://uploadcn.dev",
        name: "UploadCN",
        namespace: "@uploadcn",
        perStyle: true,
        why: "Covers large and resumable uploads that the file browser's upload button leaves out.",
      },
      {
        description:
          "Direct uploads from the browser to any S3-compatible service, with a small server route you own.",
        homepage: "https://better-upload.com",
        name: "Better Upload",
        namespace: "@better-upload",
        perStyle: false,
        why: "A lighter option when you only need an upload field.",
      },
    ],
    title: "Uploads",
  },
  {
    description:
      "Components shadcn/ui doesn't ship, to build your own screens.",
    libraries: [
      {
        description:
          "Accessible components such as a data table, kanban board, sortable lists, tags input and mentions.",
        homepage: "https://www.diceui.com",
        name: "Dice UI",
        namespace: "@diceui",
        perStyle: true,
        why: "Runqora's audit log viewer and webhook delivery log install its faceted filter and relative-time card.",
      },
      {
        description:
          "Data tables with faceted filters, sorting, infinite scroll, a row detail sheet and server-side data.",
        homepage: "https://data-table.openstatus.dev",
        name: "Data Table Filters",
        namespace: "@data-table-filters",
        perStyle: false,
        why: "A good starting point for log and admin tables over large data sets.",
      },
      {
        description:
          "A large library of components and patterns for shadcn projects.",
        homepage: "https://reui.io",
        name: "ReUI",
        namespace: "@reui",
        perStyle: true,
        why: "Worth checking before you build a pattern from scratch.",
      },
    ],
    title: "Building blocks",
  },
  {
    description: "Telling customers what's going on.",
    libraries: [
      {
        description: "Components for building status pages.",
        homepage: "https://openstatus.dev/registry",
        name: "OpenStatus",
        namespace: "@openstatus",
        perStyle: false,
        why: "From the team behind the open-source OpenStatus monitoring service.",
      },
      {
        description:
          "Onboarding tours that point new users at parts of your app.",
        homepage: "https://onboarding-tour.vercel.app",
        name: "Onboarding Tour",
        namespace: "@tour",
        perStyle: false,
        why: "A small, focused component for first-run walkthroughs.",
      },
    ],
    title: "Status and onboarding",
  },
];
