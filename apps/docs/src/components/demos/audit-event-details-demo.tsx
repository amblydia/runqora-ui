"use client";

import { useState } from "react";
import { AuditEventDetails } from "@/components/audit/audit-event-details";
import {
  createDemoAuditLog,
  DEMO_ACTIONS,
} from "@/components/demos/demo-audit-log";
import { Button } from "@/components/ui/button";

const labels = new Map(
  DEMO_ACTIONS.map((action) => [action.value, action.label])
);

export function AuditEventDetailsDemo() {
  const [source] = useState(createDemoAuditLog);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        Show a plan change
      </Button>
      <AuditEventDetails
        eventId="evt_0056"
        getActionLabel={(action) => labels.get(action) ?? action}
        onOpenChange={setOpen}
        open={open}
        source={source}
      />
    </>
  );
}
