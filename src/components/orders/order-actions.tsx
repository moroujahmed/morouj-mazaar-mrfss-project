"use client";

import { RefreshCw, CreditCard } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { initiatePaymentAction } from "@/actions/payments";
import { Button } from "@/components/ui/button";
import type { DigitalPaymentMethod } from "@/lib/schemas/order";

/**
 * Tracker actions. A digital order still awaiting payment can restart hosted
 * checkout; a retry allocates a fresh attempt reference.
 */
export function PaymentRetryPanel({
  orderToken,
  method,
}: {
  orderToken: string;
  method: DigitalPaymentMethod;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        fullWidth
        isLoading={pending}
        leadingIcon={<CreditCard aria-hidden="true" className="size-5" />}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await initiatePaymentAction({
              orderToken,
              method,
            });
            if (!result.ok) {
              setError(result.error.message);
              return;
            }
            window.location.assign(result.data.redirectUrl);
          })
        }
      >
        Complete payment
      </Button>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-status-danger">
          {error}
        </p>
      ) : null}
      <Link
        href={`/orders/${orderToken}`}
        className="text-center text-sm font-semibold text-green-800 underline underline-offset-4"
      >
        Back to your order
      </Link>
    </div>
  );
}

export function RefreshOrderButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      size="sm"
      isLoading={pending}
      leadingIcon={<RefreshCw aria-hidden="true" className="size-4" />}
      onClick={() => startTransition(() => router.refresh())}
    >
      Refresh status
    </Button>
  );
}
