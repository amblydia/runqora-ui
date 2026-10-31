import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { Logo } from "@/components/logo";
import { appName, gitConfig } from "./shared";

export function baseOptions(): BaseLayoutProps {
  return {
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
    links: [
      { active: "nested-url", text: "Docs", url: "/docs" },
      { text: "Libraries", url: "/libraries" },
    ],
    nav: {
      title: (
        <>
          <Logo className="size-5" />
          {appName}
        </>
      ),
    },
  };
}
