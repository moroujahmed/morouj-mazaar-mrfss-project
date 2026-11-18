"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatUGX } from "@/lib/currency";
import {
  isTerminalStatus,
  type TrackerSnapshot,
} from "@/lib/orders/tracker";
import type { DigitalPaymentMethod } from "@/lib/schemas/order";
import { publicEnv } from "@/lib/public-env";

import { PaymentRetryPanel } from "./tracker-actions";
import { STATUS_COPY } from "./tracker-copy";
import { TrackerDocket } from "./tracker-docket";
import { TrackerFeedback } from "./tracker-feedback";
import { TrackerMap } from "./tracker-map";
import { TrackerPin } from "./tracker-pin";
import { TrackerStatus } from "./tracker-status";
import { TrackerTimeline } from "./tracker-timeline";

const POLL_INTERVAL_MS = 10_000;

const CANCELLATION_COPY: Record<string, string> = {
  PAYMENT_TIMEOUT: "The payment was not completed in time.",
  CANCELLED_BY_STAFF: "The restaurant cancelled this order.",
  CANCELLED_BY_CUSTOMER: "This order was cancelled.",
  STORE_CLOSED: "The store closed before the order could be confirmed.",
};

const FAILURE_COPY: Record<string, string> = {
  CUSTOMER_UNREACHABLE: "The rider could not reach you at the delivery pin.",
  INCORRECT_ADDRESS: "The delivery address could not be found.",
  CUSTOMER_REFUSED: "The order was refused at the door.",
  RIDER_EMERGENCY: "The rider had to stop the delivery.",
};

const REFUND_COPY: Record<string, string> = {
  REQUESTED: "Refund requested",
  PROCESSING: "Refund processing",
  COMPLETED: "Refunded",
  FAILED: "Refund needs attention",
  REJECTED: "Refund declined",
};

function supportHref(orderNumber: number): string | null {
  const digits = publicEnv.supportWhatsApp.replace(/\D/g, "");
  if (!digits) return null;
  const text = encodeURIComponent(
    `Hi, I need help with order #${orderNumber}.`,
  );
  return `https://wa.me/${digits}?text=${text}`;
}

export function TrackerLive({
  initial,
  initialPin,
}: {
  initial: TrackerSnapshot;
  initialPin: string | null;
}) {
  const [snapshot, setSnapshot] = useState<TrackerSnapshot>(initial);
  const [pin, setPin] = useState<string | null>(initialPin);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const statusRef = useRef(initial.status);
  const pollRef = useRef<(() => Promise<void>) | null>(null);

  const poll = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/orders/${snapshot.orderToken}/tracking`,
        {
          cache: "no-store",
          headers: { accept: "application/json" },
        },
      );
      if (!response.ok) throw new Error("tracking request failed");

      const payload = (await response.json()) as {
        ok?: boolean;
        data?: TrackerSnapshot;
      };
      if (payload.ok !== true || !payload.data) {
        throw new Error("tracking payload invalid");
      }

      const next = payload.data;
      if (next.status !== statusRef.current) {
        statusRef.current = next.status;
        setAnnouncement(
          `Order status updated to ${STATUS_COPY[next.status].label}.`,
        );
      }
      setSnapshot(next);
      setError(null);
      if (isTerminalStatus(next.status)) setPin(null);
    } catch {
      // Automatic polls stay quiet; the manual refresh surfaces the problem.
    }
  }, [snapshot.orderToken]);

  pollRef.current = poll;

  useEffect(() => {
    let timer: number | undefined;

    const start = () => {
      if (timer !== undefined) return;
      timer = window.setInterval(() => {
        if (document.visibilityState === "visible") void poll();
      }, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void poll();
        start();
      } else {
        stop();
      }
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [poll]);

  useEffect(() => {
    if (!publicEnv.realtimeEnabled) return;
    if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) return;

    let cancelled = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        if (cancelled) return;

        const supabase = createClient();
        // Broadcast only. Raw postgres_changes is prohibited on orders.
        const channel = supabase.channel(`order:${snapshot.orderToken}`, {
          config: { broadcast: { self: false } },
        });
        channel.on("broadcast", { event: "status" }, () => {
          void pollRef.current?.();
        });
        channel.subscribe();
        cleanup = () => {
          void supabase.removeChannel(channel);
        };
      } catch {
        // Polling remains the fallback when Realtime is unavailable.
      }
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [snapshot.orderToken]);

  async function refreshNow() {
    setRefreshing(true);
    setError(null);
    await poll();
    setRefreshing(false);
  }

  const status = STATUS_COPY[snapshot.status];
  const terminal = isTerminalStatus(snapshot.status);
  const awaitingDigitalPayment =
    snapshot.paymentStatus === "PENDING" &&
    snapshot.status === "PENDING_PAYMENT" &&
    snapshot.paymentMethod !== "CASH_ON_DELIVERY";
  const refund = snapshot.refund;
  const support = supportHref(snapshot.orderNumber);

  return (
    <>
      <p
        role="status"
        aria-live="polite"
        data-testid="tracker-announcement"
        className="sr-only"
      >
        {announcement}
      </p>

      <TrackerStatus snapshot={snapshot} />

      {error ? (
        <p
          role="alert"
          className="rounded-xl border-2 border-status-warning bg-status-warningSurface p-3 text-sm font-semibold text-status-warning"
        >
          {error}
        </p>
      ) : null}

      <TrackerMap snapshot={snapshot} />

      <TrackerPin
        pin={pin}
        active={!terminal && snapshot.orderType === "DELIVERY"}
      />

      <TrackerTimeline snapshot={snapshot} />

      {snapshot.status === "CANCELLED" ? (
        <section
          aria-labelledby="cancelled-heading"
          className="flex flex-col gap-2 rounded-2xl border-2 border-status-danger bg-status-dangerSurface p-5 text-status-danger"
        >
          <h2
            id="cancelled-heading"
            className="flex items-center gap-2 text-lg font-extrabold"
          >
            <AlertTriangle aria-hidden="true" className="size-5" />
            Order cancelled
          </h2>
          <p className="text-sm font-semibold">
            {CANCELLATION_COPY[snapshot.cancellationReason ?? ""] ??
              "The restaurant cancelled this order."}
          </p>
          {refund ? (
            <p className="text-sm">
              {REFUND_COPY[refund.status] ?? "Refund requested"}:{" "}
              {formatUGX(refund.amount)}.
            </p>
          ) : snapshot.paymentStatus === "PAID" ? (
            <p className="text-sm">
              Any payment taken is being refunded. Support can confirm the
              status.
            </p>
          ) : null}
          {support ? (
            <a
              href={support}
              className="text-sm font-semibold underline underline-offset-4"
            >
              Contact support on WhatsApp
            </a>
          ) : null}
        </section>
      ) : null}

      {snapshot.status === "DELIVERY_FAILED" ? (
        <section
          aria-labelledby="failed-heading"
          className="flex flex-col gap-2 rounded-2xl border-2 border-status-danger bg-status-dangerSurface p-5 text-status-danger"
        >
          <h2
            id="failed-heading"
            className="flex items-center gap-2 text-lg font-extrabold"
          >
            <AlertTriangle aria-hidden="true" className="size-5" />
            Delivery could not be completed
          </h2>
          <p className="text-sm font-semibold">
            {FAILURE_COPY[snapshot.deliveryFailure?.reason ?? ""] ??
              "Our team will contact you with the next step."}
          </p>
          {refund ? (
            <p className="text-sm">
              {REFUND_COPY[refund.status] ?? "Refund requested"}:{" "}
              {formatUGX(refund.amount)}.
            </p>
          ) : null}
          {support ? (
            <a
              href={support}
              className="text-sm font-semibold underline underline-offset-4"
            >
              Contact support on WhatsApp
            </a>
          ) : null}
        </section>
      ) : null}

      {snapshot.status === "DELIVERED" && refund ? (
        <p className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-900">
          {REFUND_COPY[refund.status] ?? "Refund requested"}:{" "}
          {formatUGX(refund.amount)}.
        </p>
      ) : null}

      <TrackerDocket snapshot={snapshot} />

      {awaitingDigitalPayment ? (
        <section
          aria-labelledby="payment-retry-heading"
          className="flex flex-col gap-3 rounded-2xl border border-green-100 bg-surface p-5 shadow-card"
        >
          <div className="flex flex-col gap-1">
            <h2
              id="payment-retry-heading"
              className="text-lg font-extrabold text-green-800"
            >
              Finish your payment
            </h2>
            <p className="text-sm text-ink-secondary">
              The kitchen has your order but will not start until the payment
              is confirmed. A failed attempt never confirms the order.
            </p>
          </div>
          <PaymentRetryPanel
            orderToken={snapshot.orderToken}
            method={snapshot.paymentMethod as DigitalPaymentMethod}
          />
        </section>
      ) : null}

      {!terminal ? (
        <p className="flex items-start gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-900">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {status.detail}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          isLoading={refreshing}
          leadingIcon={<RefreshCw aria-hidden="true" className="size-4" />}
          onClick={refreshNow}
        >
          Refresh status
        </Button>
        <p className="text-sm text-ink-secondary">
          Updates every 10 seconds while this screen is open.
        </p>
      </div>

      <TrackerFeedback snapshot={snapshot} />
    </>
  );
}
