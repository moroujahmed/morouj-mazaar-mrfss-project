"use client";

import {
  CheckCircle2,
  Clock,
  MapPin,
  MessageCircle,
  Search,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { TextField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useCart } from "@/hooks/use-cart";
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
  StorefrontItem,
  StorefrontMenu,
} from "@/lib/storefront/types";
import { cn } from "@/lib/utils";

import { CartDock } from "./cart-dock";
import { CartSheet } from "./cart-sheet";
import { ItemCard } from "./item-card";
import { ItemSheet } from "./item-sheet";

export type StorefrontProps = {
  menu: StorefrontMenu;
  storeStatus: StoreStatus;
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

export function Storefront({ menu, storeStatus }: StorefrontProps) {
  const { settings, categories, items } = menu;
  const { showToast } = useToast();

  const lines = useCart((state) => state.lines);
  const hydrated = useCart((state) => state.hydrated);
  const addLine = useCart((state) => state.addLine);

  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<StorefrontItem | null>(null);
  const [itemSheetOpen, setItemSheetOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);

  const hydrationStarted = useRef(false);

  const limits: CartLimits = {
    maxLines: settings.maxCartLines,
    maxItemQuantity: settings.maxItemQuantity,
    maxCartValue: settings.maxCartValue,
  };

  useEffect(() => {
    if (hydrationStarted.current) return;
    hydrationStarted.current = true;

    // No cleanup guard here: React StrictMode runs the effect twice in dev,
    // and the second run returns early. The first promise must still finish.
    Promise.resolve(useCart.persist.rehydrate()).finally(() => {
      useCart.getState().markHydrated();

      const result = useCart.getState().reconcile(items);
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
  }, [items, showToast]);

  const orderingEnabled = storeStatus.open;
  const canAdd = orderingEnabled && hydrated;

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
    showToast({
      title: `${line.name} added`,
      tone: "success",
    });
  }

  const activeCategoryName =
    activeCategory === "all"
      ? null
      : (categories.find((category) => category.id === activeCategory)?.name ??
        null);

  const supportHref = `https://wa.me/${settings.supportWhatsapp.replace(/\D/g, "")}`;

  return (
    <div className="min-h-dvh bg-surface-inset pb-32">
      <header className="border-b border-green-100 bg-surface">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-eyebrow uppercase text-orange-700">
                Morouj Mazaar · Food Court
              </p>
              <h1 className="text-3xl font-extrabold text-green-800">
                {settings.restaurantName}
              </h1>
              <p className="flex items-center gap-1.5 text-sm text-ink-secondary">
                <MapPin aria-hidden="true" className="size-4" />
                Kampala · Delivery, pickup, and dine-in
              </p>
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
                className="inline-flex min-h-touch items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-green-800 underline underline-offset-4 hover:bg-green-50"
              >
                <MessageCircle aria-hidden="true" className="size-4" />
                WhatsApp support
              </a>
            </div>
          </div>

          <TextField
            label="Search the menu"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search dishes, drinks, or sides"
            autoComplete="off"
          />
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6"
      >
        {!storeStatus.open ? (
          <div
            role="status"
            className="flex flex-col gap-1 rounded-2xl border-2 border-status-warning bg-status-warningSurface p-4 text-status-warning"
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
            className="flex flex-col gap-1 rounded-2xl border-2 border-status-warning bg-status-warningSurface p-4 text-status-warning"
          >
            <p className="font-extrabold">The kitchen is paused</p>
            <p className="text-sm">
              You can build a cart, but checkout stays disabled until the
              kitchen resumes.
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

        <section aria-labelledby="menu-heading" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="menu-heading" className="text-2xl font-extrabold">
                {activeCategoryName ?? "Full menu"}
              </h2>
              <p
                role="status"
                aria-live="polite"
                className="text-sm text-ink-secondary"
              >
                {visibleItemCount}{" "}
                {visibleItemCount === 1 ? "dish" : "dishes"}
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
                    "min-h-touch shrink-0 rounded-full border-2 px-4 text-base font-semibold transition-colors",
                    activeCategory === "all"
                      ? "border-green-800 bg-green-800 text-white"
                      : "border-green-100 bg-surface text-green-800 hover:border-green-700",
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
                      "min-h-touch shrink-0 rounded-full border-2 px-4 text-base font-semibold transition-colors",
                      activeCategory === category.id
                        ? "border-green-800 bg-green-800 text-white"
                        : "border-green-100 bg-surface text-green-800 hover:border-green-700",
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
              className="inline-flex min-h-touch w-fit items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-green-800 underline underline-offset-4 hover:bg-green-50"
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
                className="flex flex-col gap-3"
              >
                <h3
                  id={`category-${category.slug}`}
                  className="text-xl font-extrabold"
                >
                  {category.name}
                </h3>
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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

        <footer className="border-t border-green-100 pt-6 text-sm text-ink-secondary">
          <p>
            {settings.restaurantName} · Kampala, Uganda · Prices in{" "}
            {settings.currency}
          </p>
          <p className="mt-1">
            Delivery minimum {formatUGX(settings.minimumOrderValue)} · Dine-in
            minimum {formatUGX(settings.minimumOrderValueDineIn)}
          </p>
        </footer>
      </main>

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
          showToast({
            title: "Checkout is the next step",
            description:
              "Delivery pricing and payment are added in the next build phase.",
            tone: "info",
          });
        }}
      />
    </div>
  );
}
