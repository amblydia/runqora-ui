"use client";

import { useState } from "react";
import { createDemoStorage } from "@/components/demos/demo-storage";
import { ObjectDetails } from "@/components/storage/object-details";
import { Button } from "@/components/ui/button";

export function ObjectDetailsDemo() {
  const [source] = useState(createDemoStorage);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        Show details of office.svg
      </Button>
      <ObjectDetails
        objectKey="images/office.svg"
        onOpenChange={setOpen}
        open={open}
        source={source}
      />
    </>
  );
}
