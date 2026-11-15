"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/**
 * Native <dialog> sheet. Mobile anchors to the bottom; desktop centres the
 * panel. Escape and the labelled close control both close it, and focus
 * returns to the trigger when it unmounts.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: SheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }

    previouslyFocused.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    if (!dialog.open) dialog.showModal();

    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      className="fixed inset-0 z-50 m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto bg-transparent p-0 backdrop:bg-green-900/60 backdrop:backdrop-blur-sm"
    >
      {/* Clicking the empty backdrop area closes the sheet. */}
      <div
        className="flex min-h-dvh items-end justify-center sm:items-center sm:p-6"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div
          role="document"
          className={cn(
            "relative w-full rounded-t-2xl bg-surface p-5 shadow-sheet sm:max-w-lg sm:rounded-2xl sm:p-6",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id={titleId}
                className="text-xl font-extrabold text-green-800"
              >
                {title}
              </h2>
              {description ? (
                <p id={descriptionId} className="mt-1 text-sm text-ink-secondary">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl text-green-800 hover:bg-green-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-green-800 focus-visible:ring-offset-2"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
          <div className="mt-4">{children}</div>
          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </div>
    </dialog>
  );
}
