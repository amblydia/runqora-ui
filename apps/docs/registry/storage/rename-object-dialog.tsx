"use client";

import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { StorageResult } from "@/lib/storage/types";

export interface RenameObjectDialogProps {
  /** Key of the object to rename or move. */
  objectKey: string;
  onOpenChange: (open: boolean) => void;
  /** Moves the object. The dialog closes when this succeeds and shows the error when not. */
  onRename: (toKey: string) => Promise<StorageResult<null>>;
  open: boolean;
}

function RenameForm({
  objectKey,
  onDone,
  onRename,
}: {
  objectKey: string;
  onDone: () => void;
  onRename: RenameObjectDialogProps["onRename"];
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const toKey = String(
      new FormData(event.currentTarget).get("key") ?? ""
    ).trim();
    if (!toKey || toKey.endsWith("/")) {
      setError("Enter a path that ends with a file name.");
      return;
    }
    setPending(true);
    const result = await onRename(toKey);
    setPending(false);
    if (result.ok) {
      onDone();
    } else {
      setError(result.error);
    }
  }

  return (
    <form className="flex flex-col gap-6" onSubmit={submit}>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={id}>Path</FieldLabel>
        <Input
          aria-invalid={error ? true : undefined}
          autoCapitalize="none"
          autoComplete="off"
          className="font-mono"
          defaultValue={objectKey}
          id={id}
          name="key"
          required
          spellCheck={false}
        />
        <FieldDescription>
          Change the name, or the folders before it to move the file.
        </FieldDescription>
        <FieldError>{error}</FieldError>
      </Field>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button disabled={pending} type="submit">
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** A dialog that renames an object or moves it to another folder. */
export function RenameObjectDialog({
  objectKey,
  onOpenChange,
  onRename,
  open,
}: RenameObjectDialogProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename or move</DialogTitle>
          <DialogDescription>
            The file is copied to the new path in the bucket, then the original
            is deleted.
          </DialogDescription>
        </DialogHeader>
        {/* Keyed so the form starts fresh for each object. */}
        <RenameForm
          key={objectKey}
          objectKey={objectKey}
          onDone={() => onOpenChange(false)}
          onRename={onRename}
        />
      </DialogContent>
    </Dialog>
  );
}
