import type { ReactNode } from "react";

/**
 * The frame around a live example on a component page. It sits outside the
 * docs typography so the example renders as it would in an app.
 */
export function ComponentPreview({ children }: { children: ReactNode }) {
  return (
    <div className="not-prose bg-background my-6 flex min-h-48 items-center justify-center rounded-xl border p-6">
      {children}
    </div>
  );
}
