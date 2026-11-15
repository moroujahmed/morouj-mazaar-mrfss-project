"use client";

import { ShoppingBag } from "lucide-react";

import { formatUGX } from "@/lib/currency";
import { cartItemCount, cartSubtotal, type CartLine } from "@/lib/storefront/cart";

export type CartDockProps = {
  lines: readonly CartLine[];
  hydrated: boolean;
  onOpen: () => void;
};

/**
 * Sticky summary. It only renders after persistence hydration so the server
 * markup and the first client paint never disagree about the cart.
 */
export function CartDock({ lines, hydrated, onOpen }: CartDockProps) {
  if (!hydrated || lines.length === 0) return null;

  const itemCount = cartItemCount(lines);
  const subtotal = cartSubtotal(lines);

  return (
    <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-green-800/20 bg-surface/95 p-3 shadow-sheet backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`View cart: ${itemCount} ${itemCount === 1 ? "item" : "items"}, subtotal ${formatUGX(subtotal)}`}
          className="flex min-h-primary flex-1 items-center justify-between gap-3 rounded-xl bg-orange-500 px-4 text-green-900 transition-colors hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-green-900 focus-visible:ring-offset-2"
        >
          <span className="flex items-center gap-2 font-semibold">
            <ShoppingBag aria-hidden="true" className="size-5" />
            <span>
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          </span>
          <span className="tabular font-mono text-base font-extrabold">
            {formatUGX(subtotal)}
          </span>
          <span className="text-sm font-bold underline underline-offset-4">
            View cart
          </span>
        </button>
      </div>
    </div>
  );
}
