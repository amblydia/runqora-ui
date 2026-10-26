import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import "./global.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  description:
    "A shadcn registry of components for the screens most SaaS apps need, starting with a file browser for S3 and R2 buckets.",
  metadataBase: new URL("https://runqora.dev"),
  title: { default: "Runqora UI", template: "%s | Runqora UI" },
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      className={cn("font-sans", geist.variable, geistMono.variable)}
      lang="en"
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
