"use client";

import { useState } from "react";
import { createDemoStorage } from "@/components/demos/demo-storage";
import { FileBrowser } from "@/components/storage/file-browser";

export function FileBrowserDemo() {
  // One bucket per page view, so the source keeps the same identity.
  const [source] = useState(createDemoStorage);
  return <FileBrowser rootLabel="acme-assets" source={source} />;
}
