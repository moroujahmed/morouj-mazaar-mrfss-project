import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { MockPaymentPanel } from "@/components/checkout/mock-payment";
import { SiteFooter } from "@/components/storefront/site-footer";
import { paymentsFixtureMode } from "@/lib/payments/flutterwave";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Test payment",
  robots: { index: false, follow: false },
};

type MockPaymentPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MockPaymentPage({
  searchParams,
}: MockPaymentPageProps) {
  // The adapter exists only for automated tests and local development.
  if (!paymentsFixtureMode()) notFound();

  const params = await searchParams;
  const txRef = typeof params.tx_ref === "string" ? params.tx_ref.trim() : "";
  if (txRef.length < 3 || txRef.length > 120) notFound();

  return (
    <div className="min-h-dvh bg-[#f4f7f5] text-green-950">
      <header className="sticky top-0 z-40 border-b border-green-100/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex min-h-touch items-center gap-2 rounded-xl px-2 text-sm font-semibold text-green-800 hover:bg-green-50"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <span className="text-lg font-extrabold tracking-tight text-green-950">Bazaar Flame &amp; Grill</span>
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">Test payment</p>
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6"
      >
        <MockPaymentPanel txRef={txRef} />
      </main>
      <SiteFooter />
    </div>
  );
}
