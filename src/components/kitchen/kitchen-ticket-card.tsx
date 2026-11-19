"use client";

import {
  AlertTriangle,
  Banknote,
  Check,
  Clock,
  CreditCard,
  Printer,
  Utensils,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatUGX } from "@/lib/currency";
import type { KitchenTicket } from "@/lib/kitchen/types";
import { cn } from "@/lib/utils";

export const LATE_AFTER_MINUTES = 15;

const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Africa/Kampala",
  hour: "2-digit",
  minute: "2-digit",
});

export type TicketAction = "accept" | "bump" | null;

function statusCopy(ticket: KitchenTicket): string {
  switch (ticket.status) {
    case "CONFIRMED_UNPAID":
      return "New — waiting for the kitchen to accept";
    case "PREPARING":
      return "Preparing";
    case "READY_FOR_PICKUP":
      return "Ready — waiting for a rider";
  }
}

function ageCopy(ticket: KitchenTicket, now: number | null): string {
  const placed = new Date(ticket.createdAt).getTime();
  if (Number.isNaN(placed)) return "Placed time unavailable";
  if (now === null) return `Placed ${clock.format(new Date(placed))}`;

  const minutes = Math.max(0, Math.floor((now - placed) / 60_000));
  if (minutes > LATE_AFTER_MINUTES) {
    return `Late by ${minutes - LATE_AFTER_MINUTES} min`;
  }
  if (minutes < 1) return "Placed just now";
  if (minutes === 1) return "Placed 1 min ago";
  return `Placed ${minutes} min ago`;
}

export function KitchenTicketCard({
  ticket,
  now,
  pending,
  busy,
  onAccept,
  onBump,
  onPrint,
}: {
  ticket: KitchenTicket;
  now: number | null;
  pending: TicketAction;
  busy: boolean;
  onAccept: (ticket: KitchenTicket) => void;
  onBump: (ticket: KitchenTicket) => void;
  onPrint: (ticket: KitchenTicket) => void;
}) {
  const placed = new Date(ticket.createdAt).getTime();
  const late =
    now !== null &&
    !Number.isNaN(placed) &&
    now - placed > LATE_AFTER_MINUTES * 60_000 &&
    ticket.status !== "READY_FOR_PICKUP";

  const typeLabel =
    ticket.orderType === "DINE_IN"
      ? ticket.tableNumber
        ? `Dine-in · Table ${ticket.tableNumber}`
        : "Dine-in"
      : "Delivery";

  const headingId = `ticket-${ticket.orderId}`;

  return (
    <article
      aria-labelledby={headingId}
      className={cn(
        "flex flex-col gap-3 rounded-2xl border bg-surface p-4 shadow-card",
        late ? "border-status-danger" : "border-green-100",
      )}
      data-testid={`kitchen-ticket-${ticket.orderNumber}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={headingId} className="text-xl font-extrabold text-green-800">
            Order #{ticket.orderNumber}
          </h2>
          <p className="text-sm text-ink-secondary">
            {ticket.customerName} · {typeLabel}
          </p>
        </div>
        <Badge
          tone={ticket.status === "CONFIRMED_UNPAID" ? "warning" : "brand"}
          icon={
            ticket.status === "CONFIRMED_UNPAID" ? (
              <Clock className="size-4" />
            ) : (
              <Check className="size-4" />
            )
          }
        >
          {statusCopy(ticket)}
        </Badge>
      </div>

      <p
        className={cn(
          "flex items-center gap-1.5 text-sm font-semibold",
          late ? "text-status-danger" : "text-ink-secondary",
        )}
      >
        {late ? <AlertTriangle aria-hidden="true" className="size-4" /> : null}
        <span>{ageCopy(ticket, now)}</span>
      </p>

      <ul className="flex flex-col gap-2 border-y border-green-50 py-3">
        {ticket.items.map((item, index) => (
          <li key={`${ticket.orderId}-item-${index}`}>
            <p className="font-semibold text-green-900">
              <span className="tabular">{item.quantity}×</span> {item.name}
            </p>
            {item.modifiers.length > 0 ? (
              <ul className="mt-0.5 flex flex-col gap-0.5 pl-5 text-sm text-ink-secondary">
                {item.modifiers.map((modifier, modifierIndex) => (
                  <li key={`${index}-modifier-${modifierIndex}`}>
                    – {modifier.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>

      {ticket.customerNotes ? (
        <p className="flex items-start gap-2 rounded-xl bg-status-warningSurface p-3 text-sm text-status-warning">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-semibold">Note:</span> {ticket.customerNotes}
          </span>
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Badge
          tone={ticket.paymentStatus === "PAID" ? "success" : "warning"}
          icon={
            ticket.paymentMethod === "CASH_ON_DELIVERY" ? (
              <Banknote className="size-4" />
            ) : (
              <CreditCard className="size-4" />
            )
          }
        >
          {ticket.paymentStatus === "PAID"
            ? "Paid"
            : ticket.paymentMethod === "CASH_ON_DELIVERY"
              ? "Cash on delivery"
              : "Payment pending"}
        </Badge>
        <span className="font-bold text-green-900">
          {formatUGX(ticket.totalAmount)}
        </span>
      </div>

      {ticket.paymentMethod === "CASH_ON_DELIVERY" &&
      ticket.codChangeDue != null &&
      ticket.codChangeDue > 0 ? (
        <p className="text-sm text-ink-secondary">
          Change due: <span className="font-semibold">{formatUGX(ticket.codChangeDue)}</span>
        </p>
      ) : null}

      <div className="mt-1 flex flex-wrap gap-2">
        {ticket.status === "CONFIRMED_UNPAID" ? (
          <Button
            size="lg"
            onClick={() => onAccept(ticket)}
            isLoading={pending === "accept"}
            disabled={busy}
            leadingIcon={<Utensils aria-hidden="true" className="size-5" />}
          >
            {`Accept order #${ticket.orderNumber}`}
          </Button>
        ) : null}

        {ticket.status === "PREPARING" ? (
          <Button
            size="lg"
            onClick={() => onBump(ticket)}
            isLoading={pending === "bump"}
            disabled={busy}
            leadingIcon={<Check aria-hidden="true" className="size-5" />}
          >
            {ticket.orderType === "DINE_IN"
              ? `Mark order #${ticket.orderNumber} served`
              : `Bump order #${ticket.orderNumber} to ready`}
          </Button>
        ) : null}

        <Button
          size="lg"
          variant="secondary"
          onClick={() => onPrint(ticket)}
          leadingIcon={<Printer aria-hidden="true" className="size-5" />}
        >
          {`Print docket for order #${ticket.orderNumber}`}
        </Button>
      </div>
    </article>
  );
}
