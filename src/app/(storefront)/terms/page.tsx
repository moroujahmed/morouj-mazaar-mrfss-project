import type { Metadata } from "next";

import { SiteFooter } from "@/components/storefront/site-footer";
import { SiteHeader } from "@/components/storefront/site-header";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms for using the Bazaar Flame & Grill ordering service.",
};

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-[#f4f7f5] text-green-950">
      <SiteHeader backHref="/" backLabel="Back to menu" eyebrow="Terms" />
      <main id="main-content" className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-green-950">Terms of Service</h1>
        <p className="mt-3 text-sm text-ink-secondary">Draft for founder/legal review before public launch. This page is not legal advice.</p>
        <div className="mt-8 space-y-6 text-sm leading-relaxed text-ink-secondary">
          <section><h2 className="text-lg font-bold text-green-900">Orders</h2><p className="mt-2">Orders are subject to availability, store hours, delivery radius, and confirmation. Prices are shown in Ugandan Shillings (USh) and confirmed at checkout.</p></section>
          <section><h2 className="text-lg font-bold text-green-900">Delivery and payment</h2><p className="mt-2">Delivery fees, minimum order values, and cash-on-delivery eligibility are calculated based on your delivery location and active store settings. Digital payments are confirmed before preparation where applicable.</p></section>
          <section><h2 className="text-lg font-bold text-green-900">Cancellations and refunds</h2><p className="mt-2">Cancellation and refund eligibility depends on order status and payment method. Approved digital refunds are processed through the original payment channel where possible.</p></section>
          <section><h2 className="text-lg font-bold text-green-900">Contact</h2><p className="mt-2">For order support, use the WhatsApp support channel listed on the website.</p></section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}