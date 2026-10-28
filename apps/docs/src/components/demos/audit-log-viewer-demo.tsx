"use client";

import { useState } from "react";
import { AuditLogViewer } from "@/components/audit/audit-log-viewer";
import {
  createDemoAuditLog,
  DEMO_ACTIONS,
} from "@/components/demos/demo-audit-log";

export function AuditLogViewerDemo() {
  // One log per page view, so the source keeps the same identity.
  const [source] = useState(createDemoAuditLog);
  return <AuditLogViewer actions={DEMO_ACTIONS} source={source} />;
}
