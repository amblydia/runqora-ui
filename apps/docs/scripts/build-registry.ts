// Builds the registry twice from the same source: once for projects on Radix
// and once for projects on Base UI.
//
// Most files need no Base UI version. The shadcn CLI adapts them when it
// installs them: `asChild` becomes `render` in projects whose style starts with
// `base-`, and each IconPlaceholder becomes an icon from the project's icon
// library. A file that needs different code on Base UI gets a copy at the same
// path under registry/base/, and the Base UI build uses that copy instead.
//
// The output goes to public/r/radix and public/r/base. next.config.mjs serves
// both at /r/{style}/{name}.json and picks the build from the style's prefix.

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import registry from "../registry.json" with { type: "json" };

const root = join(import.meta.dirname, "..");
const workDir = join(root, ".registry");
const outDir = join(root, "public", "r");

const SOURCE_PREFIX = "registry/";
const BASE_PREFIX = "registry/base/";

function baseVersion(path: string) {
  if (!path.startsWith(SOURCE_PREFIX)) {
    throw new Error(`Registry file outside registry/: ${path}`);
  }
  const override = BASE_PREFIX + path.slice(SOURCE_PREFIX.length);
  return existsSync(join(root, override)) ? override : path;
}

const builds = {
  base: {
    ...registry,
    items: registry.items.map((item) => ({
      ...item,
      files: item.files.map((file) => ({
        ...file,
        path: baseVersion(file.path),
      })),
    })),
  },
  radix: registry,
};

rmSync(outDir, { force: true, recursive: true });
mkdirSync(workDir, { recursive: true });

for (const [base, source] of Object.entries(builds)) {
  const sourcePath = join(workDir, `${base}.json`);
  writeFileSync(sourcePath, JSON.stringify(source, null, 2));
  execFileSync(
    process.execPath,
    ["x", "shadcn", "build", sourcePath, "--output", join(outDir, base)],
    { cwd: root, stdio: "inherit" }
  );
}

rmSync(workDir, { force: true, recursive: true });
