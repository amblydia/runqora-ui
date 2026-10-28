"use client";

import { type FormEvent, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type {
  WebhookEndpoint,
  WebhookEndpointInput,
  WebhookEventType,
  WebhookResult,
} from "@/lib/webhooks/types";

export interface WebhookEndpointDialogProps {
  /** The endpoint to edit. Leave it out to add one. */
  endpoint?: WebhookEndpoint;
  /** The events the endpoint can receive. Empty hides the choice, so every event is sent. */
  eventTypes: WebhookEventType[];
  onOpenChange: (open: boolean) => void;
  /** Saves the endpoint. The dialog closes when this succeeds and shows the error when not. */
  onSave: (input: WebhookEndpointInput) => Promise<WebhookResult<unknown>>;
  open: boolean;
}

const MAX_URL_LENGTH = 2048;

/**
 * Checks the URL for a quick message, and returns it as the browser reads
 * it, with tabs and line breaks dropped and the host name encoded. Your
 * backend must check it again, and refuse addresses inside your network.
 */
function readUrl(value: string): { error: string } | { url: string } {
  if (value.length > MAX_URL_LENGTH) {
    return { error: "That URL is too long." };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { error: "Enter a full URL, such as https://example.com/webhooks." };
  }
  if (url.protocol !== "https:") {
    return { error: "Enter a URL that starts with https://." };
  }
  if (url.username || url.password) {
    return { error: "Leave the user name and password out of the URL." };
  }
  return { url: url.href };
}

interface Errors {
  events?: string;
  form?: string;
  url?: string;
}

/**
 * The events to offer: yours, then any the endpoint already has that you no
 * longer list, so they can be seen and removed.
 */
function eventOptions(
  eventTypes: WebhookEventType[],
  endpoint?: WebhookEndpoint
): WebhookEventType[] {
  const known = new Set(eventTypes.map((eventType) => eventType.value));
  const unknown = (endpoint?.eventTypes ?? [])
    .filter((value) => !known.has(value))
    .map((value) => ({ label: value, value }));
  return [...eventTypes, ...unknown];
}

function EndpointForm({
  endpoint,
  eventTypes,
  onCancel,
  onDone,
  onPendingChange,
  onSave,
  pending,
}: {
  endpoint?: WebhookEndpoint;
  eventTypes: WebhookEventType[];
  onCancel: () => void;
  onDone: () => void;
  onPendingChange: (pending: boolean) => void;
  onSave: WebhookEndpointDialogProps["onSave"];
  pending: boolean;
}) {
  const id = useId();
  const urlInput = useRef<HTMLInputElement>(null);
  const eventsGroup = useRef<HTMLFieldSetElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [allEvents, setAllEvents] = useState(
    !endpoint || endpoint.eventTypes.length === 0
  );
  const [selected, setSelected] = useState<string[]>(
    endpoint?.eventTypes ?? []
  );
  const options = eventOptions(eventTypes, endpoint);

  function toggle(value: string, checked: boolean) {
    setSelected((current) =>
      checked
        ? [...current, value]
        : current.filter((eventType) => eventType !== value)
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const read = readUrl(String(form.get("url") ?? "").trim());
    const description = String(form.get("description") ?? "").trim();
    const pickEvents = eventTypes.length > 0 && !allEvents;
    const next: Errors = {
      events:
        pickEvents && selected.length === 0
          ? "Choose at least one event, or send every event."
          : undefined,
      url: "error" in read ? read.error : undefined,
    };
    if ("error" in read || next.events) {
      setErrors(next);
      // Focus goes to the first field to fix.
      if (next.url) {
        urlInput.current?.focus();
      } else {
        eventsGroup.current
          ?.querySelector<HTMLElement>('[role="checkbox"]')
          ?.focus();
      }
      return;
    }
    setErrors({});
    onPendingChange(true);
    const result = await onSave({
      description: description || null,
      eventTypes: pickEvents ? selected : [],
      url: read.url,
    });
    onPendingChange(false);
    if (result.ok) {
      onDone();
    } else {
      setErrors({ form: result.error });
    }
  }

  return (
    <form className="flex flex-col gap-6" noValidate onSubmit={submit}>
      <Field data-invalid={errors.url ? true : undefined}>
        <FieldLabel htmlFor={`${id}-url`}>URL</FieldLabel>
        <Input
          aria-describedby={
            errors.url ? `${id}-url-error ${id}-url-help` : `${id}-url-help`
          }
          aria-invalid={errors.url ? true : undefined}
          autoCapitalize="none"
          autoComplete="off"
          className="font-mono"
          defaultValue={endpoint?.url}
          id={`${id}-url`}
          inputMode="url"
          maxLength={MAX_URL_LENGTH}
          name="url"
          placeholder="https://example.com/webhooks"
          ref={urlInput}
          required
          spellCheck={false}
          type="url"
        />
        <FieldDescription id={`${id}-url-help`}>
          Webhooks are sent here as POST requests.
        </FieldDescription>
        <FieldError id={`${id}-url-error`}>{errors.url}</FieldError>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
        <Input
          defaultValue={endpoint?.description ?? ""}
          id={`${id}-description`}
          maxLength={200}
          name="description"
          placeholder="Optional, such as Production"
        />
      </Field>
      {eventTypes.length > 0 ? (
        <FieldSet
          aria-describedby={errors.events ? `${id}-events-error` : undefined}
          data-invalid={errors.events ? true : undefined}
          ref={eventsGroup}
        >
          <FieldLegend variant="label">Events</FieldLegend>
          <Field orientation="horizontal">
            <Checkbox
              checked={allEvents}
              id={`${id}-all`}
              onCheckedChange={(checked) => setAllEvents(checked === true)}
            />
            <FieldLabel className="font-normal" htmlFor={`${id}-all`}>
              Send every event, including ones added later
            </FieldLabel>
          </Field>
          {allEvents ? null : (
            <div className="flex max-h-56 flex-col gap-3 overflow-y-auto rounded-lg border p-3">
              {options.map((eventType) => {
                const checkboxId = `${id}-event-${eventType.value}`;
                return (
                  <Field key={eventType.value} orientation="horizontal">
                    <Checkbox
                      checked={selected.includes(eventType.value)}
                      id={checkboxId}
                      onCheckedChange={(checked) =>
                        toggle(eventType.value, checked === true)
                      }
                    />
                    <FieldContent>
                      <FieldLabel className="font-normal" htmlFor={checkboxId}>
                        {eventType.label}
                      </FieldLabel>
                      <FieldDescription className="font-mono text-xs">
                        {eventType.value}
                        {eventType.description
                          ? ` · ${eventType.description}`
                          : ""}
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                );
              })}
            </div>
          )}
          <FieldError id={`${id}-events-error`}>{errors.events}</FieldError>
        </FieldSet>
      ) : null}
      {errors.form ? (
        <p className="text-destructive text-sm" role="alert">
          {errors.form}
        </p>
      ) : null}
      <DialogFooter>
        <Button
          disabled={pending}
          onClick={onCancel}
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
        <Button disabled={pending} type="submit">
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** A dialog that adds a webhook endpoint or changes one. */
export function WebhookEndpointDialog({
  endpoint,
  eventTypes,
  onOpenChange,
  onSave,
  open,
}: WebhookEndpointDialogProps) {
  const [pending, setPending] = useState(false);

  return (
    <Dialog
      // It can't be dismissed while saving, so the result isn't lost.
      onOpenChange={(next) => {
        if (!pending) {
          onOpenChange(next);
        }
      }}
      open={open}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {endpoint ? "Edit endpoint" : "Add endpoint"}
          </DialogTitle>
          <DialogDescription>
            Choose where webhooks are sent and which events they carry.
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so the form starts fresh for each endpoint. */}
        <EndpointForm
          endpoint={endpoint}
          eventTypes={eventTypes}
          key={endpoint?.id ?? "new"}
          onCancel={() => onOpenChange(false)}
          onDone={() => onOpenChange(false)}
          onPendingChange={setPending}
          onSave={onSave}
          pending={pending}
        />
      </DialogContent>
    </Dialog>
  );
}
