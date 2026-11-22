"use client";

import {
  AlertTriangle,
  CheckCircle2,
  MapPin,
  Navigation,
  Phone,
  ShieldCheck,
  Undo2,
  Wallet,
} from "lucide-react";

import { DynamicMap, type MapMarker } from "@/components/map/dynamic-map";
import { Button } from "@/components/ui/button";
import { formatUGX } from "@/lib/currency";
import { formatUgPhone } from "@/lib/phone";
import type { RiderActiveOrder } from "@/lib/rider/types";
import type { GeolocationStatus, RiderPosition } from "@/hooks/use-geolocation";

const PAYMENT_LABEL: Record<RiderActiveOrder["paymentMethod"], string> = {
  MTN_MOMO: "MTN MoMo",
  AIRTEL_MONEY: "Airtel Money",
  CASH_ON_DELIVERY: "Cash on delivery",
  BANK_CARD: "Card",
};

const timeFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Kampala",
  hour: "2-digit",
  minute: "2-digit",
});

function itemTotal(name: string, quantity: number, lineTotal: number): string {
  return `${quantity} × ${name} · ${formatUGX(lineTotal)}`;
}

export function RiderActiveDelivery({
  order,
  online,
  geoStatus,
  position,
  pendingCount,
  pendingAction,
  onStart,
  onOpenPin,
  onOpenRelease,
  onOpenFailed,
}: {
  order: RiderActiveOrder;
  online: boolean;
  geoStatus: GeolocationStatus;
  position: RiderPosition | null;
  pendingCount: number;
  pendingAction: string | null;
  onStart: () => void;
  onOpenPin: () => void;
  onOpenRelease: () => void;
  onOpenFailed: () => void;
}) {
  const isOut = order.status === "OUT_FOR_DELIVERY";
  const cash = order.paymentMethod === "CASH_ON_DELIVERY";

  const destination: [number, number] | null =
    order.deliveryLatitude !== null &&
    order.deliveryLongitude !== null &&
    order.deliveryLatitude !== undefined &&
    order.deliveryLongitude !== undefined
      ? [order.deliveryLatitude, order.deliveryLongitude]
      : null;

  const markers: MapMarker[] = [];
  if (destination) {
    markers.push({
      id: "destination",
      lat: destination[0],
      lng: destination[1],
      label: `Delivery destination: ${order.deliveryArea ?? "customer address"}`,
      kind: "destination",
    });
  }
  if (position) {
    markers.push({
      id: "rider",
      lat: position.latitude,
      lng: position.longitude,
      label: "Your current position",
      kind: "rider",
    });
  }

  const center = position
    ? ([position.latitude, position.longitude] as const)
    : destination;

  const stalePosition =
    position !== null &&
    Date.now() - Date.parse(position.recordedAt) > 2 * 60 * 1_000;

  const gpsLabel = !online
    ? "GPS paused — offline. The customer sees the last confirmed position."
    : geoStatus === "denied"
      ? "GPS paused — permission denied. Call and navigate manually."
      : geoStatus === "requesting"
        ? "Finding your position…"
        : geoStatus === "active"
          ? stalePosition
            ? "GPS stale — no fix in the last two minutes."
            : `Sharing position${pendingCount > 0 ? ` · ${pendingCount} point${pendingCount === 1 ? "" : "s"} waiting to sync` : ""}.`
          : geoStatus === "unavailable"
            ? "GPS unavailable. Move into the open and try again."
            : geoStatus === "error"
              ? "GPS timed out. Keep this screen open and try again."
              : "GPS starts when you tap Start trip.";

  return (
    <section
      data-testid="rider-active"
      aria-labelledby="active-heading"
      className="flex flex-col gap-4"
    >
      <div className="rounded-2xl border border-green-100 bg-surface p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-orange-700">
              {isOut ? "On the way" : "Claimed — collect from the pass"}
            </p>
            <h2 id="active-heading" className="text-2xl font-extrabold text-green-800">
              Order #{order.orderNumber}
            </h2>
            <p className="text-sm text-ink-secondary">
              {order.status === "CLAIMED"
                ? `Claimed ${order.claimedAt ? `at ${timeFormat.format(new Date(order.claimedAt))}` : "just now"}. Start the trip when you leave.`
                : `Started ${order.dispatchedAt ? `at ${timeFormat.format(new Date(order.dispatchedAt))}` : "just now"}. Verify the handover PIN at the door.`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-800">
              {PAYMENT_LABEL[order.paymentMethod]}
            </span>
            <span className="text-sm text-ink-secondary">
              {order.paymentStatus === "PAID" ? "Paid" : "Payment due on delivery"}
            </span>
          </div>
        </div>

        {cash ? (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-orange-500 bg-status-warningSurface p-3 text-status-warning">
            <Wallet aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-bold">
                Collect {formatUGX(order.totalAmount)} in cash
              </p>
              <p className="text-sm">
                {order.codChangeDue === null || order.codChangeDue === undefined
                  ? "No change requested. Carry small notes."
                  : `Change due at the door: ${formatUGX(order.codChangeDue)}.`}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-surface-inset p-3">
            <h3 className="text-sm font-bold text-ink-secondary">Customer</h3>
            <p className="mt-1 font-semibold text-green-900">{order.customerName}</p>
            <a
              href={`tel:${order.customerPhone}`}
              className="mt-2 inline-flex min-h-touch items-center gap-2 text-base font-semibold text-green-800 underline-offset-4 hover:underline"
            >
              <Phone aria-hidden="true" className="size-4" />
              {formatUgPhone(order.customerPhone)}
            </a>
          </div>

          <div className="rounded-xl bg-surface-inset p-3">
            <h3 className="text-sm font-bold text-ink-secondary">Address</h3>
            <p className="mt-1 flex items-start gap-1.5 font-semibold text-green-900">
              <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                {order.deliveryAddressText ?? order.deliveryArea ?? "Address not recorded"}
              </span>
            </p>
            {destination ? (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${destination[0]},${destination[1]}`}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex min-h-touch items-center gap-2 text-base font-semibold text-green-800 underline-offset-4 hover:underline"
              >
                <Navigation aria-hidden="true" className="size-4" />
                Open navigation
              </a>
            ) : null}
          </div>
        </div>

        {order.customerNotes ? (
          <p className="mt-3 rounded-xl border border-green-100 p-3 text-sm text-ink">
            <span className="font-bold text-green-900">Customer note: </span>
            {order.customerNotes}
          </p>
        ) : null}

        <h3 className="mt-4 text-sm font-bold uppercase tracking-wide text-ink-secondary">
          Items
        </h3>
        <ul className="mt-1 divide-y divide-green-50">
          {order.items.map((line, index) => (
            <li key={`${line.name}-${index}`} className="py-2">
              <p className="font-semibold text-green-900">
                {itemTotal(line.name, line.quantity, line.lineTotal)}
              </p>
              {line.modifiers.length > 0 ? (
                <p className="text-sm text-ink-secondary">
                  {line.modifiers.map((modifier) => modifier.name).join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {isOut ? (
        <div className="rounded-2xl border border-green-100 bg-surface p-4 shadow-card">
          <div className="flex items-start gap-3">
            <Navigation aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-orange-700" />
            <div>
              <h3 className="font-extrabold text-green-800">Live position</h3>
              <p className="text-sm text-ink-secondary" data-testid="rider-gps-status">
                {gpsLabel}
              </p>
              <p className="mt-1 text-xs text-ink-secondary">
                Keep this screen open while you ride. The customer sees only your
                position, never your phone or the handover PIN.
              </p>
            </div>
          </div>

          {center && markers.length > 0 ? (
            <div className="mt-3 h-56 w-full">
              <DynamicMap
                center={center}
                markers={markers}
                ariaLabel="Delivery destination and your shared position"
                fallback={`Destination: ${order.deliveryArea ?? "customer address"}${order.roadDistanceM ? ` · ${(order.roadDistanceM / 1000).toFixed(2)} km by road` : ""}.`}
              />
            </div>
          ) : (
            <p className="mt-3 rounded-xl bg-surface-inset p-3 text-sm text-ink-secondary">
              Map unavailable without a location. Use the navigation link above.
            </p>
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 rounded-2xl border border-green-100 bg-surface p-4 shadow-card sm:flex-row sm:flex-wrap">
        {order.status === "CLAIMED" ? (
          <Button
            data-testid="rider-start"
            size="xl"
            fullWidth
            className="sm:w-auto sm:flex-1"
            isLoading={pendingAction === "start"}
            onClick={onStart}
            leadingIcon={<Navigation aria-hidden="true" className="size-5" />}
          >
            Start trip
          </Button>
        ) : (
          <Button
            data-testid="rider-pin-open"
            size="xl"
            fullWidth
            className="sm:w-auto sm:flex-1"
            onClick={onOpenPin}
            leadingIcon={<ShieldCheck aria-hidden="true" className="size-5" />}
          >
            Enter handover PIN
          </Button>
        )}

        {order.status === "CLAIMED" ? (
          <Button
            variant="secondary"
            size="xl"
            disabled={pendingAction !== null}
            onClick={onOpenRelease}
            leadingIcon={<Undo2 aria-hidden="true" className="size-5" />}
          >
            Release
          </Button>
        ) : (
          <Button
            variant="danger"
            size="xl"
            disabled={pendingAction !== null}
            onClick={onOpenFailed}
            leadingIcon={<AlertTriangle aria-hidden="true" className="size-5" />}
          >
            Report failed delivery
          </Button>
        )}
      </div>

      {!online ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-status-danger bg-status-dangerSurface p-4 text-status-danger"
        >
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-bold">You are offline</p>
            <p className="text-sm">
              The handover PIN cannot be verified without a connection. Do not
              mark the delivery complete. Reconnect to finish.
            </p>
          </div>
        </div>
      ) : null}

      {order.status === "OUT_FOR_DELIVERY" && order.codChangeDue ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-green-800">
          <CheckCircle2 aria-hidden="true" className="size-4" />
          Confirm the change before you leave the door.
        </p>
      ) : null}
    </section>
  );
}
