import { HomeLayout } from "fumadocs-ui/layouts/home";
import Link from "next/link";
import { baseOptions } from "@/lib/layout.shared";
import { gitConfig } from "@/lib/shared";

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <HomeLayout {...baseOptions()}>
      {children}
      <footer className="border-t">
        <div className="text-muted-foreground mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>
            Built by{" "}
            <Link
              className="text-foreground font-medium underline-offset-4 hover:underline"
              href="https://amblydia.com"
            >
              Amblydia
            </Link>
            . MIT licensed.
          </p>
          <nav aria-label="Footer" className="flex gap-4">
            <Link className="hover:text-foreground" href="/docs">
              Docs
            </Link>
            <Link className="hover:text-foreground" href="/libraries">
              Libraries
            </Link>
            <Link
              className="hover:text-foreground"
              href={`https://github.com/${gitConfig.user}/${gitConfig.repo}`}
            >
              GitHub
            </Link>
          </nav>
        </div>
      </footer>
    </HomeLayout>
  );
}
