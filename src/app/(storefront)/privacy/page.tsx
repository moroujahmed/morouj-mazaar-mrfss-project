import type { Metadata } from "next";

import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Bazaar Flame & Grill handles personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-[#f4f7f5] text-green-950">
      <SiteHeader backHref="/" backLabel="Back to menu" eyebrow="Privacy" />
      <main id="main-content" className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-green-950">Privacy Policy</h1>
        <p className="mt-3 text-sm text-ink-secondary">Draft for founder/legal review before public launch. This page is not legal advice.</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-secondary">
          <section><h2 className="text-lg font-bold text-green-900">Information we collect</h2><p className="mt-2">When you place an order, we collect information needed to fulfill it: name, phone number, delivery address/pin, order items, payment status, and order notes you provide.</p></section>
          <section><h2 className="text-lg font-bold text-green-900">How we use information</h2><p className="mt-2">We use order information to prepare food, deliver orders, process payments, send transactional updates, prevent fraud, and reconcile cash/card payments.</p></section>
          <section><h2 className="text-lg font-bold text-green-900">Sharing</h2><p className="mt-2">We share only what is needed with service providers such as payment processors, SMS providers, maps/routing services, and hosting providers. Staff see only information required for their role.</p></section>
          <section><h2 className="text-lg font-bold text-green-900">Contact</h2><p className="mt-2">For privacy questions before launch, contact Bazaar Flame &amp; Grill through the official WhatsApp support channel listed on the website.</p></section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}