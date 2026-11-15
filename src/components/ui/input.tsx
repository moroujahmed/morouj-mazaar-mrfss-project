import {
  forwardRef,
  useId,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

const controlBase =
  "block w-full rounded-xl border-2 bg-surface px-4 text-base text-ink shadow-none transition-colors placeholder:text-ink-secondary/80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-green-800 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-surface-inset disabled:text-ink-secondary";

function controlState(error?: string): string {
  return error
    ? "border-status-danger"
    : "border-green-100 hover:border-green-700";
}

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  hintId?: string;
  errorId?: string;
  control: ReactNode;
};

function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  className,
  hintId,
  errorId,
  control,
}: FieldShellProps) {
  return (
    <div className={cn("flex w-full flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-semibold text-green-900">
        {label}
        {required ? (
          <>
            <span aria-hidden="true" className="ml-0.5 text-status-danger">
              *
            </span>
            <span className="sr-only"> (required)</span>
          </>
        ) : null}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="text-sm text-ink-secondary">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-start gap-1.5 text-sm font-semibold text-status-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(...ids: Array<string | undefined>): string | undefined {
  const value = ids.filter(Boolean).join(" ");
  return value || undefined;
}

export type TextFieldProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "id" | "className"
> & {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
  className?: string;
  controlClassName?: string;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    { label, hint, error, required, id, className, controlClassName, ...props },
    ref,
  ) {
    const generatedId = useId();
    const fieldId = id ?? `field-${generatedId}`;
    const hintId = hint ? `${fieldId}-hint` : undefined;
    const errorId = error ? `${fieldId}-error` : undefined;

    return (
      <FieldShell
        id={fieldId}
        label={label}
        hint={hint}
        error={error}
        required={required}
        className={className}
        hintId={hintId}
        errorId={errorId}
        control={
          <input
            ref={ref}
            id={fieldId}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(hintId, errorId)}
            className={cn(
              controlBase,
              controlState(error),
              "h-12",
              controlClassName,
            )}
            {...props}
          />
        }
      />
    );
  },
);

export type TextareaFieldProps = Omit<
  ComponentPropsWithoutRef<"textarea">,
  "id" | "className"
> & {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
  className?: string;
  controlClassName?: string;
};

export const TextareaField = forwardRef<
  HTMLTextAreaElement,
  TextareaFieldProps
>(function TextareaField(
  { label, hint, error, required, id, className, controlClassName, ...props },
  ref,
) {
  const generatedId = useId();
  const fieldId = id ?? `field-${generatedId}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;

  return (
    <FieldShell
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      required={required}
      className={className}
      hintId={hintId}
      errorId={errorId}
      control={
        <textarea
          ref={ref}
          id={fieldId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(hintId, errorId)}
          className={cn(
            controlBase,
            controlState(error),
            "min-h-24 py-3",
            controlClassName,
          )}
          {...props}
        />
      }
    />
  );
});

export type SelectFieldProps = Omit<
  ComponentPropsWithoutRef<"select">,
  "id" | "className"
> & {
  label: string;
  hint?: string;
  error?: string;
  id?: string;
  className?: string;
  controlClassName?: string;
};

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  function SelectField(
    {
      label,
      hint,
      error,
      required,
      id,
      className,
      controlClassName,
      children,
      ...props
    },
    ref,
  ) {
    const generatedId = useId();
    const fieldId = id ?? `field-${generatedId}`;
    const hintId = hint ? `${fieldId}-hint` : undefined;
    const errorId = error ? `${fieldId}-error` : undefined;

    return (
      <FieldShell
        id={fieldId}
        label={label}
        hint={hint}
        error={error}
        required={required}
        className={className}
        hintId={hintId}
        errorId={errorId}
        control={
          <select
            ref={ref}
            id={fieldId}
            required={required}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(hintId, errorId)}
            className={cn(
              controlBase,
              controlState(error),
              "h-12 pr-10",
              controlClassName,
            )}
            {...props}
          >
            {children}
          </select>
        }
      />
    );
  },
);
