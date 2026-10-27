"use client";

import { useState } from "react";
import { createDemoStorage } from "@/components/demos/demo-storage";
import { UploadButton } from "@/components/storage/upload-button";

export function UploadButtonDemo() {
  const [source] = useState(createDemoStorage);
  const [result, setResult] = useState("Files stay in your browser.");

  return (
    <div className="flex flex-col items-center gap-3">
      <UploadButton
        onComplete={({ failed, uploaded }) =>
          setResult(
            [
              ...uploaded.map((key) => `Uploaded ${key}.`),
              ...failed.map(({ error, name }) => `${name}: ${error}`),
            ].join(" ")
          )
        }
        prefix="uploads/"
        source={source}
      />
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {result}
      </p>
    </div>
  );
}
