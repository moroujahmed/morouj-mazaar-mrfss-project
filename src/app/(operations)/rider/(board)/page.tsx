import { Bike } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { RiderDashboard } from "@/components/rider/rider-dashboard";
import { buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePageRole } from "@/lib/auth/guards";
import { loadRiderSnapshot } from "@/lib/rider/snapshot";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rider portal",
  description:
    "Claim deliveries, start trips, share foreground location, verify the handover PIN, and review your cash summary.",
};

export default async function RiderPage() {
  const profile = await requirePageRole(["RIDER"], "/rider/login");

  try {
    const snapshot = await loadRiderSnapshot(profile.id);
    return (
      <RiderDashboard
        initialSnapshot={snapshot}
        riderName={profile.full_name}
      />
    );
  } catch {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <EmptyState
          icon={<Bike aria-hidden="true" className="size-6" />}
          title="The rider portal is unavailable"
          description="Your deliveries could not be loaded. Check the connection and try again. Do not complete a handover without verifying the PIN online."
          action={
            <Link href="/rider" className={buttonClasses({ size: "xl" })}>
              Try again
            </Link>
          }
        />
      </div>
    );
  }
}
