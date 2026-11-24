"use client";

import {
  CheckCircle2,
  Clock,
  Flame,
  MapPin,
  MessageCircle,
  Search,
  Sparkles,
  UtensilsCrossed,
  X,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TextField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useCart } from "@/hooks/use-cart";
import { useCartHydration } from "@/hooks/use-cart-hydration";
import { formatUGX } from "@/lib/currency";
import {
  type CartAddError,
  type CartLimits,
  type CartLine,
} from "@/lib/storefront/cart";
import { buildCartLine } from "@/lib/storefront/selection";
import {
  formatStoreTime,
  type StoreStatus,
} from "@/lib/storefront/store-status";
import type {
  DineInTable,
  StorefrontItem,
  StorefrontMenu,
} from "@/lib/storefront/types";
import { cn } from "@/lib/utils";

import { CartDock } from "./cart-dock";
import { CartSheet } from "./cart-sheet";
import { ItemCard } from "./item-card";
import { ItemSheet } from "./item-sheet";
import { SiteFooter } from "./site-footer";

export type StorefrontProps = {
  menu: StorefrontMenu;
  storeStatus: StoreStatus;
  table?: DineInTable | null;
  tableToken?: string | null;
};

function statusLabel(status: StoreStatus): string {
  if (status.open) {
    return `Open now · closes ${formatStoreTime(status.closesAt)}`;
  }
  if (status.reason === "manual") return "Closed right now";
  return `Closed · opens ${formatStoreTime(status.opensAt)}`;
}

function limitMessage(code: CartAddError, limits: CartLimits): string {
  switch (code) {
    case "CART_LINE_LIMIT":
      return `Your cart can hold at most ${limits.maxLines} different lines.`;
    case "ITEM_QUANTITY_LIMIT":
      return `You can order at most ${limits.maxItemQuantity} of one item.`;
    case "CART_VALUE_LIMIT":
      return `Your cart cannot exceed ${formatUGX(limits.maxCartValue)}.`;
  }
}

export function Storefront({
  menu,
  storeStatus,
  table = null,
  tableToken = null,
}: StorefrontProps) {
  const { settings, categories, items } = menu;
  const { showToast } = useToast();
  const router = useRouter();

  const lines = useCart((state) => state.lines);
  const addLine = useCart((state) => state.addLine);

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<StorefrontItem | null>(null);
  const [itemSheetOpen, setItemSheetOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const limits: CartLimits = {
    maxLines: settings.maxCartLines,
    maxItemQuantity: settings.maxItemQuantity,
    maxCartValue: settings.maxCartValue,
  };

  const hydrated = useCartHydration(items, (result) => {
    if (result.unavailable > 0) {
      showToast({
        title: "Some items are sold out",
        description:
          "Remove them from your cart before continuing to checkout.",
        tone: "error",
      });
    } else if (result.priceChanged > 0) {
      showToast({
        title: "Prices updated",
        description:
          "Your cart now reflects the current menu prices and availability.",
        tone: "info",
      });
    }
  });

  const orderingEnabled = storeStatus.open;
  const canAdd = orderingEnabled && hydrated;
  const dineIn = table !== null;
  const checkoutHref =
    dineIn && tableToken
      ? `/checkout?table=${encodeURIComponent(tableToken)}`
      : "/checkout";

  const visibleCategories = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return categories
      .filter(
        (category) =>
          activeCategory === "all" || category.id === activeCategory,
      )
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          if (!needle) return true;
          return (
            item.name.toLowerCase().includes(needle) ||
            (item.description ?? "").toLowerCase().includes(needle)
          );
        }),
      }))
      .filter((category) => category.items.length > 0);
  }, [activeCategory, categories, query]);

  const visibleItemCount = visibleCategories.reduce(
    (total, category) => total + category.items.length,
    0,
  );

  function reportLimit(code: CartAddError) {
    showToast({
      title: "Cart limit reached",
      description: limitMessage(code, limits),
      tone: "error",
    });
  }

  function openItem(item: StorefrontItem) {
    setSelectedItem(item);
    setItemSheetOpen(true);
  }

  function quickAdd(item: StorefrontItem) {
    if (!canAdd) return;
    const line = buildCartLine(item, {}, 1);
    const result = addLine(line, limits);
    if (!result.ok) {
      reportLimit(result.code);
      return;
    }
    showToast({
      title: `${item.name} added`,
      description: "Open the cart when you are ready to continue.",
      tone: "success",
    });
  }

  function addFromSheet(line: CartLine) {
    const result = addLine(line, limits);
    if (!result.ok) {
      reportLimit(result.code);
      return;
    }
    setItemSheetOpen(false);
    setSelectedItem(null);
    showToast({ title: `${line.name} added`, tone: "success" });
  }

  const activeCategoryName =
    activeCategory === "all"
      ? null
      : (categories.find((category) => category.id === activeCategory)?.name ??
        null);

  const supportHref = `https://wa.me/${settings.supportWhatsapp.replace(/\D/g, "")}`;
  const heroImage =
    items.find((item) => item.slug === "whole-tilapia-flame-combo")?.imageUrl ??
    "/images/placeholder-dish.svg";

  return (
    <div className="min-h-dvh bg-[#f4f7f5] pb-32 text-green-950">
      <header className="sticky top-0 z-40 border-b border-green-100/80 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-green-800 text-white shadow-[0_10px_24px_rgba(23,63,53,0.28)]">
                <Flame aria-hidden="true" className="size-6" />
              </div>
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-orange-700">
                  Morouj Mazaar · Food Court
                </p>
                <h1 className="text-2xl font-extrabold leading-none tracking-tight text-green-900 sm:text-3xl">
                  {settings.restaurantName}
                </h1>
                <p className="flex items-center gap-1.5 text-sm text-ink-secondary">
                  <MapPin aria-hidden="true" className="size-4" />
                  {dineIn
                    ? `Dine-in · Table ${table.tableNumber}`
                    : "Kampala · Delivery, pickup, and dine-in"}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <Badge
                tone={storeStatus.open ? "success" : "warning"}
                icon={
                  storeStatus.open ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Clock className="size-4" />
                  )
                }
              >
                {statusLabel(storeStatus)}
              </Badge>
              <a
                href={supportHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-touch items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-green-800 underline underline-offset-4 hover:bg-green-50"
              >
                <MessageCircle aria-hidden="true" className="size-4" />
                WhatsApp support
              </a>
            </div>
          </div>

          <div className="max-w-xl">
            <TextField
              label="Search the menu"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search dishes, drinks, or sides"
              autoComplete="off"
            />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8"
      >
        <section className="relative overflow-hidden rounded-[2rem] border border-green-100 bg-white shadow-[0_20px_60px_-20px_rgba(16,46,39,0.18)]">
          <div className="absolute -right-20 -top-20 size-72 rounded-full bg-orange-200/40 blur-3xl" />
          <div className="absolute -bottom-16 left-1/3 size-64 rounded-full bg-green-200/40 blur-3xl" />
          <div className="grid items-center gap-6 p-6 sm:p-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
            <div className="relative z-10 flex flex-col gap-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-green-50 px-4 py-2 text-sm font-semibold text-green-800">
                <Sparkles aria-hidden="true" className="size-4 text-orange-600" />
                Chef&apos;s signature charcoal grill
              </div>
              <h2 className="max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-green-950 sm:text-5xl lg:text-6xl">
                Authentic Kampala flame &amp;{" "}
                <span className="text-green-700">gourmet grills</span>
              </h2>
              <p className="max-w-2xl text-base leading-relaxed text-ink-secondary sm:text-lg">
                Tender whole tilapia, slow-steamed luwombo, charcoal chicken, and
                legendary Rolex made to order. Browse the full menu, customize your
                dish, and check out in minutes.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-green-900 shadow-sm ring-1 ring-green-100">
                  <CheckCircle2 aria-hidden="true" className="size-4 text-green-700" />
                  Free delivery within 5 km
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-green-900 shadow-sm ring-1 ring-green-100">
                  <Clock aria-hidden="true" className="size-4 text-orange-600" />
                  Fresh prep, clear ETA
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-green-900 shadow-sm ring-1 ring-green-100">
                  <UtensilsCrossed aria-hidden="true" className="size-4 text-green-700" />
                  Dine-in or delivery
                </span>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href="#menu-heading"
                  className={cn(
                    "inline-flex min-h-touch items-center justify-center rounded-2xl bg-green-800 px-6 py-3 text-base font-bold text-white shadow-[0_12px_30px_rgba(23,63,53,0.28)] transition hover:bg-green-900",
                  )}
                >
                  Explore full menu
                </a>
                <a
                  href={supportHref}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-touch items-center justify-center rounded-2xl border border-green-200 bg-white px-6 py-3 text-base font-bold text-green-900 transition hover:bg-green-50"
                >
                  Chat on WhatsApp
                </a>
              </div>
            </div>

            <div className="relative z-10 mx-auto w-full max-w-xl">
              <div className="relative overflow-hidden rounded-[1.75rem] border border-green-100 bg-green-50 shadow-2xl">
                <div className="relative aspect-[4/3] w-full">
                  <Image
                    src={heroImage}
                    alt="Featured Bazaar Flame & Grill dish"
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover"
                  />
                </div>
                <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-2">
                  <span className="rounded-full bg-green-950/80 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
                    Featured: Whole Tilapia Flame Combo
                  </span>
                  <span className="rounded-full bg-orange-500 px-4 py-2 text-sm font-bold text-green-950 shadow">
                    From USh 32,000
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {table ? (
          <div
            role="status"
            className="flex flex-col gap-1 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-900"
          >
            <p className="flex items-center gap-2 font-extrabold">
              <UtensilsCrossed aria-hidden="true" className="size-5" />
              Dine-in · Table {table.tableNumber}
            </p>
            <p className="text-sm">
              {table.label}. No delivery or packaging fee, and the delivery
              minimum does not apply.
            </p>
          </div>
        ) : tableToken ? (
          <div
            role="status"
            className="flex flex-col gap-1 rounded-2xl border border-status-warning bg-status-warningSurface p-4 text-status-warning"
          >
            <p className="font-extrabold">This table link is not active</p>
            <p className="text-sm">
              Order for delivery instead, or ask a member of staff for a new table
              QR code.
            </p>
          </div>
        ) : null}

        {!storeStatus.open ? (
          <div
            role="status"
            className="flex flex-col gap-1 rounded-2xl border border-status-warning bg-status-warningSurface p-4 text-status-warning"
          >
            <p className="flex items-center gap-2 font-extrabold">
              <Clock aria-hidden="true" className="size-5" />
              Ordering is closed
            </p>
            <p className="text-sm">
              {storeStatus.reason === "manual"
                ? "The restaurant has paused new orders. Browse the menu and come back soon."
                : `We reopen at ${formatStoreTime(storeStatus.opensAt)}. Browse the menu now and order during opening hours.`}
            </p>
          </div>
        ) : null}

        {storeStatus.open && settings.isKitchenPaused ? (
          <div
            role="status"
            className="flex flex-col gap-1 rounded-2xl border border-status-warning bg-status-warningSurface p-4 text-status-warning"
          >
            <p className="font-extrabold">The kitchen is paused</p>
            <p className="text-sm">
              You can build a cart, but checkout stays disabled until the kitchen
              resumes.
            </p>
          </div>
        ) : null}

        {storeStatus.open &&
        settings.isKitchenBusy &&
        !settings.isKitchenPaused ? (
          <p
            role="status"
            className="rounded-2xl border border-green-100 bg-green-50 p-4 text-sm font-semibold text-green-900"
          >
            The kitchen is busy. Prep times may run about{" "}
            {settings.busyBufferMinutes} minutes longer than shown.
          </p>
        ) : null}

        <section aria-labelledby="menu-heading" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-orange-700">
                Bazaar culinary map
              </p>
              <h2
                id="menu-heading"
                className="text-3xl font-extrabold tracking-tight text-green-950"
              >
                {activeCategoryName ?? "Signature dishes"}
              </h2>
              <p
                role="status"
                aria-live="polite"
                className="text-sm text-ink-secondary"
              >
                {visibleItemCount} {visibleItemCount === 1 ? "dish" : "dishes"}
                {query.trim() ? ` matching “${query.trim()}”` : ""}
              </p>
            </div>
            {!hydrated && lines.length === 0 ? (
              <span className="text-sm text-ink-secondary">
                Loading your saved cart…
              </span>
            ) : null}
          </div>

          {categories.length > 0 ? (
            <nav aria-label="Menu categories" className="overflow-x-auto">
              <div className="flex w-max gap-2 pb-1">
                <button
                  type="button"
                  aria-pressed={activeCategory === "all"}
                  onClick={() => setActiveCategory("all")}
                  className={cn(
                    "min-h-touch shrink-0 rounded-full border px-5 text-sm font-bold transition-all sm:text-base",
                    activeCategory === "all"
                      ? "border-green-800 bg-green-800 text-white shadow-[0_8px_20px_rgba(23,63,53,0.22)]"
                      : "border-green-100 bg-white text-green-900 hover:border-green-300 hover:bg-green-50",
                  )}
                >
                  All
                </button>
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    aria-pressed={activeCategory === category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={cn(
                      "min-h-touch shrink-0 rounded-full border px-5 text-sm font-bold transition-all sm:text-base",
                      activeCategory === category.id
                        ? "border-green-800 bg-green-800 text-white shadow-[0_8px_20px_rgba(23,63,53,0.22)]"
                        : "border-green-100 bg-white text-green-900 hover:border-green-300 hover:bg-green-50",
                    )}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </nav>
          ) : null}

          {query.trim() ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setActiveCategory("all");
              }}
              className="inline-flex min-h-touch w-fit items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-green-800 underline underline-offset-4 hover:bg-green-50"
            >
              <X aria-hidden="true" className="size-4" />
              Clear search and filters
            </button>
          ) : null}

          {items.length === 0 ? (
            <EmptyState
              icon={<UtensilsCrossed className="size-7" />}
              title="The menu is being updated"
              description="No dishes are published right now. Message us on WhatsApp and we will help you order."
            />
          ) : visibleCategories.length === 0 ? (
            <EmptyState
              icon={<Search className="size-7" />}
              title="No dishes match your search"
              description="Try a different word, or clear the search to see the full menu."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQuery("");
                    setActiveCategory("all");
                  }}
                >
                  Clear search and filters
                </Button>
              }
            />
          ) : (
            visibleCategories.map((category) => (
              <section
                key={category.id}
                aria-labelledby={`category-${category.slug}`}
                className="flex flex-col gap-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3
                    id={`category-${category.slug}`}
                    className="text-2xl font-extrabold tracking-tight text-green-950"
                  >
                    {category.name}
                  </h3>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold uppercase tracking-wider text-green-700 ring-1 ring-green-100">
                    {category.items.length} items
                  </span>
                </div>
                <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {category.items.map((item) => (
                    <li key={item.id}>
                      <ItemCard
                        item={item}
                        orderingEnabled={canAdd}
                        onCustomize={openItem}
                        onQuickAdd={quickAdd}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </section>

      </main>

      <SiteFooter />

      <CartDock
        lines={lines}
        hydrated={hydrated}
        onOpen={() => setCartOpen(true)}
      />

      <ItemSheet
        item={selectedItem}
        open={itemSheetOpen}
        orderingEnabled={canAdd}
        limits={limits}
        onClose={() => {
          setItemSheetOpen(false);
          setSelectedItem(null);
        }}
        onAdd={addFromSheet}
      />

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        limits={limits}
        orderingEnabled={storeStatus.open}
        kitchenPaused={settings.isKitchenPaused}
        onCheckout={() => {
          setCartOpen(false);
          router.push(checkoutHref);
        }}
      />
    </div>
  );
}
