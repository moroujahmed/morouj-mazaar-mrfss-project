import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin/admin-shell";
import { requirePageRole } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requirePageRole(["ADMIN"], "/admin/login");
  return <AdminShell profile={profile}>{children}</AdminShell>;
}
