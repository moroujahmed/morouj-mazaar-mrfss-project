import type { Metadata } from "next";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getAdminStore } from "@/lib/admin/store";

export const metadata: Metadata = {
  title: "Admin hub",
  description: "Orders, menu, settings, ledger, analytics, audit and staff.",
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const snapshot = await getAdminStore().snapshot();
  return <AdminDashboard initial={snapshot} />;
}
