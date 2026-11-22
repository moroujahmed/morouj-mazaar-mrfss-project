"use client";

import { PlayCircle, StopCircle, Wallet } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/input";
import { formatUGX } from "@/lib/currency";
import type { RiderCashSummary, RiderShift } from "@/lib/rider/types";

export function RiderShiftPanel({
  shift,
  cash,
  hasActive,
  pending,
  onStart,
  onEnd,
}: {
  shift: RiderShift;
  cash: RiderCashSummary;
  hasActive: boolean;
  pending: boolean;
  onStart: (openingFloat: number) => void;
  onEnd: () => void;
}) {
  const [openingFloat, setOpeningFloat] = useState("0");
  const [error, setError] = useState<string | undefined>();

  if (!shift.isOpen) {
    return (
      <section
        aria-labelledby="shift-start-heading"
        className="rounded-2xl border border-orange-500 bg-status-warningSurface p-4 sm:p-5"
      >
        <div className="flex items-start gap-3">
          <Wallet aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-status-warning" />
          <div className="min-w-0 flex-1">
            <h2
              id="shift-start-heading"
              className="text-lg font-extrabold text-green-800"
            >
              Start your shift
            </h2>
            <p className="text-sm text-ink-secondary">
              Record the cash you are carrying before you claim a delivery. You
              cannot claim until your shift is open.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-start">
              <TextField
                label="Opening float (UGX)"
                type="number"
                inputMode="numeric"
                min={0}
                step={1000}
                value={openingFloat}
                error={error}
                hint="Use 0 if you are not carrying change."
                onChange={(event) => {
                  setOpeningFloat(event.target.value);
                  setError(undefined);
                }}
                className="sm:max-w-xs"
              />
              <Button
                data-testid="rider-shift-start"
                size="xl"
                className="sm:mt-7"
                isLoading={pending}
                onClick={() => {
                  const amount = Number(openingFloat);
                  if (!Number.isInteger(amount) || amount < 0) {
                    setError("Enter a whole shilling amount of 0 or more.");
                    return;
                  }
                  onStart(amount);
                }}
                leadingIcon={<PlayCircle aria-hidden="true" className="size-5" />}
              >
                Start shift
              </Button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="shift-summary-heading"
      className="rounded-2xl border border-green-100 bg-surface p-4 shadow-card sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Wallet aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-orange-700" />
          <div>
            <h2
              id="shift-summary-heading"
              className="text-lg font-extrabold text-green-800"
            >
              Shift open
            </h2>
            <p className="text-sm text-ink-secondary">
              Opening float {formatUGX(shift.openingFloat)}. The manager settles
              cash at the end of the day.
            </p>
          </div>
        </div>

        <Button
          data-testid="rider-shift-end"
          variant="secondary"
          size="lg"
          disabled={hasActive}
          isLoading={pending}
          onClick={onEnd}
          leadingIcon={<StopCircle aria-hidden="true" className="size-5" />}
        >
          End shift
        </Button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-surface-inset p-3">
          <dt className="text-sm font-semibold text-ink-secondary">
            Cash to hand over
          </dt>
          <dd className="text-xl font-extrabold text-green-800">
            {formatUGX(cash.outstandingCash)}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-inset p-3">
          <dt className="text-sm font-semibold text-ink-secondary">
            Unsettled orders
          </dt>
          <dd className="text-xl font-extrabold text-green-800">
            {formatUGX(cash.unsettledOrderCash)}
          </dd>
        </div>
        <div className="rounded-xl bg-surface-inset p-3">
          <dt className="text-sm font-semibold text-ink-secondary">
            Shortfall carried
          </dt>
          <dd className="text-xl font-extrabold text-green-800">
            {formatUGX(cash.settlementShortfall)}
          </dd>
        </div>
      </dl>

      {hasActive ? (
        <p className="mt-3 text-sm text-ink-secondary">
          Finish, release, or report your active delivery before ending the
          shift.
        </p>
      ) : null}
    </section>
  );
}
