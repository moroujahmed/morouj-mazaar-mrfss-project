import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock,
  MapPin,
  ShieldCheck,
  UtensilsCrossed,
} from "lucide-react";

import {
  PaymentRetryPanel,
  RefreshOrderButton,
} from "@/components/orders/order-actions";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { formatDistanceMetres, formatUGX } from "@/lib/currency";
import { getOrderStore } from "@/lib/orders/store";
import {
  orderConfirmationSchema,
  type OrderConfirmation,
} from "@/lib/schemas/order";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your order",
  description: "Track your order status, payment, and handover PIN.",
  robots: { index: false, follow: false },
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_COPY: Record<
  OrderConfirmation["status"],
  { label: string; tone: BadgeTone; detail: string }
> = {
  PENDING_PAYMENT: {
    label: "Awaiting payment",
    tone: "warning",
    detail: "We have your order. The kitchen starts as soon as payment clears.",
  },
  CONFIRMED_UNPAID: {
    label: "Order received",
    tone: "brand",
    detail: "The kitchen will confirm your order shortly. Pay cash on delivery.",
  },
  PREPARING: {
    label: "Preparing",
    tone: "brand",
    detail: "The kitchen is cooking your order now.",
  },
  READY_FOR_PICKUP: {
    label: "Ready",
    tone: "success",
    detail: "Your order is packed and waiting for a rider.",
  },
  CLAIMED: {
    label: "With the rider",
    tone: "success",
    detail: "A rider has your order and is on the way.",
  },
  OUT_FOR_DELIVERY: {
    label: "On the way",
    tone: "success",
    detail: "Your rider is heading to your pin.",
  },
  DELIVERED: {
    label: "Delivered",
    tone: "success",
    detail: "Enjoy your meal.",
  },
  DELIVERY_FAILED: {
    label: "Delivery failed",
    tone: "danger",
    detail: "Our team will contact you about this delivery.",
  },
  CANCELLED: {
    label: "Cancelled",
    tone: "danger",
    detail: "This order was cancelled. Any payment taken is refunded.",
  },
};

const PAYMENT_COPY: Record<
  OrderConfirmation["paymentStatus"],
  { label: string; tone: BadgeTone }
> = {
  PENDING: { label: "Payment pending", tone: "warning" },
  PAID: { label: "Paid", tone: "success" },
  FAILED: { label: "Payment failed", tone: "danger" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
};

function formatEta(etaAt: string | null | undefined, timezone: string) {
  if (!etaAt) return null;
  const date = new Date(etaAt);
  if (Number.isNaN(date.getTime())) return null;
  return formatInTimeZone(date, timezone, "HH:mm");
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!UUID_PATTERN.test(token)) notFound();

  let raw: unknown = null;
  let unavailable = false;
  try {
    raw = await getOrderStore().getOrderByToken(token);
  } catch {
    unavailable = true;
  }

  if (unavailable) {
    return (
      <OrderShell>
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-2xl border-2 border-status-warning bg-status-warningSurface p-4 text-status-warning"
        >
          <p className="flex items-center gap-2 font-extrabold">
            <AlertTriangle aria-hidden="true" className="size-5" />
            We cannot load this order right now
          </p>
          <p className="text-sm">
            Your order is safe. Refresh in a moment, or contact support with
            your order link.
          </p>
        </div>
      </OrderShell>
    );
  }

  if (!raw) notFound();

  const parsed = orderConfirmationSchema.safeParse(raw);
  if (!parsed.success) notFound();
  const order = parsed.data;

  const status = STATUS_COPY[order.status];
  const payment = PAYMENT_COPY[order.paymentStatus];
  const eta = formatEta(order.etaAt, "Africa/Kampala");
  const terminal =
    order.status === "DELIVERED" ||
    order.status === "DELIVERY_FAILED" ||
    order.status === "CANCELLED";
  const awaitingDigitalPayment =
    order.paymentStatus === "PENDING" &&
    order.status === "PENDING_PAYMENT" &&
    order.paymentMethod !== "CASH_ON_DELIVERY";

  return (
    <OrderShell>
      <section className="flex flex-col gap-4 rounded-2xl border border-green-100 bg-surface p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="text-eyebrow uppercase text-orange-700">
              Order #{order.orderNumber}
            </p>
            <h1 className="text-2xl font-extrabold text-green-900">
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
                order.paymentStatus === "PAID" ? (
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
              {order.orderType === "DINE_IN" ? "Table" : "Delivering to"}
            </dt>
            <dd className="flex items-center gap-1.5 font-semibold text-green-900">
              {order.orderType === "DINE_IN" ? (
                <UtensilsCrossed aria-hidden="true" className="size-4" />
              ) : (
                <MapPin aria-hidden="true" className="size-4" />
              )}
              {order.orderType === "DINE_IN"
                ? `Table ${order.tableNumber ?? "—"}`
                : (order.deliveryArea ?? "Your delivery pin")}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-sm text-ink-secondary">Name</dt>
            <dd className="font-semibold text-green-900">
              {order.customerName}
            </dd>
          </div>
          {order.orderType === "DELIVERY" &&
          order.roadDistanceM != null ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-ink-secondary">Road distance</dt>
              <dd className="font-semibold text-green-900">
                {formatDistanceMetres(order.roadDistanceM)}
              </dd>
            </div>
          ) : null}
          {eta ? (
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-ink-secondary">Estimated arrival</dt>
              <dd className="font-semibold text-green-900">{eta} EAT</dd>
            </div>
          ) : null}
        </dl>

        {order.handoverPin ? (
          <div className="flex flex-col gap-1 rounded-xl border-2 border-green-800 bg-green-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-green-800">
              <ShieldCheck aria-hidden="true" className="size-4" />
              Handover PIN
            </p>
            <p className="tabular font-mono text-3xl font-extrabold tracking-[0.3em] text-green-900">
              {order.handoverPin}
            </p>
            <p className="text-sm text-ink-secondary">
              Give this PIN to the rider only when you receive your order.
            </p>
          </div>
        ) : null}

        {order.status === "CANCELLED" && order.cancellationReason ? (
          <p className="rounded-xl bg-status-dangerSurface p-3 text-sm font-semibold text-status-danger">
            Reason: {order.cancellationReason}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {!terminal ? <RefreshOrderButton /> : null}
          {awaitingDigitalPayment &&
          order.paymentMethod !== "CASH_ON_DELIVERY" ? (
            <PaymentRetryPanel
              orderToken={order.orderToken}
              method={order.paymentMethod}
            />
          ) : null}
        </div>
      </section>

      <section
        aria-labelledby="order-items"
        className="flex flex-col gap-3 rounded-2xl border border-green-100 bg-surface p-5 shadow-card"
      >
        <h2
          id="order-items"
          className="text-lg font-extrabold text-green-800"
        >
          Your order
        </h2>
        <ul className="flex flex-col divide-y divide-green-100">
          {order.items.map((item, index) => (
            <li
              key={`${item.name}-${index}`}
              className="flex flex-col gap-1 py-3 first:pt-0"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-green-900">
                  {item.quantity} × {item.name}
                </p>
                <p className="tabular shrink-0 font-mono text-sm font-semibold text-green-900">
                  {formatUGX(item.lineTotal)}
                </p>
              </div>
              {item.modifiers.length > 0 ? (
                <p className="text-sm text-ink-secondary">
                  {item.modifiers
                    .map(
                      (modifier) =>
                        `${modifier.name}${
                          modifier.priceDelta > 0
                            ? ` (+${formatUGX(modifier.priceDelta)})`
                            : ""
                        }`,
                    )
                    .join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>

        <dl className="flex flex-col gap-2 border-t border-green-100 pt-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-ink-secondary">Items and modifiers</dt>
            <dd className="tabular font-mono font-semibold text-green-900">
              {formatUGX(order.itemsSubtotal + order.modifiersTotal)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-ink-secondary">Packaging</dt>
            <dd className="tabular font-mono font-semibold text-green-900">
              {formatUGX(order.packagingFee)}
            </dd>
          </div>
          {order.orderType === "DELIVERY" ? (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-secondary">Delivery</dt>
              <dd className="tabular font-mono font-semibold text-green-900">
                {formatUGX(order.deliveryFee)}
              </dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-2 border-t border-green-100 pt-2">
            <dt className="text-base font-semibold text-green-900">Total</dt>
            <dd className="tabular font-mono text-xl font-extrabold text-green-900">
              {formatUGX(order.totalAmount)}
            </dd>
          </div>
          {order.paymentMethod === "CASH_ON_DELIVERY" &&
          order.codChangeDue != null &&
          order.codChangeDue > 0 ? (
            <div className="flex items-center justify-between gap-2">
              <dt className="text-ink-secondary">Change due</dt>
              <dd className="tabular font-mono font-semibold text-green-900">
                {formatUGX(order.codChangeDue)} from{" "}
                {formatUGX(order.codChangeRequestedFor ?? 0)}
              </dd>
            </div>
          ) : null}
        </dl>

        {order.paymentMethod === "CASH_ON_DELIVERY" &&
        order.orderType === "DELIVERY" ? (
          <p className="flex items-start gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-900">
            <Banknote aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Have {formatUGX(order.totalAmount)} ready for the rider.
          </p>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Link href="/" className={buttonClasses({ variant: "secondary" })}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to the menu
        </Link>
        <p className="text-sm text-ink-secondary">
          Keep this link. It is the only way to view this order.
        </p>
      </div>
    </OrderShell>
  );
}

function OrderShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-surface-inset">
      <header className="border-b border-green-100 bg-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex min-h-touch items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-green-800 underline underline-offset-4 hover:bg-green-50"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Bazaar Flame &amp; Grill
          </Link>
          <p className="text-eyebrow uppercase text-orange-700">Order tracker</p>
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6"
      >
        {children}
      </main>
    </div>
  );
}
