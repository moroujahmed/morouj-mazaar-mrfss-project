import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MockPaymentPanel } from "@/components/checkout/mock-payment";
import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";
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
      <SiteHeader backHref="/checkout" backLabel="Back to checkout" eyebrow="Test payment" />
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
