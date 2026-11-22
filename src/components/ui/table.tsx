import type {
  ComponentPropsWithoutRef,
  ReactNode,
  TableHTMLAttributes,
} from "react";

import { cn } from "@/lib/utils";

export type TableProps = TableHTMLAttributes<HTMLTableElement> & {
  /** Visible heading is preferred; a screen-reader-only caption is required. */
  caption: string;
  containerLabel: string;
  children: ReactNode;
};

/**
 * Scrollable data table. The wrapper is keyboard-focusable so a horizontal
 * overflow can be scrolled without a pointer, and the caption names the data.
 */
export function Table({
  caption,
  containerLabel,
  children,
  className,
  ...props
}: TableProps) {
  return (
    <div
      role="region"
      aria-label={containerLabel}
      tabIndex={0}
      className="w-full overflow-x-auto rounded-xl border border-green-100 bg-surface focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-green-800 focus-visible:ring-offset-2"
    >
      <table
        className={cn("w-full border-collapse text-left text-base", className)}
        {...props}
      >
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="bg-green-50">{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-green-100">{children}</tbody>;
}

export function TableRow({
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<"tr">) {
  return (
    <tr className={className} {...props}>
      {children}
    </tr>
  );
}

export function TableHeaderCell({
  children,
  className,
  scope = "col",
}: {
  children: ReactNode;
  className?: string;
  scope?: "col" | "row";
}) {
  return (
    <th
      scope={scope}
      className={cn(
        "px-4 py-3 text-sm font-bold uppercase tracking-wide text-green-800",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function TableCell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("px-4 py-3 align-middle text-ink", className)}>
      {children}
    </td>
  );
}

export function TableEmpty({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-8 text-center text-ink-secondary">
        {children}
      </td>
    </tr>
  );
}
