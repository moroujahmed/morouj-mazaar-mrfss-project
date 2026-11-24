import type { Metadata } from "next";

import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { getAdminStore } from "@/lib/admin/store";

export const metadata: Metadata = { title: "Staff | Admin" };
export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const snapshot = await getAdminStore().snapshot();
  return <AdminDashboard initial={snapshot} initialTab="staff" />;
}