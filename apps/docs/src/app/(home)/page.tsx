import {
  ArrowRightIcon,
  LayersIcon,
  type LucideIcon,
  PaletteIcon,
  ServerIcon,
  ShapesIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { CopyCommand } from "@/components/home/copy-command";
import { Showcase } from "@/components/home/showcase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { libraryGroups } from "@/lib/libraries";
import { gitConfig } from "@/lib/shared";

const principles: { description: string; icon: LucideIcon; title: string }[] = [
  {
    description:
      "Built from shadcn/ui components and your theme's CSS variables, with no styles of their own to override.",
    icon: PaletteIcon,
    title: "Your theme",
  },
  {
    description:
      "The CLI installs the build that matches your project's style, so Base UI projects get Base UI code.",
    icon: LayersIcon,
    title: "Radix or Base UI",
  },
  {
    description:
      "Icons come from the iconLibrary in components.json: Lucide, Tabler, Hugeicons, Phosphor or Remix Icon.",
    icon: ShapesIcon,
    title: "Your icons",
  },
  {
    description:
      "Components talk to a source of async functions you write. Nothing runs on Runqora's side.",
    icon: ServerIcon,
    title: "Your backend",
  },
];

const featuredLibraries = libraryGroups.flatMap((group) => group.libraries);

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden border-b">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_top,black,transparent_70%)] bg-size-[3rem_3rem] opacity-60"
        />
        <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 pt-16 pb-14 sm:px-6 md:pt-24 md:pb-20">
          <Badge asChild variant="outline">
            <Link
              href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
            >
              Open source shadcn registry · MIT
            </Link>
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl md:text-6xl">
            The SaaS screens shadcn/ui doesn't ship
          </h1>
          <p className="text-muted-foreground max-w-2xl text-lg text-pretty">
            A file browser for your bucket, an audit log viewer, webhook screens
            and custom domains. Each one is wired to the backend you already
            have. Install with the shadcn CLI and own the code.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/docs/installation">
                Get started
                <ArrowRightIcon />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#components">See the components</Link>
            </Button>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="components-heading"
        className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 md:py-20"
        id="components"
      >
        <SectionHeading
          description="These are the real components, running against sample data in your browser. Click around."
          id="components-heading"
          title="Working screens, not mockups"
        />
        <Showcase />
      </section>

      <section
        aria-labelledby="principles-heading"
        className="bg-muted/30 border-y"
      >
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-20">
          <SectionHeading
            description="Runqora components fit into the app you have instead of bringing their own."
            id="principles-heading"
            title="They look and work like the rest of your app"
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {principles.map((principle) => (
              <li
                className="bg-card flex flex-col gap-3 rounded-xl border p-5"
                key={principle.title}
              >
                <span className="bg-muted flex size-9 items-center justify-center rounded-lg border">
                  <principle.icon aria-hidden="true" className="size-4" />
                </span>
                <h3 className="font-medium">{principle.title}</h3>
                <p className="text-muted-foreground text-sm">
                  {principle.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section
        aria-labelledby="install-heading"
        className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-20"
      >
        <SectionHeading
          description="Any project set up with shadcn/ui and a Radix or Base UI style."
          id="install-heading"
          title="Install in three steps"
        />
        <ol className="flex flex-col gap-4">
          <Step
            description="Once per project. It adds the @runqora namespace."
            number={1}
            title="Add the registry"
          >
            <CopyCommand command="npx shadcn@latest registry add @runqora=https://runqora.dev/r/{style}/{name}.json" />
          </Step>
          <Step
            description="The code is copied into your project for you to change."
            number={2}
            title="Add a component"
          >
            <CopyCommand command="npx shadcn@latest add @runqora/file-browser" />
          </Step>
          <Step
            description={
              <>
                Write the source functions against your own API, database or
                bucket. Server actions refuse every call until you write{" "}
                <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
                  authorize()
                </code>
                .
              </>
            }
            number={3}
            title="Connect your backend"
          >
            <Link
              className="text-foreground inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
              href="/docs/storage/server"
            >
              See an example
              <ArrowRightIcon className="size-4" />
            </Link>
          </Step>
        </ol>
      </section>

      <section aria-labelledby="libraries-heading" className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between md:py-20">
          <div className="flex max-w-xl flex-col gap-3">
            <h2
              className="text-2xl font-semibold tracking-tight sm:text-3xl"
              id="libraries-heading"
            >
              For everything else
            </h2>
            <p className="text-muted-foreground">
              Runqora only builds screens nobody else does. For sign-in,
              billing, uploads and more, these registries install with the same
              CLI.
            </p>
            <div>
              <Button asChild variant="outline">
                <Link href="/libraries">
                  Recommended libraries
                  <ArrowRightIcon />
                </Link>
              </Button>
            </div>
          </div>
          <ul className="flex max-w-md flex-wrap gap-2">
            {featuredLibraries.map((library) => (
              <li key={library.namespace}>
                <Link
                  className="bg-card hover:bg-accent focus-visible:ring-ring/50 inline-flex rounded-lg border px-3 py-1.5 text-sm outline-none focus-visible:ring-3"
                  href={`/libraries#${library.namespace.slice(1)}`}
                >
                  {library.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

function SectionHeading({
  description,
  id,
  title,
}: {
  description: string;
  id: string;
  title: string;
}) {
  return (
    <div className="mb-8 flex max-w-2xl flex-col gap-2">
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl" id={id}>
        {title}
      </h2>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function Step({
  children,
  description,
  number,
  title,
}: {
  children: ReactNode;
  description: ReactNode;
  number: number;
  title: string;
}) {
  return (
    <li className="bg-card text-muted-foreground grid min-w-0 gap-3 rounded-xl border p-5 text-sm md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:items-center md:gap-8">
      <div className="flex flex-col gap-1.5">
        <span className="text-foreground flex items-center gap-3 text-base font-medium">
          <span
            aria-hidden="true"
            className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs"
          >
            {number}
          </span>
          {title}
        </span>
        <p className="md:pl-9">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </li>
  );
}
