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
import type { CustomDomain, DomainResult } from "@/lib/domains/types";

export interface RemoveDomainDialogProps {
  domain: CustomDomain;
  onOpenChange: (open: boolean) => void;
  /** Removes the domain. The dialog closes when this succeeds and shows the error when not. */
  onRemove: () => Promise<DomainResult<null>>;
  open: boolean;
}

/** Asks before disconnecting a custom domain. */
export function RemoveDomainDialog({
  domain,
  onOpenChange,
  onRemove,
  open,
}: RemoveDomainDialogProps) {
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
    const result = await onRemove();
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
          <AlertDialogTitle className="break-all">
            Remove {domain.hostname}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            The domain stops showing your account right away. Its DNS records
            stay where you added them: remove them at your DNS provider too.
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
            {pending ? "Removing…" : "Remove"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
