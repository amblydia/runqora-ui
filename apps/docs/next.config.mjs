import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  output: "standalone",
  reactStrictMode: true,
  // scripts/build-registry.ts writes one build for Radix projects and one for
  // Base UI projects. The shadcn CLI asks for /r/{style}/{name}.json, so each
  // style is served the build matching its prefix. Styles from before shadcn
  // supported Base UI are all Radix.
  rewrites() {
    return {
      beforeFiles: [
        {
          destination: "/r/base/:name",
          source: "/r/:style(base-[^/]+)/:name",
        },
        {
          destination: "/r/radix/:name",
          source: "/r/:style(radix-[^/]+|new-york|new-york-v4|default)/:name",
        },
        {
          destination: "/r/radix/:name",
          source: "/r/:name([^/]+\\.json)",
        },
      ],
    };
  },
};

export default withMDX(config);
