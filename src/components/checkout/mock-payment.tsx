"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, XCircle } from "lucide-react";

import { completeMockPaymentAction } from "@/actions/payments";
import { Button } from "@/components/ui/button";

/**
 * Test-only hosted-checkout stand-in. No network call, no money. Enabled only
 * when `PAYMENTS_FIXTURE=1` (or `PAYMENTS_MODE=mock` outside production), and
 * the server action re-checks that gate on every call.
 */
export function MockPaymentPanel({ txRef }: { txRef: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [outcome, setOutcome] = useState<"success" | "failure" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function complete(next: "success" | "failure") {
    startTransition(async () => {
      setOutcome(next);
      setMessage(null);

      const result = await completeMockPaymentAction({
        txRef,
        outcome: next,
      });

      if (!result.ok) {
        setOutcome(null);
        setMessage(result.error.message);
        return;
      }

      if (next === "success") {
        router.push(`/orders/${result.data.orderToken}`);
        return;
      }

      setMessage(
        "The test payment was declined. The order is still awaiting payment.",
      );
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 rounded-2xl border border-green-100 bg-surface p-5 shadow-card">
        <p className="text-eyebrow uppercase text-orange-700">
          Test payment page
        </p>
        <h1 className="text-2xl font-extrabold text-green-900">
          Simulate the hosted checkout
        </h1>
        <p className="text-sm text-ink-secondary">
          This page only exists in fixture mode. No card or mobile-money account
          is charged.
        </p>
        <p className="mt-2 break-all rounded-lg bg-surface-inset p-3 font-mono text-xs text-ink-secondary">
          tx_ref: {txRef}
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-green-100 bg-surface p-5 shadow-card">
        <Button
          size="xl"
          fullWidth
          isLoading={pending && outcome === "success"}
          disabled={pending}
          leadingIcon={<CreditCard aria-hidden="true" className="size-5" />}
          onClick={() => complete("success")}
        >
          Approve test payment
        </Button>
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          isLoading={pending && outcome === "failure"}
          disabled={pending}
          leadingIcon={<XCircle aria-hidden="true" className="size-5" />}
          onClick={() => complete("failure")}
        >
          Decline test payment
        </Button>

        {message ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-status-dangerSurface p-3 text-sm font-semibold text-status-danger"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {message}
          </p>
        ) : null}
      </div>

      <p className="flex items-start gap-2 px-1 text-sm text-ink-secondary">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        Production always redirects to Flutterwave hosted checkout. This adapter
        is selected only by the explicit test flag.
      </p>

      <Link
        href="/checkout"
        className="text-center text-sm font-semibold text-green-800 underline underline-offset-4"
      >
        Return to checkout
      </Link>
    </div>
  );
}
