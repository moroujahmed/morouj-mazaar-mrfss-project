import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/storefront/site-footer";
import { TrackerLive } from "@/components/tracker/tracker-live";
import { buttonClasses } from "@/components/ui/button";
import { getOrderStore } from "@/lib/orders/store";
import { toTrackerSnapshot } from "@/lib/orders/tracker";
import { orderConfirmationSchema } from "@/lib/schemas/order";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your order",
  description: "Track your order status, payment, rider, and handover PIN.",
  robots: { index: false, follow: false },
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const snapshot = toTrackerSnapshot(order);

  return (
    <OrderShell>
      <input
        type="hidden"
        data-testid="order-token"
        value={order.orderToken}
        readOnly
      />
      <TrackerLive initial={snapshot} initialPin={order.handoverPin ?? null} />

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
    <div className="min-h-dvh bg-[#f4f7f5] text-green-950">
      <header className="sticky top-0 z-40 border-b border-green-100/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex min-h-touch items-center gap-2 rounded-xl px-2 text-sm font-semibold text-green-800 hover:bg-green-50"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <span className="text-lg font-extrabold tracking-tight text-green-950">Bazaar Flame &amp; Grill</span>
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">Order tracker</p>
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6"
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
