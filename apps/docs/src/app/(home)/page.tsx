import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">
        Components for the screens most SaaS apps need
      </h1>
      <p className="text-muted-foreground text-lg">
        Runqora UI is a shadcn registry: a file browser for the S3 or R2 bucket
        you already have, an audit log viewer for your own database, and webhook
        screens for whatever sends your webhooks. Install with the shadcn CLI
        and own the code.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/docs">Read the docs</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="https://github.com/amblydia/runqora-ui">GitHub</Link>
        </Button>
      </div>
    </main>
  );
}
