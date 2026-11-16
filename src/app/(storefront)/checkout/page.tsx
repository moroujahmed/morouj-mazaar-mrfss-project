import type { Metadata } from "next";

import { CheckoutClient } from "@/components/checkout/checkout-client";
import { MenuUnavailable } from "@/components/storefront/menu-unavailable";
import { getStorefrontMenu } from "@/lib/storefront/menu";
import { getTableByToken } from "@/lib/storefront/public-settings";
import { getStoreStatus } from "@/lib/storefront/store-status";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  description:
    "Choose your delivery pin, review the road distance and delivery fee, and complete your order.",
};

type CheckoutPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CheckoutPage({
  searchParams,
}: CheckoutPageProps) {
  const params = await searchParams;
  const tableToken =
    typeof params.table === "string" ? params.table : undefined;

  const [menuResult, table] = await Promise.all([
    getStorefrontMenu(),
    getTableByToken(tableToken),
  ]);

  if (menuResult.status !== "ok") {
    return <MenuUnavailable />;
  }

  const storeStatus = getStoreStatus(
    menuResult.menu.settings,
    // Browser tests pin a mid-service instant so opening hours never make the
    // checkout assertions flaky. Production always uses the real clock.
    process.env.STOREFRONT_FIXTURE === "1"
      ? new Date("2026-11-15T12:00:00+03:00")
      : new Date(),
  );

  return (
    <CheckoutClient
      menu={menuResult.menu}
      storeStatus={storeStatus}
      table={table}
      tableToken={tableToken ?? null}
    />
  );
}
