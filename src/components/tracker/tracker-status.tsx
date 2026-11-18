import { formatInTimeZone } from "date-fns-tz";
import {
  Banknote,
  CheckCircle2,
  Clock,
  MapPin,
  UtensilsCrossed,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDistanceMetres } from "@/lib/currency";
import type { TrackerSnapshot } from "@/lib/orders/tracker";

import { PAYMENT_COPY, STATUS_COPY } from "./tracker-copy";

export function formatEta(
  etaAt: string | null | undefined,
  timezone = "Africa/Kampala",
): string | null {
  if (!etaAt) return null;
  const date = new Date(etaAt);
  if (Number.isNaN(date.getTime())) return null;
  return formatInTimeZone(date, timezone, "HH:mm");
}

export function TrackerStatus({ snapshot }: { snapshot: TrackerSnapshot }) {
  const status = STATUS_COPY[snapshot.status];
  const payment = PAYMENT_COPY[snapshot.paymentStatus];
  const eta = formatEta(snapshot.etaAt);
  const riderName =
    snapshot.status === "CLAIMED" || snapshot.status === "OUT_FOR_DELIVERY"
      ? snapshot.rider?.name
      : null;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-green-100 bg-surface p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-eyebrow uppercase text-orange-700">
            Order #{snapshot.orderNumber}
          </p>
          <h1
            className="text-2xl font-extrabold text-green-900"
            data-testid="order-status"
          >
            {status.label}
          </h1>
          <p className="text-sm text-ink-secondary">{status.detail}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone} icon={<Clock className="size-4" />}>
            {status.label}
          </Badge>
          <Badge
            tone={payment.tone}
            icon={
              snapshot.paymentStatus === "PAID" ? (
                <CheckCircle2 className="size-4" />
              ) : (
                <Banknote className="size-4" />
              )
            }
          >
            {payment.label}
          </Badge>
        </div>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-sm text-ink-secondary">
            {snapshot.orderType === "DINE_IN" ? "Table" : "Delivering to"}
          </dt>
          <dd className="flex items-center gap-1.5 font-semibold text-green-900">
            {snapshot.orderType === "DINE_IN" ? (
              <UtensilsCrossed aria-hidden="true" className="size-4" />
            ) : (
              <MapPin aria-hidden="true" className="size-4" />
            )}
            {snapshot.orderType === "DINE_IN"
              ? `Table ${snapshot.tableNumber ?? "—"}`
              : (snapshot.deliveryArea ?? "Your delivery pin")}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-sm text-ink-secondary">Name</dt>
          <dd className="font-semibold text-green-900">
            {snapshot.customerName}
          </dd>
        </div>
        {snapshot.orderType === "DELIVERY" &&
        snapshot.roadDistanceM != null ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm text-ink-secondary">Road distance</dt>
            <dd className="font-semibold text-green-900">
              {formatDistanceMetres(snapshot.roadDistanceM)}
            </dd>
          </div>
        ) : null}
        {eta ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm text-ink-secondary">Estimated arrival</dt>
            <dd className="font-semibold text-green-900">{eta} EAT</dd>
          </div>
        ) : null}
        {riderName ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm text-ink-secondary">Rider</dt>
            <dd className="font-semibold text-green-900">{riderName}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
