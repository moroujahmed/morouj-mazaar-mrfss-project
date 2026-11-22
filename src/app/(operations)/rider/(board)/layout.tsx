import type { ReactNode } from "react";

import { RiderShell } from "@/components/rider/rider-shell";
import { requirePageRole } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function RiderBoardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requirePageRole(["RIDER"], "/rider/login");

  return <RiderShell profile={profile}>{children}</RiderShell>;
}
