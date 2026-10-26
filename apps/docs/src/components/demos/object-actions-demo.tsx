"use client";

import { useState } from "react";
import { ObjectActions } from "@/registry/storage/object-actions";

const object = { key: "invoices/2026/october.pdf", name: "october.pdf" };

export function ObjectActionsDemo() {
  const [lastAction, setLastAction] = useState<string | null>(null);

  return (
    <div className="flex w-full max-w-sm items-center justify-between gap-4 rounded-lg border px-4 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{object.name}</p>
        <p aria-live="polite" className="text-muted-foreground text-xs">
          {lastAction ?? "Open the menu to try an action."}
        </p>
      </div>
      <ObjectActions
        object={object}
        onCopyLink={() => setLastAction("Copy link chosen")}
        onDelete={() => setLastAction("Delete chosen")}
        onDetails={() => setLastAction("Details chosen")}
        onDownload={() => setLastAction("Download chosen")}
        onRename={() => setLastAction("Rename or move chosen")}
      />
    </div>
  );
}
