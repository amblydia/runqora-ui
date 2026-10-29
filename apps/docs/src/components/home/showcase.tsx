"use client";

import {
  ArrowRightIcon,
  FolderOpenIcon,
  GlobeIcon,
  type LucideIcon,
  ScrollTextIcon,
  WebhookIcon,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import { AuditLogViewerDemo } from "@/components/demos/audit-log-viewer-demo";
import { CustomDomainsDemo } from "@/components/demos/custom-domains-demo";
import { FileBrowserDemo } from "@/components/demos/file-browser-demo";
import { WebhookEndpointsDemo } from "@/components/demos/webhook-endpoints-demo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ComponentSet {
  Demo: ComponentType;
  description: string;
  href: string;
  icon: LucideIcon;
  items: { href: string; name: string }[];
  label: string;
  value: string;
}

const sets: ComponentSet[] = [
  {
    Demo: FileBrowserDemo,
    description:
      "Browse, preview, rename, move and share files in the S3 or R2 bucket you already have. Files go straight between the browser and your bucket.",
    href: "/docs/storage/file-browser",
    icon: FolderOpenIcon,
    items: [
      { href: "/docs/storage/file-browser", name: "file-browser" },
      { href: "/docs/storage/object-actions", name: "object-actions" },
      { href: "/docs/storage/object-details", name: "object-details" },
      { href: "/docs/storage/upload-button", name: "upload-button" },
      { href: "/docs/storage/s3-client", name: "s3" },
      { href: "/docs/storage/server", name: "storage-actions" },
    ],
    label: "File browser",
    value: "storage",
  },
  {
    Demo: AuditLogViewerDemo,
    description:
      "Show who did what in your app, with search, filters and event details. Events stay in your own Postgres database.",
    href: "/docs/audit/audit-log-viewer",
    icon: ScrollTextIcon,
    items: [
      { href: "/docs/audit/audit-log-viewer", name: "audit-log-viewer" },
      { href: "/docs/audit/audit-event-details", name: "audit-event-details" },
      { href: "/docs/audit/server", name: "audit-postgres" },
      { href: "/docs/audit/server", name: "audit-actions" },
    ],
    label: "Audit log",
    value: "audit",
  },
  {
    Demo: WebhookEndpointsDemo,
    description:
      "Let customers add endpoints, pick events, rotate secrets and resend deliveries, for whatever sends your webhooks.",
    href: "/docs/webhooks/webhook-endpoints",
    icon: WebhookIcon,
    items: [
      { href: "/docs/webhooks/webhook-endpoints", name: "webhook-endpoints" },
      {
        href: "/docs/webhooks/webhook-delivery-log",
        name: "webhook-delivery-log",
      },
      {
        href: "/docs/webhooks/webhook-delivery-details",
        name: "webhook-delivery-details",
      },
    ],
    label: "Webhooks",
    value: "webhooks",
  },
  {
    Demo: CustomDomainsDemo,
    description:
      "Customers connect their own domains, see the DNS records to create, and watch each one turn active.",
    href: "/docs/domains/custom-domains",
    icon: GlobeIcon,
    items: [
      { href: "/docs/domains/custom-domains", name: "custom-domains" },
      { href: "/docs/domains/domain-setup", name: "domain-setup" },
    ],
    label: "Custom domains",
    value: "domains",
  },
];

/** Live versions of each component set, running against in-memory data. */
export function Showcase() {
  return (
    <Tabs defaultValue={sets[0].value}>
      <div className="overflow-x-auto pb-1">
        <TabsList className="h-9!">
          {sets.map((set) => (
            <TabsTrigger className="px-3" key={set.value} value={set.value}>
              <set.icon />
              {set.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {sets.map((set) => (
        <TabsContent
          className="bg-card overflow-hidden rounded-xl border shadow-sm"
          key={set.value}
          value={set.value}
        >
          <div className="flex flex-col gap-3 border-b px-4 py-4 sm:px-6 md:flex-row md:items-start md:justify-between md:gap-8">
            <div className="flex max-w-2xl flex-col gap-3">
              <p className="text-muted-foreground">{set.description}</p>
              <ul className="flex flex-wrap gap-1.5">
                {set.items.map((item) => (
                  <li key={item.name}>
                    <Link
                      className="bg-muted hover:bg-accent focus-visible:ring-ring/50 rounded-md px-1.5 py-0.5 font-mono text-xs outline-none focus-visible:ring-3"
                      href={item.href}
                    >
                      {item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <Link
              className="text-foreground inline-flex shrink-0 items-center gap-1 font-medium underline-offset-4 hover:underline"
              href={set.href}
            >
              Read the docs
              <ArrowRightIcon className="size-4" />
            </Link>
          </div>
          <div className="bg-background min-h-[28rem] p-4 sm:p-6">
            <set.Demo />
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
