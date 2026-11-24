"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  BarChart3,
  ClipboardList,
  Package,
  Receipt,
  RefreshCw,
  ScrollText,
  Settings2,
  ShieldAlert,
  Table2,
  Users,
  UtensilsCrossed,
} from "lucide-react";

import { getAdminSnapshotAction } from "@/actions/admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { AdminSnapshot } from "@/lib/admin/types";

import { AdminAnalytics } from "./admin-analytics";
import { AdminAudit } from "./admin-audit";
import { AdminLedger } from "./admin-ledger";
import { AdminMenu } from "./admin-menu";
import { AdminOrders } from "./admin-orders";
import { AdminSettings } from "./admin-settings";
import { AdminStaff } from "./admin-staff";
import { AdminTables } from "./admin-tables";

export type AdminTabId =
  | "orders"
  | "menu"
  | "settings"
  | "ledger"
  | "analytics"
  | "audit"
  | "staff"
  | "tables";

const TABS: Array<{ id: AdminTabId; label: string; href: string; icon: typeof ClipboardList }> = [
  { id: "orders", label: "Orders", href: "/admin/orders", icon: ClipboardList },
  { id: "menu", label: "Menu", href: "/admin/menu", icon: UtensilsCrossed },
  { id: "settings", label: "Settings", href: "/admin/settings", icon: Settings2 },
  { id: "ledger", label: "Ledger", href: "/admin/ledger", icon: Receipt },
  { id: "analytics", label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { id: "audit", label: "Audit", href: "/admin/audit", icon: ScrollText },
  { id: "staff", label: "Staff", href: "/admin/staff", icon: Users },
  { id: "tables", label: "Tables", href: "/admin/tables", icon: Table2 },
];

const POLL_MS = 15_000;

export function AdminDashboard({
  initial,
  initialTab = "orders",
}: {
  initial: AdminSnapshot;
  initialTab?: AdminTabId;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const tab = initialTab;
  const [refreshing, startRefresh] = useTransition();
  const { showToast } = useToast();

  const refresh = useCallback(() => {
    startRefresh(async () => {
      const result = await getAdminSnapshotAction();
      if (result.ok) setSnapshot(result.data);
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const attention = useMemo(() => {
    const failed = snapshot.orders.filter((order) => order.status === "DELIVERY_FAILED").length;
    const refunds = snapshot.refunds.filter((refund) => refund.status === "REQUESTED").length;
    return { failed, refunds };
  }, [snapshot.orders, snapshot.refunds]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-green-800 sm:text-3xl">
            Operations hub
          </h1>
          <p className="text-sm text-ink-secondary">
            Live monitor, menu, settings, ledger, analytics, audit, staff, and tables.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {attention.failed > 0 ? (
            <Badge tone="danger" icon={<ShieldAlert className="size-4" />}>
              {attention.failed} failed
            </Badge>
          ) : null}
          {attention.refunds > 0 ? (
            <Badge tone="warning" icon={<Package className="size-4" />}>
              {attention.refunds} refund requests
            </Badge>
          ) : null}
          <Button
            variant="secondary"
            size="lg"
            isLoading={refreshing}
            onClick={refresh}
            leadingIcon={<RefreshCw aria-hidden="true" className="size-5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      <nav
        aria-label="Admin sections"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {TABS.map(({ id, label, href, icon: Icon }) => {
          const active = tab === id;
          return (
            <Link
              key={id}
              href={href}
              data-testid={`admin-tab-${id}`}
              aria-current={active ? "page" : undefined}
              className={[
                "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-green-800 focus-visible:ring-offset-2",
                active
                  ? "border-green-800 bg-green-800 text-white"
                  : "border-green-100 bg-surface text-green-800 hover:bg-green-50",
              ].join(" ")}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div data-testid="admin-panel">
        {tab === "orders" ? (
          <AdminOrders snapshot={snapshot} onMutated={refresh} onToast={showToast} />
        ) : null}
        {tab === "menu" ? <AdminMenu snapshot={snapshot} onMutated={refresh} onToast={showToast} /> : null}
        {tab === "settings" ? (
          <AdminSettings snapshot={snapshot} onMutated={refresh} onToast={showToast} />
        ) : null}
        {tab === "ledger" ? (
          <AdminLedger snapshot={snapshot} onMutated={refresh} onToast={showToast} />
        ) : null}
        {tab === "analytics" ? <AdminAnalytics snapshot={snapshot} /> : null}
        {tab === "audit" ? <AdminAudit snapshot={snapshot} /> : null}
        {tab === "staff" ? <AdminStaff snapshot={snapshot} onMutated={refresh} onToast={showToast} /> : null}
        {tab === "tables" ? <AdminTables snapshot={snapshot} onMutated={refresh} onToast={showToast} /> : null}
      </div>
    </div>
  );
}
