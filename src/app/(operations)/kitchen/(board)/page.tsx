import { ChefHat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { KitchenBoardClient } from "@/components/kitchen/kitchen-board";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { loadKitchenBoard } from "@/lib/kitchen/board";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kitchen board",
  description:
    "Oldest-first kitchen tickets, acceptance, bump, 86 toggles, busy mode, intake pause, and browser-print dockets.",
};

export default async function KitchenBoardPage() {
  try {
    const board = await loadKitchenBoard();
    return <KitchenBoardClient initialBoard={board} />;
  } catch {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <EmptyState
          icon={<ChefHat aria-hidden="true" className="size-6" />}
          title="The kitchen board is unavailable"
          description="The order queue could not be loaded. Check the connection and try again. Do not take orders by memory while this screen is down."
          action={
            <Link href="/kitchen" className={buttonClasses({ size: "lg" })}>
              Try again
            </Link>
          }
        />
      </div>
    );
  }
}
