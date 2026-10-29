import { ArrowUpRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CopyCommand } from "@/components/home/copy-command";
import { Badge } from "@/components/ui/badge";
import { type Library, libraryGroups } from "@/lib/libraries";

export const metadata: Metadata = {
  alternates: { canonical: "/libraries" },
  description:
    "Other shadcn registries we suggest for the screens Runqora doesn't build: auth, billing, uploads, data tables, status pages and onboarding.",
  title: "Recommended libraries",
};

export default function LibrariesPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-16 sm:px-6 md:py-20">
      <div className="mb-12 flex max-w-2xl flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Recommended libraries
        </h1>
        <p className="text-muted-foreground text-lg text-pretty">
          Runqora only builds screens nobody else does. These shadcn registries
          cover the rest, and each one installs with the same CLI. We aren't
          affiliated with any of them.
        </p>
        <p className="text-muted-foreground text-sm">
          Each registry is in the shadcn directory, so you can list what it
          offers by its namespace:
        </p>
        <CopyCommand command="npx shadcn@latest search @diceui" />
      </div>

      <div className="flex flex-col gap-14">
        {libraryGroups.map((group) => (
          <section
            aria-labelledby={headingId(group.title)}
            className="grid gap-6 lg:grid-cols-[16rem_1fr] lg:gap-10"
            key={group.title}
          >
            <div className="flex flex-col gap-1.5">
              <h2
                className="text-xl font-semibold tracking-tight"
                id={headingId(group.title)}
              >
                {group.title}
              </h2>
              <p className="text-muted-foreground text-sm">
                {group.description}
              </p>
            </div>
            <ul className="grid gap-4 md:grid-cols-2">
              {group.libraries.map((library) => (
                <LibraryCard key={library.namespace} library={library} />
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="text-muted-foreground mt-16 border-t pt-8 text-sm">
        Know a registry that belongs here?{" "}
        <Link
          className="text-foreground font-medium underline underline-offset-4"
          href="https://github.com/amblydia/runqora-ui/issues"
        >
          Open an issue
        </Link>
        .
      </p>
    </main>
  );
}

function LibraryCard({ library }: { library: Library }) {
  return (
    <li
      className="bg-card flex min-w-0 scroll-mt-20 flex-col gap-4 rounded-xl border p-5"
      id={library.namespace.slice(1)}
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium">
            <Link
              className="focus-visible:ring-ring/50 inline-flex items-center gap-1 rounded-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3"
              href={library.homepage}
              rel="noopener"
              target="_blank"
            >
              {library.name}
              <ArrowUpRightIcon
                aria-hidden="true"
                className="text-muted-foreground size-3.5"
              />
              <span className="sr-only">(opens in a new tab)</span>
            </Link>
          </h3>
          {library.perStyle ? (
            <Badge variant="secondary">Per-style builds</Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground text-sm">{library.description}</p>
      </div>
      <p className="text-sm">{library.why}</p>
      <code className="bg-muted text-muted-foreground mt-auto w-fit rounded-md px-1.5 py-0.5 font-mono text-xs">
        {library.namespace}
      </code>
    </li>
  );
}

function headingId(title: string) {
  return title.toLowerCase().replaceAll(" ", "-");
}
