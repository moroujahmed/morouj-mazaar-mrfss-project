"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import {
  addLineWithLimits,
  cartSubtotal,
  reconcileCartLines,
  type CartAddError,
  type CartLimits,
  type CartLine,
  type MenuSnapshotItem,
  type ReconcileResult,
} from "@/lib/storefront/cart";

export type CartFailureCode =
  | CartAddError
  | "LINE_NOT_FOUND"
  | "INVALID_QUANTITY";

export type CartActionResult =
  | { ok: true }
  | { ok: false; code: CartFailureCode };

export type CartAddResult =
  | { ok: true }
  | { ok: false; code: CartAddError };

type CartState = {
  lines: CartLine[];
  /**
   * False until the persisted payload has been read on the client. UI must
   * not show a subtotal before this flips: the server render has no storage.
   */
  hydrated: boolean;
  markHydrated: () => void;
  addLine: (candidate: CartLine, limits: CartLimits) => CartAddResult;
  updateQuantity: (
    key: string,
    quantity: number,
    limits: CartLimits,
  ) => CartActionResult;
  removeLine: (key: string) => void;
  clear: () => void;
  reconcile: (items: readonly MenuSnapshotItem[]) => ReconcileResult;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      hydrated: false,
      markHydrated: () => set({ hydrated: true }),

      addLine: (candidate, limits) => {
        const result = addLineWithLimits(get().lines, candidate, limits);
        if (!result.ok) return { ok: false, code: result.code };
        set({ lines: result.lines });
        return { ok: true };
      },

      updateQuantity: (key, quantity, limits) => {
        const { lines } = get();
        const existing = lines.find((line) => line.key === key);
        if (!existing) return { ok: false, code: "LINE_NOT_FOUND" };

        if (!Number.isInteger(quantity) || quantity < 1) {
          return { ok: false, code: "INVALID_QUANTITY" };
        }
        if (quantity > limits.maxItemQuantity) {
          return { ok: false, code: "ITEM_QUANTITY_LIMIT" };
        }

        const nextLines = lines.map((line) =>
          line.key === key ? { ...line, quantity } : line,
        );

        if (cartSubtotal(nextLines) > limits.maxCartValue) {
          return { ok: false, code: "CART_VALUE_LIMIT" };
        }

        set({ lines: nextLines });
        return { ok: true };
      },

      removeLine: (key) =>
        set({ lines: get().lines.filter((line) => line.key !== key) }),

      clear: () => set({ lines: [] }),

      reconcile: (items) => {
        // Availability must come from the fresh server menu. Reprice and flag
        // stale lines rather than trusting the persisted snapshot.
        const { lines, result } = reconcileCartLines(get().lines, items);
        set({ lines });
        return result;
      },
    }),
    {
      name: "mrfss-cart-v1",
      version: 1,
      // The server render has no localStorage; hydrate explicitly in a client
      // effect so markup stays deterministic.
      skipHydration: true,
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);
