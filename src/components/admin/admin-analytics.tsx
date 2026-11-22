"use client";

import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatUGX } from "@/lib/currency";
import type { AdminSnapshot } from "@/lib/admin/types";

export function AdminAnalytics({ snapshot }: { snapshot: AdminSnapshot }) {
  const a = snapshot.analytics;
  const cards = [
    { label: "Orders", value: String(a.orders) },
    { label: "Delivered", value: String(a.deliveredOrders) },
    { label: "Cancelled", value: String(a.cancelledOrders) },
    { label: "Gross revenue", value: formatUGX(a.grossRevenue) },
    { label: "COD collected", value: formatUGX(a.codCollected) },
    { label: "Digital collected", value: formatUGX(a.digitalCollected) },
    { label: "Average order", value: formatUGX(a.averageOrderValue) },
    { label: "Avg prep (min)", value: String(a.averagePrepMinutes) },
    { label: "Avg delivery (min)", value: String(a.averageDeliveryMinutes) },
  ];

  return (
    <section aria-labelledby="admin-analytics-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="admin-analytics-heading" className="text-lg font-extrabold text-green-800">
          Analytics
        </h2>
        <p className="text-sm text-ink-secondary">
          EAT business dates {a.from} to {a.to}.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-green-100 bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-ink-secondary">{card.label}</p>
            <p className="mt-1 text-xl font-extrabold text-green-800" data-testid={`admin-stat-${card.label}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-green-100 bg-surface p-4">
        <h3 className="mb-3 font-semibold text-green-900">Top items</h3>
        {a.topItems.length === 0 ? (
          <EmptyState title="No delivered items yet" description="Top items appear after the first delivery." />
        ) : (
          <ul className="flex flex-wrap gap-2">
            {a.topItems.map((item) => (
              <li key={item.name}>
                <Badge tone="brand">{item.name} · {item.quantity}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
