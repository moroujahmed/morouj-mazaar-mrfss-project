import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type BadgeTone =
  | "success"
  | "danger"
  | "warning"
  | "neutral"
  | "brand"
  | "orange";

const toneClasses: Record<BadgeTone, string> = {
  success: "bg-status-successSurface text-status-success",
  danger: "bg-status-dangerSurface text-status-danger",
  warning: "bg-status-warningSurface text-status-warning",
  neutral: "bg-surface-inset text-green-800",
  brand: "bg-green-800 text-white",
  // Green-900 on orange-500; never white on orange.
  orange: "bg-orange-500 text-green-900",
};

export type BadgeProps = {
  tone?: BadgeTone;
  /** Status is never colour-only: pair every status badge with an icon. */
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function Badge({
  tone = "neutral",
  icon,
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold leading-5",
        toneClasses[tone],
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </span>
  );
}
