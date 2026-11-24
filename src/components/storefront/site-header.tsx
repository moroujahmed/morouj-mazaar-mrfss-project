import { ArrowLeft, Flame } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

type SiteHeaderProps = {
  backHref?: string;
  backLabel?: string;
  eyebrow?: string;
  rightSlot?: ReactNode;
};

export function SiteHeader({
  backHref = "/",
  backLabel = "Back to menu",
  eyebrow,
  rightSlot,
}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-green-100/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex min-h-touch items-center gap-2 rounded-xl px-2 text-sm font-semibold text-green-800 hover:bg-green-50"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            <span className="sr-only">{backLabel}</span>
          </Link>
          <Link href="/" className="flex items-center gap-2 rounded-xl px-1 hover:opacity-90">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-green-800 text-white shadow-[0_8px_20px_rgba(23,63,53,0.22)]">
              <Flame aria-hidden="true" className="size-5" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-extrabold tracking-tight text-green-950 sm:text-lg">
                Bazaar Flame &amp; Grill
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-700">
                Morouj Mazaar
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {eyebrow ? (
            <p className="hidden text-xs font-bold uppercase tracking-[0.2em] text-orange-700 sm:block">
              {eyebrow}
            </p>
          ) : null}
          {rightSlot}
        </div>
      </div>
    </header>
  );
}