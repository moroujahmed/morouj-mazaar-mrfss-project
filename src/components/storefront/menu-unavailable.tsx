import Link from "next/link";
import { RefreshCw, UtensilsCrossed } from "lucide-react";

import { buttonClasses } from "@/components/ui/button";

/**
 * Fail-closed storefront state. It is rendered when settings or menu data
 * cannot be read, so the customer never sees invented prices or availability.
 */
export function MenuUnavailable() {
  return (
    <div className="min-h-dvh bg-surface-inset">
      <header className="border-b border-green-100 bg-surface">
        <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6">
          <p className="text-eyebrow uppercase text-orange-700">
            Morouj Mazaar · Food Court
          </p>
          <h1 className="text-3xl font-extrabold text-green-800">
            Bazaar Flame &amp; Grill
          </h1>
        </div>
      </header>
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6"
      >
        <span
          aria-hidden="true"
          className="inline-flex size-16 items-center justify-center rounded-2xl bg-green-50 text-green-800"
        >
          <UtensilsCrossed className="size-8" />
        </span>
        <h2 className="text-2xl font-extrabold text-green-800">
          The menu is temporarily unavailable
        </h2>
        <p className="max-w-md text-base text-ink-secondary">
          We cannot load current prices and availability right now. Please try
          again in a moment. No order has been placed.
        </p>
        <Link href="/" className={buttonClasses({ size: "lg" })}>
          <RefreshCw aria-hidden="true" className="size-5" />
          Try again
        </Link>
        <p className="text-sm text-ink-secondary">
          Still stuck? Message us on WhatsApp at +256 700 000 000.
        </p>
      </main>
    </div>
  );
}
