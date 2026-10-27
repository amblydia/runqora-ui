import {
  DownloadIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  InfoIcon,
  LinkIcon,
  type LucideIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import type { ComponentProps } from "react";

// Registry source writes each icon as an IconPlaceholder naming it in every
// icon library shadcn supports. When the shadcn CLI installs a file, it
// replaces the placeholder with the icon from the project's `iconLibrary`.
// An icon left out for one library would break installs in projects using it,
// so every library is required. The docs render the Lucide icon.
const icons = {
  DownloadIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
  InfoIcon,
  LinkIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
  UploadIcon,
} satisfies Record<string, LucideIcon>;

type IconPlaceholderProps = ComponentProps<"svg"> & {
  hugeicons: string;
  lucide: keyof typeof icons;
  phosphor: string;
  remixicon: string;
  tabler: string;
};

export function IconPlaceholder({
  hugeicons: _hugeicons,
  lucide,
  phosphor: _phosphor,
  remixicon: _remixicon,
  tabler: _tabler,
  ...props
}: IconPlaceholderProps) {
  const Icon = icons[lucide];
  return <Icon {...props} />;
}
