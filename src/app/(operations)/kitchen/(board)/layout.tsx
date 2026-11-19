import { requirePageRole } from "@/lib/auth/guards";
import { KitchenShell } from "@/components/kitchen/kitchen-shell";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export default async function KitchenBoardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requirePageRole(["KITCHEN", "ADMIN"], "/kitchen/login");

  return <KitchenShell profile={profile}>{children}</KitchenShell>;
}
