"use client";

import { useEffect, useRef } from "react";

import { useCart } from "@/hooks/use-cart";
import type {
  MenuSnapshotItem,
  ReconcileResult,
} from "@/lib/storefront/cart";

/**
 * Explicitly rehydrate the persisted cart, mark it hydrated, and reconcile it
 * against the freshly server-rendered menu. Runs once per mounted cart surface.
 */
export function useCartHydration(
  items: readonly MenuSnapshotItem[],
  onReconciled?: (result: ReconcileResult) => void,
): boolean {
  const hydrated = useCart((state) => state.hydrated);
  const started = useRef(false);
  const callbackRef = useRef(onReconciled);
  callbackRef.current = onReconciled;

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Do not cancel this promise on StrictMode's double effect run: the first
    // run owns hydration and must still finish.
    Promise.resolve(useCart.persist.rehydrate()).finally(() => {
      useCart.getState().markHydrated();
      const result = useCart.getState().reconcile(items);
      callbackRef.current?.(result);
    });
  }, [items]);

  return hydrated;
}
