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
    <div className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-green-100/80 bg-white/90 p-3 shadow-[0_-8px_30px_rgba(16,46,39,0.08)] backdrop-blur-xl sm:p-4">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
        <button
          type="button"
          onClick={onOpen}
          aria-label={`View cart: ${itemCount} ${itemCount === 1 ? "item" : "items"}, subtotal ${formatUGX(subtotal)}`}
          className="flex min-h-primary flex-1 items-center justify-between gap-3 rounded-2xl bg-green-900 px-4 py-3 text-white transition-all hover:bg-green-950 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-orange-400 focus-visible:ring-offset-2 sm:px-5"
        >
          <span className="flex items-center gap-2 font-semibold">
            <span className="flex size-9 items-center justify-center rounded-xl bg-white/10">
              <ShoppingBag aria-hidden="true" className="size-5" />
            </span>
            <span>
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          </span>
          <span className="tabular font-mono text-base font-extrabold text-orange-300 sm:text-lg">
            {formatUGX(subtotal)}
          </span>
          <span className="rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-green-950">
            View cart
          </span>
        </button>
      </div>
    </div>
  );
}
