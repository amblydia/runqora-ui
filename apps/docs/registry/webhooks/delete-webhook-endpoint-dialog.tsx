"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  showHidden,
  type WebhookEndpoint,
  type WebhookResult,
} from "@/lib/webhooks/types";

export interface DeleteWebhookEndpointDialogProps {
  endpoint: WebhookEndpoint;
  /** Deletes the endpoint. The dialog closes when this succeeds and shows the error when not. */
  onDelete: () => Promise<WebhookResult<null>>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

/** Asks before deleting a webhook endpoint. */
export function DeleteWebhookEndpointDialog({
  endpoint,
  onDelete,
  onOpenChange,
  open,
}: DeleteWebhookEndpointDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function changeOpen(next: boolean) {
    if (!pending) {
      setError(null);
      onOpenChange(next);
    }
  }

  async function confirm() {
    setPending(true);
    const result = await onDelete();
    setPending(false);
    if (result.ok) {
      setError(null);
      onOpenChange(false);
    } else {
      setError(result.error);
    }
  }

  return (
    <AlertDialog onOpenChange={changeOpen} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this endpoint?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-mono break-all">
              {showHidden(endpoint.url)}
            </span>{" "}
            stops receiving webhooks. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button disabled={pending} onClick={confirm} variant="destructive">
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
