// Installs every registry item into a fresh shadcn project, the way a developer
// would, then checks the result.
//
//   bun scripts/test-install.ts --style base-nova --icons hugeicons \
//     --registry http://localhost:3000 [--build]
//
// The registry must be running at --registry (`bun run --filter docs start`).
// The project is created with `shadcn@latest`, so a change in the CLI that
// breaks installs shows up here first.

import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import registry from "../apps/docs/registry.json" with { type: "json" };

const ICON_PACKAGES = {
  hugeicons: ["@hugeicons/react", "@hugeicons/core-free-icons"],
  lucide: ["lucide-react"],
  phosphor: ["@phosphor-icons/react"],
  remixicon: ["@remixicon/react"],
  tabler: ["@tabler/icons-react"],
} as const;

type IconLibrary = keyof typeof ICON_PACKAGES;

const STYLE_PATTERN = /^(?<base>radix|base)-(?<preset>[a-z]+)$/u;

const { values } = parseArgs({
  options: {
    build: { default: false, type: "boolean" },
    icons: { type: "string" },
    registry: { type: "string" },
    style: { type: "string" },
  },
});

const style = values.style ?? "";
const icons = values.icons ?? "";
const registryUrl = values.registry?.replace(/\/$/u, "");
const styleMatch = STYLE_PATTERN.exec(style);

if (!(styleMatch && registryUrl && icons in ICON_PACKAGES)) {
  console.error(
    "Usage: bun scripts/test-install.ts --style <radix|base>-<preset> " +
      `--icons <${Object.keys(ICON_PACKAGES).join("|")}> --registry <url> [--build]`
  );
  process.exit(1);
}

const { base, preset } = styleMatch.groups as { base: string; preset: string };
const iconLibrary = icons as IconLibrary;
const workDir = mkdtempSync(join(tmpdir(), "runqora-install-"));
const projectDir = join(workDir, "app");

function run(args: string[], cwd: string) {
  console.log(`\n$ bun ${args.join(" ")}`);
  execFileSync(process.execPath, args, { cwd, stdio: "inherit" });
}

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

run(
  [
    "x",
    "shadcn@latest",
    "init",
    "--template",
    "next",
    "--base",
    base,
    "--preset",
    preset,
    "--name",
    "app",
    "--no-monorepo",
    "--yes",
  ],
  workDir
);

// Projects choose an icon library when they are created. The test sets it
// afterwards, as `shadcn init` has no option for it.
const configPath = join(projectDir, "components.json");
const config = JSON.parse(readFileSync(configPath, "utf8"));
config.iconLibrary = iconLibrary;
config.registries = {
  ...config.registries,
  "@runqora": `${registryUrl}/r/{style}/{name}.json`,
};
writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
run(["add", ...ICON_PACKAGES[iconLibrary]], projectDir);

run(
  [
    "x",
    "shadcn@latest",
    "add",
    ...registry.items.map((item) => `@runqora/${item.name}`),
    "--yes",
  ],
  projectDir
);

const problems: string[] = [];
for (const file of listFiles(join(projectDir, "components"))) {
  const content = readFileSync(file, "utf8");
  if (content.includes("IconPlaceholder")) {
    problems.push(`${file}: IconPlaceholder was not replaced`);
  }
  if (base === "base" && content.includes("asChild")) {
    problems.push(`${file}: asChild was not turned into render`);
  }
}
if (problems.length > 0) {
  console.error(`\n${problems.join("\n")}`);
  process.exit(1);
}

run(["x", "tsc", "--noEmit"], projectDir);
if (values.build) {
  run(["run", "build"], projectDir);
}

console.log(
  `\nAll ${registry.items.length} items installed in ${style} with ${iconLibrary}.`
);
