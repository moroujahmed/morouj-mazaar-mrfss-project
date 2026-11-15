import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed border-green-100 bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="inline-flex size-14 items-center justify-center rounded-2xl bg-green-50 text-green-800"
        >
          {icon}
        </span>
      ) : null}
      <h2 className="text-lg font-extrabold text-green-800">{title}</h2>
      {description ? (
        <p className="max-w-md text-sm text-ink-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
