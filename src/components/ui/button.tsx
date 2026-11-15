import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "dark"
  | "secondary"
  | "ghost"
  | "soft"
  | "danger";

/**
 * sm/md are 48 px (customer/admin), lg is 52 px (kitchen), xl is 56 px (rider).
 * The absolute WCAG floor is 44 px, so no size goes below 48 px.
 */
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const variantClasses: Record<ButtonVariant, string> = {
  // Orange actions use green-900 text. White on orange is forbidden.
  primary:
    "bg-orange-500 text-green-900 hover:bg-orange-600 focus-visible:ring-green-900",
  dark: "bg-green-800 text-white hover:bg-green-700 focus-visible:ring-white focus-visible:ring-offset-green-800",
  secondary:
    "border border-green-800 bg-surface text-green-800 hover:bg-green-50 focus-visible:ring-green-800",
  ghost: "bg-transparent text-green-800 hover:bg-green-100 focus-visible:ring-green-800",
  soft: "bg-green-100 text-green-800 hover:bg-green-50 focus-visible:ring-green-800",
  danger:
    "bg-status-danger text-white hover:brightness-95 focus-visible:ring-white focus-visible:ring-offset-status-danger",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-touch px-4 text-base",
  md: "min-h-touch px-5 text-base",
  lg: "min-h-action px-6 text-base",
  xl: "min-h-primary px-7 text-lg",
};

/** Shared class recipe so links can look like buttons without invalid nesting. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}): string {
  return cn(
    "inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold leading-tight transition-colors",
    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      fullWidth = false,
      isLoading = false,
      leadingIcon,
      trailingIcon,
      className,
      children,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        aria-disabled={disabled || isLoading ? true : undefined}
        aria-busy={isLoading || undefined}
        className={buttonClasses({ variant, size, fullWidth, className })}
        {...props}
      >
        {isLoading ? (
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          />
        ) : (
          leadingIcon
        )}
        <span>{children}</span>
        {!isLoading && trailingIcon}
      </button>
    );
  },
);
