"use client";

import { useState } from "react";
import {
  createDemoWebhooks,
  DEMO_EVENT_TYPES,
} from "@/components/demos/demo-webhooks";
import { WebhookEndpoints } from "@/components/webhooks/webhook-endpoints";

export function WebhookEndpointsDemo() {
  // One set of webhooks per page view, so the source keeps the same identity.
  const [source] = useState(createDemoWebhooks);
  return <WebhookEndpoints eventTypes={DEMO_EVENT_TYPES} source={source} />;
}
