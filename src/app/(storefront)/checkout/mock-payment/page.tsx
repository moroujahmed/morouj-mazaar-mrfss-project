import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { MockPaymentPanel } from "@/components/checkout/mock-payment";
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
    <div className="min-h-dvh bg-surface-inset">
      <header className="border-b border-green-100 bg-surface">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex min-h-touch items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-green-800 underline underline-offset-4 hover:bg-green-50"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Bazaar Flame &amp; Grill
          </Link>
          <p className="text-eyebrow uppercase text-orange-700">Checkout</p>
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6"
      >
        <MockPaymentPanel txRef={txRef} />
      </main>
    </div>
  );
}
