import {
  createFileSystemGeneratorCache,
  createGenerator,
} from "fumadocs-typescript";
import { AutoTypeTable } from "fumadocs-typescript/ui";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";
import { ComponentPreview } from "@/components/component-preview";
import { FileBrowserDemo } from "@/components/demos/file-browser-demo";
import { ObjectActionsDemo } from "@/components/demos/object-actions-demo";
import { ObjectDetailsDemo } from "@/components/demos/object-details-demo";
import { UploadButtonDemo } from "@/components/demos/upload-button-demo";

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
    FileBrowserDemo,
    ObjectActionsDemo,
    ObjectDetailsDemo,
    UploadButtonDemo,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
