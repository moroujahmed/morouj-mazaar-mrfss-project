import { Bike } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import type { StaffProfile } from "@/lib/auth/session";

export function RiderShell({
  profile,
  children,
}: {
  profile: StaffProfile;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-green-800 text-white">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex size-11 items-center justify-center rounded-xl bg-white/10 text-orange-500"
            >
              <Bike className="size-6" />
            </span>
            <div>
              <Link
                href="/rider"
                className="font-display text-lg font-bold text-white underline-offset-4 hover:underline"
              >
                Bazaar Flame &amp; Grill
              </Link>
              <p className="text-sm text-white/80">Rider portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold">{profile.full_name}</p>
              <p className="text-xs uppercase tracking-wide text-white/75">
                {profile.motorcycle_plate ?? "No plate on file"}
              </p>
            </div>
            <LogoutButton redirectTo="/rider/login" />
          </div>
        </div>
      </header>

      <main id="main-content" className="flex-1">
        {children}
      </main>
    </div>
  );
}
