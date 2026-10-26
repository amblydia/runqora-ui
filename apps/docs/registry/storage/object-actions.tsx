"use client";

import { IconPlaceholder } from "@/components/icon-placeholder";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ObjectActionsProps {
  /** The object the actions apply to. `name` labels the menu button. */
  object: { key: string; name: string };
  /** Copies a link to the object. Hidden when not given. */
  onCopyLink?: () => void;
  /** Deletes the object, usually after a confirmation. Hidden when not given. */
  onDelete?: () => void;
  /** Shows the object's details. Hidden when not given. */
  onDetails?: () => void;
  /** Downloads the object. Hidden when not given. */
  onDownload?: () => void;
  /** Renames or moves the object. Hidden when not given. */
  onRename?: () => void;
}

/**
 * The actions menu of one object in a bucket. Each action shows only when its
 * handler is given, so a read-only view leaves out `onRename` and `onDelete`.
 */
export function ObjectActions({
  object,
  onCopyLink,
  onDelete,
  onDetails,
  onDownload,
  onRename,
}: ObjectActionsProps) {
  const canView = Boolean(onDetails || onDownload || onCopyLink);
  const canChange = Boolean(onRename || onDelete);

  if (!(canView || canChange)) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          aria-label={`Actions for ${object.name}`}
          size="icon-sm"
          variant="ghost"
        >
          <IconPlaceholder
            hugeicons="MoreHorizontalIcon"
            lucide="MoreHorizontalIcon"
            phosphor="DotsThreeIcon"
            remixicon="RiMoreLine"
            tabler="IconDots"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {canView ? (
          <DropdownMenuGroup>
            {onDetails ? (
              <DropdownMenuItem onClick={onDetails}>
                <IconPlaceholder
                  hugeicons="InformationCircleIcon"
                  lucide="InfoIcon"
                  phosphor="InfoIcon"
                  remixicon="RiInformationLine"
                  tabler="IconInfoCircle"
                />
                Details
              </DropdownMenuItem>
            ) : null}
            {onDownload ? (
              <DropdownMenuItem onClick={onDownload}>
                <IconPlaceholder
                  hugeicons="Download04Icon"
                  lucide="DownloadIcon"
                  phosphor="DownloadSimpleIcon"
                  remixicon="RiDownloadLine"
                  tabler="IconDownload"
                />
                Download
              </DropdownMenuItem>
            ) : null}
            {onCopyLink ? (
              <DropdownMenuItem onClick={onCopyLink}>
                <IconPlaceholder
                  hugeicons="Link01Icon"
                  lucide="LinkIcon"
                  phosphor="LinkIcon"
                  remixicon="RiLinkM"
                  tabler="IconLink"
                />
                Copy link
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        ) : null}
        {canView && canChange ? <DropdownMenuSeparator /> : null}
        {canChange ? (
          <DropdownMenuGroup>
            {onRename ? (
              <DropdownMenuItem onClick={onRename}>
                <IconPlaceholder
                  hugeicons="Edit02Icon"
                  lucide="PencilIcon"
                  phosphor="PencilSimpleIcon"
                  remixicon="RiPencilLine"
                  tabler="IconPencil"
                />
                Rename or move
              </DropdownMenuItem>
            ) : null}
            {onDelete ? (
              <DropdownMenuItem onClick={onDelete} variant="destructive">
                <IconPlaceholder
                  hugeicons="Delete02Icon"
                  lucide="Trash2Icon"
                  phosphor="TrashIcon"
                  remixicon="RiDeleteBinLine"
                  tabler="IconTrash"
                />
                Delete
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuGroup>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
