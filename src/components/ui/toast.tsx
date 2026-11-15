"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

export type ToastTone = "info" | "success" | "error";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
};

type ToastRecord = ToastInput & {
  id: number;
  tone: ToastTone;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => number;
  dismissToast: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION_MS = 6_000;

/**
 * Application toast provider. Errors use role="alert"; other tones use the
 * implicit status live region, so colour is never the only signal.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismissToast = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, description, tone = "info" }: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [
        ...current.slice(-2),
        { id, title, description, tone },
      ]);
      timers.current.set(
        id,
        setTimeout(() => dismissToast(id), DURATION_MS),
      );
      return id;
    },
    [dismissToast],
  );

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      for (const timer of activeTimers.values()) clearTimeout(timer);
      activeTimers.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <section
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-stretch gap-3 p-4 sm:items-end"
      >
        {toasts.map((toast) => (
          <ToastCard
            key={toast.id}
            toast={toast}
            onDismiss={() => dismissToast(toast.id)}
          />
        ))}
      </section>
    </ToastContext.Provider>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: () => void;
}) {
  const Icon =
    toast.tone === "error"
      ? AlertCircle
      : toast.tone === "success"
        ? CheckCircle2
        : Info;

  return (
    <div
      role={toast.tone === "error" ? "alert" : "status"}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-xl border-2 bg-surface p-4 shadow-card",
        toast.tone === "error" && "border-status-danger",
        toast.tone === "success" && "border-status-success",
        toast.tone === "info" && "border-green-800",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "mt-0.5 size-5 shrink-0",
          toast.tone === "error" && "text-status-danger",
          toast.tone === "success" && "text-status-success",
          toast.tone === "info" && "text-green-800",
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-green-900">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-sm text-ink-secondary">
            {toast.description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={`Dismiss notification: ${toast.title}`}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-green-800 hover:bg-green-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-green-800 focus-visible:ring-offset-2"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return context;
}
