"use client";

import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  showHidden,
  type WebhookEndpoint,
  type WebhookEventType,
  type WebhookResult,
} from "@/lib/webhooks/types";

export interface SendTestEventDialogProps {
  endpoint: WebhookEndpoint;
  /** Your app's events. Only those the endpoint receives are offered. */
  eventTypes: WebhookEventType[];
  onOpenChange: (open: boolean) => void;
  /** Sends the test. The dialog closes when this succeeds and shows the error when not. */
  onSend: (eventType: string) => Promise<WebhookResult<null>>;
  open: boolean;
}

function TestForm({
  endpoint,
  eventTypes,
  onCancel,
  onDone,
  onPendingChange,
  onSend,
  pending,
}: {
  endpoint: WebhookEndpoint;
  eventTypes: WebhookEventType[];
  onCancel: () => void;
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
  onSend: SendTestEventDialogProps["onSend"];
  pending: boolean;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const offered =
    endpoint.eventTypes.length === 0
      ? eventTypes
      : eventTypes.filter((eventType) =>
          endpoint.eventTypes.includes(eventType.value)
        );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const eventType = String(
      new FormData(event.currentTarget).get("eventType") ?? ""
    );
    if (!eventType) {
      setError("Choose an event.");
      return;
    }
    onPendingChange(true);
    const result = await onSend(eventType);
    onPendingChange(false);
    if (result.ok) {
      onDone();
    } else {
      setError(result.error);
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={submit}>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={id}>Event</FieldLabel>
        <NativeSelect
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={error ? true : undefined}
          className="w-full"
          defaultValue={offered[0]?.value}
          id={id}
          name="eventType"
        >
          {offered.map((eventType) => (
            <NativeSelectOption key={eventType.value} value={eventType.value}>
              {eventType.label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <FieldError id={`${id}-error`}>{error}</FieldError>
      </Field>
      <DialogFooter>
        <Button
          disabled={pending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        <Button disabled={pending || offered.length === 0} type="submit">
          {pending ? "Sending…" : "Send test event"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** A dialog that sends a sample event to one endpoint. */
export function SendTestEventDialog({
  endpoint,
  eventTypes,
  onOpenChange,
  onSend,
  open,
}: SendTestEventDialogProps) {
  const [pending, setPending] = useState(false);

  return (
    <Dialog
      // It can't be dismissed while sending, so the result isn't lost.
      onOpenChange={(next) => {
        if (!pending) {
          onOpenChange(next);
        }
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send a test event</DialogTitle>
          <DialogDescription className="break-all">
            A sample event is sent to{" "}
            <span className="font-mono">{showHidden(endpoint.url)}</span>,
            signed like any other.
          </DialogDescription>
        </DialogHeader>
        <TestForm
          endpoint={endpoint}
          eventTypes={eventTypes}
          key={endpoint.id}
          onCancel={() => onOpenChange(false)}
          onDone={() => onOpenChange(false)}
          onPendingChange={setPending}
          onSend={onSend}
          pending={pending}
        />
      </DialogContent>
    </Dialog>
  );
}
