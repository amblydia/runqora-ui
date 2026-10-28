"use client";

import { type RefObject, useEffect, useId, useRef, useState } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  showHidden,
  type WebhookEndpoint,
  type WebhookSource,
} from "@/lib/webhooks/types";

export interface WebhookSecretDialogProps {
  endpoint: WebhookEndpoint;
  /**
   * A secret to show straight away, such as the one a new endpoint was
   * created with. It's described as shown once unless `revealSecret` is given.
   */
  initialSecret?: string | null;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  /** Reads the secret. Leave it out to show secrets only once. */
  revealSecret?: WebhookSource["revealSecret"];
  /** Replaces the secret. Leave it out to hide the Rotate button. */
  rotateSecret?: WebhookSource["rotateSecret"];
}

const MASK = "•".repeat(32);
const NO_MESSAGE = { error: false, text: "" };

/** Where focus goes after a change removes the focused button. */
type FocusTarget = "confirm" | "rotate" | "secret" | null;

/** The secret, masked until revealed, with Reveal or Copy beside it. */
function SecretField({
  copied,
  help,
  inputRef,
  onCopy,
  onReveal,
  revealing,
  secret,
}: {
  copied: boolean;
  help: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onCopy: () => void;
  /** Left out when the secret can't be revealed. */
  onReveal?: () => void;
  revealing: boolean;
  secret: string | null;
}) {
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>Signing secret</FieldLabel>
      <div className="flex gap-2">
        <Input
          aria-describedby={`${id}-help`}
          className="font-mono"
          id={id}
          onFocus={(event) => event.currentTarget.select()}
          readOnly
          ref={inputRef}
          spellCheck={false}
          value={secret ?? MASK}
        />
        {secret === null && onReveal ? (
          <Button
            disabled={revealing}
            onClick={onReveal}
            type="button"
            variant="outline"
          >
            {revealing ? "Revealing…" : "Reveal"}
          </Button>
        ) : null}
        {secret === null ? null : (
          <Button onClick={onCopy} type="button" variant="outline">
            <IconPlaceholder
              aria-hidden="true"
              hugeicons="Copy01Icon"
              lucide="CopyIcon"
              phosphor="CopyIcon"
              remixicon="RiFileCopyLine"
              tabler="IconCopy"
            />
            {copied ? "Copied" : "Copy"}
          </Button>
        )}
      </div>
      <FieldDescription id={`${id}-help`}>{help}</FieldDescription>
    </Field>
  );
}

/** Asks before the secret is replaced. */
function RotateConfirm({
  confirmRef,
  disabled,
  onCancel,
  onConfirm,
  rotating,
}: {
  confirmRef: RefObject<HTMLButtonElement | null>;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  rotating: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <p className="text-sm">
        Webhooks will be signed with a new secret. Update it wherever this
        endpoint checks signatures.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={disabled}
          onClick={onConfirm}
          ref={confirmRef}
          size="sm"
          type="button"
          variant="destructive"
        >
          {rotating ? "Rotating…" : "Rotate secret"}
        </Button>
        <Button
          disabled={disabled}
          onClick={onCancel}
          size="sm"
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function SecretPanel({
  blocked,
  endpoint,
  initialSecret,
  onClose,
  onLockedChange,
  revealSecret,
  rotateSecret,
}: Omit<WebhookSecretDialogProps, "onOpenChange" | "open"> & {
  /** Set when someone tried to close while the secret can't be seen again. */
  blocked: boolean;
  onClose: () => void;
  onLockedChange: (locked: boolean) => void;
}) {
  const [secret, setSecret] = useState(initialSecret ?? null);
  // A secret the person was just given, rather than one they asked to see.
  const [fresh, setFresh] = useState(Boolean(initialSecret));
  const [pending, setPending] = useState<"reveal" | "rotate" | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState(NO_MESSAGE);
  const [focus, setFocus] = useState<FocusTarget>(null);
  const secretInput = useRef<HTMLInputElement>(null);
  const rotateButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  // A secret that can't be seen again, until it's copied.
  const locked = fresh && secret !== null && !revealSecret && !copied;

  useEffect(() => {
    onLockedChange(locked);
  }, [locked, onLockedChange]);

  useEffect(() => {
    const targets = {
      confirm: confirmButton,
      rotate: rotateButton,
      secret: secretInput,
    };
    if (focus) {
      targets[focus].current?.focus();
      setFocus(null);
    }
  }, [focus]);

  async function reveal() {
    if (!revealSecret) {
      return;
    }
    setPending("reveal");
    setMessage(NO_MESSAGE);
    const result = await revealSecret(endpoint.id);
    setPending(null);
    if (result.ok) {
      setSecret(result.data);
      setFocus("secret");
    } else {
      setMessage({ error: true, text: result.error });
    }
  }

  async function rotate() {
    if (!rotateSecret) {
      return;
    }
    setPending("rotate");
    setMessage(NO_MESSAGE);
    const result = await rotateSecret(endpoint.id);
    setPending(null);
    setConfirming(false);
    if (!result.ok) {
      setMessage({ error: true, text: result.error });
      setFocus("rotate");
      return;
    }
    setCopied(false);
    setSecret(result.data);
    setFresh(result.data !== null);
    setMessage({
      error: false,
      text:
        result.data === null && revealSecret
          ? "The secret was replaced. Reveal it to see the new one."
          : "The secret was replaced.",
    });
    setFocus(result.data === null ? "rotate" : "secret");
  }

  async function copy() {
    if (secret === null) {
      return;
    }
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const help =
    fresh && !revealSecret
      ? "Copy it now: it won't be shown again."
      : "The endpoint uses it to check that webhooks come from you. Keep it secret.";

  return (
    <div className="flex flex-col gap-4">
      <SecretField
        copied={copied}
        help={help}
        inputRef={secretInput}
        onCopy={copy}
        onReveal={revealSecret ? reveal : undefined}
        revealing={pending === "reveal"}
        secret={secret}
      />

      {blocked && locked ? (
        <p className="text-destructive text-sm" role="alert">
          Copy the secret before you close this, or choose Done to close it
          anyway.
        </p>
      ) : null}

      <p
        aria-live="polite"
        className={cn(
          "text-sm",
          message.error ? "text-destructive" : "text-muted-foreground",
          // Hidden rather than removed while empty, so it's announced when it fills.
          message.text ? null : "sr-only"
        )}
      >
        {message.text}
      </p>

      {rotateSecret && confirming ? (
        <RotateConfirm
          confirmRef={confirmButton}
          disabled={pending !== null}
          onCancel={() => {
            setConfirming(false);
            setFocus("rotate");
          }}
          onConfirm={rotate}
          rotating={pending === "rotate"}
        />
      ) : null}

      <DialogFooter>
        {rotateSecret && !confirming ? (
          <Button
            className="sm:mr-auto"
            onClick={() => {
              setConfirming(true);
              setFocus("confirm");
            }}
            ref={rotateButton}
            type="button"
            variant="outline"
          >
            Rotate…
          </Button>
        ) : null}
        <Button onClick={onClose} type="button">
          Done
        </Button>
      </DialogFooter>
    </div>
  );
}

/**
 * Shows an endpoint's signing secret, and replaces it on request. A secret
 * that can't be seen again stays open until it's copied or Done is chosen.
 */
export function WebhookSecretDialog({
  endpoint,
  initialSecret,
  onOpenChange,
  open,
  revealSecret,
  rotateSecret,
}: WebhookSecretDialogProps) {
  const [locked, setLocked] = useState(false);
  const [blocked, setBlocked] = useState(false);

  return (
    <Dialog
      onOpenChange={(next) => {
        // A click outside or Escape would lose a secret shown only once.
        if (!next && locked) {
          setBlocked(true);
          return;
        }
        onOpenChange(next);
      }}
      open={open}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Signing secret</DialogTitle>
          <DialogDescription className="font-mono break-all">
            {showHidden(endpoint.url)}
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so a secret never carries over to another endpoint. */}
        <SecretPanel
          blocked={blocked}
          endpoint={endpoint}
          initialSecret={initialSecret}
          key={endpoint.id}
          onClose={() => onOpenChange(false)}
          onLockedChange={setLocked}
          revealSecret={revealSecret}
          rotateSecret={rotateSecret}
        />
      </DialogContent>
    </Dialog>
  );
}
