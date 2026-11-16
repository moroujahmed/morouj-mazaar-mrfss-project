import type { Metadata } from "next";

import { MenuUnavailable } from "@/components/storefront/menu-unavailable";
import { Storefront } from "@/components/storefront/storefront";
import { getStorefrontMenu } from "@/lib/storefront/menu";
import { getTableByToken } from "@/lib/storefront/public-settings";
import { getStoreStatus } from "@/lib/storefront/store-status";

// Prices and availability change in the kitchen; never serve a cached menu.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order online",
  description:
    "Browse the Bazaar Flame & Grill menu, choose your sides and drinks, and build your cart for delivery, pickup, or dine-in.",
};

type StorefrontPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function StorefrontPage({
  searchParams,
}: StorefrontPageProps) {
  const params = await searchParams;
  const tableToken =
    typeof params.table === "string" ? params.table : undefined;

  const [result, table] = await Promise.all([
    getStorefrontMenu(),
    getTableByToken(tableToken),
  ]);

  if (result.status !== "ok") {
    return <MenuUnavailable />;
  }

  const storeStatus = getStoreStatus(
    result.menu.settings,
    // Browser tests pin a mid-service instant so opening hours never make the
    // storefront assertions flaky. Production always uses the real clock.
    process.env.STOREFRONT_FIXTURE === "1"
      ? new Date("2026-11-15T12:00:00+03:00")
      : new Date(),
  );

  return (
    <Storefront
      menu={result.menu}
      storeStatus={storeStatus}
      table={table}
      tableToken={tableToken ?? null}
    />
  );
}
