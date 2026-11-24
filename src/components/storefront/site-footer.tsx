import { Clock, Flame, MapPin, MessageCircle, Phone } from "lucide-react";
import Link from "next/link";

const supportWhatsapp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "+256700000000";
const whatsappHref = `https://wa.me/${supportWhatsapp.replace(/\D/g, "")}`;

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-green-100 bg-[#eef4f1] text-green-950">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-green-800 text-white shadow-[0_8px_20px_rgba(23,63,53,0.22)]">
                <Flame aria-hidden="true" className="size-5" />
              </div>
              <div>
                <p className="text-lg font-extrabold leading-none tracking-tight text-green-950">
                  Bazaar Flame &amp; Grill
                </p>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">
                  Morouj Mazaar
                </p>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-ink-secondary">
              Charcoal grills, traditional luwombo, and Kampala street classics,
              cooked to order for delivery, pickup, or dine-in.
            </p>
            <div className="flex items-center gap-2 text-sm font-medium text-green-800">
              <Clock aria-hidden="true" className="size-4 text-orange-600" />
              Open daily 10:00–22:00 EAT
            </div>
          </div>

          <div>
            <p className="mb-4 text-sm font-extrabold uppercase tracking-[0.16em] text-green-900">
              Menu
            </p>
            <ul className="space-y-2 text-sm text-ink-secondary">
              <li><Link href="/#menu-heading" className="hover:text-green-800 hover:underline underline-offset-4">Charcoal grills</Link></li>
              <li><Link href="/#menu-heading" className="hover:text-green-800 hover:underline underline-offset-4">Combos</Link></li>
              <li><Link href="/#menu-heading" className="hover:text-green-800 hover:underline underline-offset-4">Traditional luwombo</Link></li>
              <li><Link href="/#menu-heading" className="hover:text-green-800 hover:underline underline-offset-4">Rolex corner</Link></li>
              <li><Link href="/#menu-heading" className="hover:text-green-800 hover:underline underline-offset-4">Drinks</Link></li>
            </ul>
          </div>

          <div>
            <p className="mb-4 text-sm font-extrabold uppercase tracking-[0.16em] text-green-900">
              Service
            </p>
            <ul className="space-y-2 text-sm text-ink-secondary">
              <li><Link href="/" className="hover:text-green-800 hover:underline underline-offset-4">Browse menu</Link></li>
              <li><Link href="/checkout" className="hover:text-green-800 hover:underline underline-offset-4">Checkout</Link></li>
              <li>
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-green-800 hover:underline underline-offset-4">
                  <MessageCircle aria-hidden="true" className="size-4" />
                  Order help on WhatsApp
                </a>
              </li>
            </ul>
            <p className="mt-5 mb-2 text-xs font-bold uppercase tracking-[0.14em] text-green-900">Staff portals</p>
            <ul className="space-y-2 text-sm text-ink-secondary">
              <li><Link href="/kitchen/login" className="hover:text-green-800 hover:underline underline-offset-4">Kitchen staff</Link></li>
              <li><Link href="/rider/login" className="hover:text-green-800 hover:underline underline-offset-4">Delivery staff</Link></li>
              <li><Link href="/admin/login" className="hover:text-green-800 hover:underline underline-offset-4">Manager / Admin</Link></li>
            </ul>
          </div>

          <div>
            <p className="mb-4 text-sm font-extrabold uppercase tracking-[0.16em] text-green-900">
              Find us
            </p>
            <div className="space-y-3 text-sm text-ink-secondary">
              <p className="flex items-start gap-2">
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-green-700" />
                <span>Plot 14 Lumumba Avenue, Nakasero Hill, Kampala, Uganda</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone aria-hidden="true" className="size-4 shrink-0 text-green-700" />
                <a href={whatsappHref} target="_blank" rel="noreferrer" className="font-semibold text-green-800 hover:underline underline-offset-4">
                  {supportWhatsapp}
                </a>
              </p>
              <p>Delivery within 15.0 km. Cash on delivery up to 8.1 km.</p>
              <p>Free delivery within 5.0 km. Minimum delivery order USh 20,000.</p>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-green-200/70 pt-6 text-sm text-ink-secondary sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Bazaar Flame &amp; Grill Ltd. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-green-800 hover:underline underline-offset-4">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-green-800 hover:underline underline-offset-4">Terms of Service</Link>
            <Link href="/hygiene" className="hover:text-green-800 hover:underline underline-offset-4">Hygiene &amp; Safety</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}