import {
  createFileSystemGeneratorCache,
  createGenerator,
} from "fumadocs-typescript";
import { AutoTypeTable } from "fumadocs-typescript/ui";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { ObjectActionsDemo } from "@/components/demos/object-actions-demo";

const generator = createGenerator({
  cache: createFileSystemGeneratorCache(".next/fumadocs-typescript"),
});

// Builds the props table of a registry item from its TypeScript types.
function TypeTable(
  props: Omit<ComponentProps<typeof AutoTypeTable>, "generator">
) {
  return <AutoTypeTable {...props} generator={generator} />;
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    AutoTypeTable: TypeTable,
    ComponentPreview,
    ObjectActionsDemo,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
