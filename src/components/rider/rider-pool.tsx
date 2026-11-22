"use client";

import { Bike, Clock, MapPin, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatUGX } from "@/lib/currency";
import type { RiderPoolItem } from "@/lib/rider/types";

const PAYMENT_LABEL: Record<RiderPoolItem["paymentMethod"], string> = {
  MTN_MOMO: "MTN MoMo",
  AIRTEL_MONEY: "Airtel Money",
  CASH_ON_DELIVERY: "Cash on delivery",
  BANK_CARD: "Card",
};

function readyTime(value: string): string {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "Ready now";
  return `Ready ${new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Kampala",
    hour: "2-digit",
    minute: "2-digit",
  }).format(at)}`;
}

export function RiderPool({
  pool,
  shiftOpen,
  pendingOrderId,
  onClaim,
}: {
  pool: readonly RiderPoolItem[];
  shiftOpen: boolean;
  pendingOrderId: string | null;
  onClaim: (orderId: string) => void;
}) {
  if (pool.length === 0) {
    return (
      <EmptyState
        icon={<Bike aria-hidden="true" className="size-6" />}
        title="No deliveries waiting"
        description="When the kitchen marks an order ready, it appears here. Keep this screen open; it refreshes every ten seconds."
      />
    );
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {pool.map((item) => {
        const pending = pendingOrderId === item.orderId;
        return (
          <li
            key={item.orderId}
            data-testid={`rider-pool-item-${item.orderNumber}`}
            className="flex flex-col gap-3 rounded-2xl border border-green-100 bg-surface p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-green-800">
                  Order #{item.orderNumber}
                </h3>
                <p className="text-sm text-ink-secondary">
                  {readyTime(item.readyAt)} · no customer contact shown until you
                  claim
                </p>
              </div>
              <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-800">
                {formatUGX(item.totalAmount)}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-1.5 text-ink">
                <MapPin aria-hidden="true" className="size-4 text-orange-700" />
                <dt className="sr-only">Area</dt>
                <dd className="truncate">{item.area ?? "Area not recorded"}</dd>
              </div>
              <div className="flex items-center gap-1.5 text-ink">
                <Package aria-hidden="true" className="size-4 text-orange-700" />
                <dt className="sr-only">Items</dt>
                <dd>
                  {item.itemCount} {item.itemCount === 1 ? "item" : "items"}
                </dd>
              </div>
              <div className="flex items-center gap-1.5 text-ink">
                <Clock aria-hidden="true" className="size-4 text-orange-700" />
                <dt className="sr-only">Distance</dt>
                <dd>
                  {item.distanceKm === null || item.distanceKm === undefined
                    ? "Distance unavailable"
                    : `${item.distanceKm.toFixed(2)} km`}
                </dd>
              </div>
              <div className="text-ink">
                <dt className="sr-only">Payment</dt>
                <dd>{PAYMENT_LABEL[item.paymentMethod]}</dd>
              </div>
            </dl>

            <Button
              data-testid="rider-claim"
              size="xl"
              fullWidth
              disabled={!shiftOpen}
              isLoading={pending}
              onClick={() => onClaim(item.orderId)}
              aria-label={`${shiftOpen ? "Claim delivery" : "Start your shift to claim"} — order #${item.orderNumber}`}
            >
              {shiftOpen ? "Claim delivery" : "Start your shift to claim"}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
