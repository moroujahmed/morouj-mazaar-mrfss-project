import type { Metadata } from "next";

import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";

export const metadata: Metadata = {
  title: "Hygiene & Safety",
  description: "Food hygiene and safety information for Bazaar Flame & Grill.",
};

export default function HygienePage() {
  return (
    <div className="min-h-dvh bg-[#f4f7f5] text-green-950">
      <SiteHeader backHref="/" backLabel="Back to menu" eyebrow="Hygiene & Safety" />
      <main id="main-content" className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-green-950">Hygiene &amp; Safety</h1>
        <p className="mt-3 text-sm text-ink-secondary">Operational information for customers. Final compliance claims and certifications should be verified by the founders before public launch.</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-secondary">
          <section><h2 className="text-lg font-bold text-green-900">Food handling</h2><p className="mt-2">Orders are prepared for delivery, pickup, or dine-in with attention to clean handling, proper packaging, and order separation.</p></section>
          <section><h2 className="text-lg font-bold text-green-900">Delivery handover</h2><p className="mt-2">Delivery orders use a handover confirmation flow. Customers should check packaging/tamper evidence before completing handover.</p></section>
          <section><h2 className="text-lg font-bold text-green-900">Allergens and special requests</h2><p className="mt-2">If you have allergies or dietary requirements, contact support before ordering. Menu descriptions are provided for guidance and may not cover every ingredient or cross-contact risk.</p></section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}