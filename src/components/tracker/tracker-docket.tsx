import { Banknote } from "lucide-react";

import { formatUGX } from "@/lib/currency";
import type { TrackerSnapshot } from "@/lib/orders/tracker";

export function TrackerDocket({ snapshot }: { snapshot: TrackerSnapshot }) {
  return (
    <section
      aria-labelledby="order-items"
      className="flex flex-col gap-3 rounded-2xl border border-green-100 bg-surface p-5 shadow-card"
    >
      <h2 id="order-items" className="text-lg font-extrabold text-green-800">
        Your order
      </h2>
      <ul className="flex flex-col divide-y divide-green-100">
        {snapshot.items.map((item, index) => (
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
            {formatUGX(snapshot.itemsSubtotal + snapshot.modifiersTotal)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-ink-secondary">Packaging</dt>
          <dd className="tabular font-mono font-semibold text-green-900">
            {formatUGX(snapshot.packagingFee)}
          </dd>
        </div>
        {snapshot.orderType === "DELIVERY" ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-ink-secondary">Delivery</dt>
            <dd className="tabular font-mono font-semibold text-green-900">
              {formatUGX(snapshot.deliveryFee)}
            </dd>
          </div>
        ) : null}
        <div className="flex items-center justify-between gap-2 border-t border-green-100 pt-2">
          <dt className="text-base font-semibold text-green-900">Total</dt>
          <dd className="tabular font-mono text-xl font-extrabold text-green-900">
            {formatUGX(snapshot.totalAmount)}
          </dd>
        </div>
        {snapshot.paymentMethod === "CASH_ON_DELIVERY" &&
        snapshot.codChangeDue != null &&
        snapshot.codChangeDue > 0 ? (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-ink-secondary">Change due</dt>
            <dd className="tabular font-mono font-semibold text-green-900">
              {formatUGX(snapshot.codChangeDue)} from{" "}
              {formatUGX(snapshot.codChangeRequestedFor ?? 0)}
            </dd>
          </div>
        ) : null}
      </dl>

      {snapshot.paymentMethod === "CASH_ON_DELIVERY" &&
      snapshot.orderType === "DELIVERY" &&
      snapshot.status !== "DELIVERED" ? (
        <p className="flex items-start gap-2 rounded-xl bg-green-50 p-3 text-sm text-green-900">
          <Banknote aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Have {formatUGX(snapshot.totalAmount)} ready for the rider.
        </p>
      ) : null}
    </section>
  );
}
