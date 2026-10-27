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
import { getObjectName, type StorageResult } from "@/lib/storage/types";

export interface DeleteObjectDialogProps {
  /** Key of the object to delete. */
  objectKey: string;
  /** Deletes the object. The dialog closes when this succeeds and shows the error when not. */
  onDelete: () => Promise<StorageResult<null>>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

/** Asks before deleting an object, as a bucket without versioning can't undo it. */
export function DeleteObjectDialog({
  objectKey,
  onDelete,
  onOpenChange,
  open,
}: DeleteObjectDialogProps) {
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
          <AlertDialogTitle className="break-all">
            Delete {getObjectName(objectKey)}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-mono break-all">{objectKey}</span> is deleted
            from the bucket. This can't be undone unless the bucket keeps
            versions.
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
