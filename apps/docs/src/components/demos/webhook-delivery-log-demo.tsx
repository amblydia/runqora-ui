"use client";

import { useState } from "react";
import {
  createDemoWebhooks,
  DEMO_EVENT_TYPES,
} from "@/components/demos/demo-webhooks";
import { WebhookDeliveryLog } from "@/components/webhooks/webhook-delivery-log";

export function WebhookDeliveryLogDemo() {
  const [source] = useState(createDemoWebhooks);
  return <WebhookDeliveryLog eventTypes={DEMO_EVENT_TYPES} source={source} />;
}
