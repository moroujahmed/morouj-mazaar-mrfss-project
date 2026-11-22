import type { Metadata } from "next";

import { StaffLoginForm } from "@/components/auth/staff-login-form";

export const metadata: Metadata = {
  title: "Admin sign-in",
  description: "Sign in to the Bazaar Flame & Grill admin hub.",
};

export default function AdminLoginPage() {
  return (
    <main
      id="main-content"
      className="flex min-h-dvh flex-col items-center justify-center gap-6 px-4 py-10"
    >
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-700">
          Morouj Mazaar
        </p>
        <p className="font-display text-xl font-bold text-green-800">
          Bazaar Flame &amp; Grill
        </p>
      </div>
      <StaffLoginForm portal="admin" />
    </main>
  );
}
