"use client";

import { useState } from "react";
import {
  createDemoWebhooks,
  DEMO_EVENT_TYPES,
  DEMO_FAILED_DELIVERY_ID,
} from "@/components/demos/demo-webhooks";
import { Button } from "@/components/ui/button";
import { WebhookDeliveryDetails } from "@/components/webhooks/webhook-delivery-details";

export function WebhookDeliveryDetailsDemo() {
  const [source] = useState(createDemoWebhooks);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} variant="outline">
        Show a failed delivery
      </Button>
      <WebhookDeliveryDetails
        deliveryId={DEMO_FAILED_DELIVERY_ID}
        eventTypes={DEMO_EVENT_TYPES}
        onOpenChange={setOpen}
        open={open}
        source={source}
      />
    </>
  );
}
