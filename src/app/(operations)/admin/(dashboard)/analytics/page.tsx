import type { Metadata } from "next";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getAdminStore } from "@/lib/admin/store";

export const metadata: Metadata = { title: "Analytics | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const snapshot = await getAdminStore().snapshot();
  return <AdminDashboard initial={snapshot} initialTab="analytics" />;
}