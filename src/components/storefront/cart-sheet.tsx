"use client";

import {
  AlertTriangle,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useCart } from "@/hooks/use-cart";
import { formatUGX } from "@/lib/currency";
import {
  cartItemCount,
  cartSubtotal,
  lineTotal,
  type CartAddError,
  type CartLimits,
  type CartLine,
} from "@/lib/storefront/cart";

import { DishImage } from "./dish-image";

export type CartSheetProps = {
  open: boolean;
  onClose: () => void;
  limits: CartLimits;
  orderingEnabled: boolean;
  kitchenPaused: boolean;
  onCheckout: () => void;
};

function failureMessage(code: CartAddError, limits: CartLimits): string {
  switch (code) {
    case "CART_LINE_LIMIT":
      return `Your cart can hold at most ${limits.maxLines} different lines.`;
    case "ITEM_QUANTITY_LIMIT":
      return `You can order at most ${limits.maxItemQuantity} of one item.`;
    case "CART_VALUE_LIMIT":
      return `Your cart cannot exceed ${formatUGX(limits.maxCartValue)}.`;
  }
}

function lineDetails(line: CartLine): string {
  return [
    ...line.comboSelections.map((selection) => selection.name),
    ...line.modifiers.map((modifier) => modifier.name),
  ].join(" · ");
}

export function CartSheet({
  open,
  onClose,
  limits,
  orderingEnabled,
  kitchenPaused,
  onCheckout,
}: CartSheetProps) {
  const lines = useCart((state) => state.lines);
  const updateQuantity = useCart((state) => state.updateQuantity);
  const removeLine = useCart((state) => state.removeLine);
  const clear = useCart((state) => state.clear);
  const { showToast } = useToast();

  const subtotal = cartSubtotal(lines);
  const itemCount = cartItemCount(lines);
  const unavailable = lines.filter((line) => line.unavailable).length;

  const blockedReason = !orderingEnabled
    ? "Ordering is closed. Your cart is saved for later."
    : kitchenPaused
      ? "The kitchen is paused. Checkout is disabled until it resumes."
      : unavailable > 0
        ? "Remove the sold-out items before continuing."
        : null;

  function changeQuantity(line: CartLine, delta: number) {
    const result = updateQuantity(line.key, line.quantity + delta, limits);
    if (!result.ok && result.code !== "LINE_NOT_FOUND") {
      if (result.code === "INVALID_QUANTITY") {
        removeLine(line.key);
        return;
      }
      showToast({
        title: "Cart limit reached",
        description: failureMessage(result.code, limits),
        tone: "error",
      });
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Your cart"
      description={
        itemCount > 0
          ? `${itemCount} ${itemCount === 1 ? "item" : "items"} ready for checkout.`
          : undefined
      }
      footer={
        lines.length > 0 ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4 border-t border-green-100 pt-3">
              <span className="text-base font-semibold text-green-900">
                Subtotal
              </span>
              <span
                id="cart-subtotal"
                aria-live="polite"
                className="tabular font-mono text-xl font-extrabold text-green-900"
              >
                {formatUGX(subtotal)}
              </span>
            </div>
            <p className="text-sm text-ink-secondary">
              Delivery and packaging are calculated at checkout. The subtotal
              includes items and modifiers only.
            </p>

            {blockedReason ? (
              <p
                role="status"
                className="flex items-start gap-2 rounded-xl bg-status-warningSurface p-3 text-sm font-semibold text-status-warning"
              >
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                {blockedReason}
              </p>
            ) : null}

            <Button
              size="xl"
              fullWidth
              disabled={Boolean(blockedReason)}
              onClick={onCheckout}
            >
              Continue to checkout
            </Button>
            <Button variant="ghost" fullWidth onClick={clear}>
              Clear cart
            </Button>
          </div>
        ) : null
      }
    >
      {lines.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="size-7" />}
          title="Your cart is empty"
          description="Add a dish from the menu and it will appear here."
          action={
            <Button variant="secondary" onClick={onClose}>
              Browse the menu
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col divide-y divide-green-100">
          {lines.map((line) => (
            <li key={line.key} className="flex gap-3 py-4 first:pt-0">
              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl border border-green-100">
                <DishImage src={line.imageUrl} sizes="64px" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-green-900">
                      {line.name}
                    </p>
                    {lineDetails(line) ? (
                      <p className="mt-0.5 text-sm text-ink-secondary">
                        {lineDetails(line)}
                      </p>
                    ) : null}
                    {line.unavailable ? (
                      <span className="mt-1 inline-flex">
                        <Badge
                          tone="danger"
                          icon={<AlertTriangle className="size-4" />}
                        >
                          Sold out — remove to continue
                        </Badge>
                      </span>
                    ) : null}
                  </div>
                  <p className="tabular shrink-0 font-mono text-base font-semibold text-green-900">
                    {formatUGX(lineTotal(line))}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Decrease quantity of ${line.name}`}
                      onClick={() => changeQuantity(line, -1)}
                      disabled={line.quantity <= 1 || line.unavailable}
                      className="inline-flex size-11 items-center justify-center rounded-lg border-2 border-green-800 text-green-800 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Minus aria-hidden="true" className="size-4" />
                    </button>
                    <span className="tabular min-w-7 text-center font-mono text-base font-semibold text-green-900">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label={`Increase quantity of ${line.name}`}
                      onClick={() => changeQuantity(line, 1)}
                      disabled={
                        line.quantity >= limits.maxItemQuantity ||
                        line.unavailable
                      }
                      className="inline-flex size-11 items-center justify-center rounded-lg border-2 border-green-800 text-green-800 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    aria-label={`Remove ${line.name} from cart`}
                    className="inline-flex min-h-touch items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-status-danger hover:bg-status-dangerSurface"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
