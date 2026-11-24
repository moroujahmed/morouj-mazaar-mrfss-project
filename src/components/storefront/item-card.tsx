"use client";

import { Ban, Clock, Plus, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { formatUGX } from "@/lib/currency";
import type { StorefrontItem } from "@/lib/storefront/types";
import { cn } from "@/lib/utils";

import { DishImage } from "./dish-image";

export type ItemCardProps = {
  item: StorefrontItem;
  orderingEnabled: boolean;
  onCustomize: (item: StorefrontItem) => void;
  onQuickAdd: (item: StorefrontItem) => void;
};

export function ItemCard({
  item,
  orderingEnabled,
  onCustomize,
  onQuickAdd,
}: ItemCardProps) {
  const customizable =
    item.modifierGroups.length > 0 || item.comboSteps.length > 0;
  const soldOut = !item.isAvailable;
  const disabled = soldOut || !orderingEnabled;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-green-100/80 bg-white shadow-[0_4px_16px_-2px_rgba(16,46,39,0.06)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-8px_rgba(16,46,39,0.14)]">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-green-50">
        <DishImage
          src={item.imageUrl}
          className={cn(
            "transition-transform duration-500 group-hover:scale-[1.03]",
            soldOut && "opacity-65 grayscale-[15%]",
          )}
        />
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/20 to-transparent" />
        {item.isCombo ? (
          <span className="absolute left-3 top-3">
            <Badge tone="orange">Combo</Badge>
          </span>
        ) : null}
        {soldOut ? (
          <span className="absolute right-3 top-3">
            <Badge tone="danger" icon={<Ban className="size-4" />}>
              Sold out
            </Badge>
          </span>
        ) : null}
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-green-950/75 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          <Clock aria-hidden="true" className="size-3.5" />
          {item.prepTimeMinutes} min
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-extrabold leading-snug text-green-950 sm:text-xl">
            {item.name}
          </h3>
        </div>
        {item.description ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-ink-secondary">
            {item.description}
          </p>
        ) : null}
        <p className="text-sm text-ink-secondary">
          Ready in about {item.prepTimeMinutes} min
        </p>

        <div className="mt-auto flex items-end justify-between gap-3 pt-3">
          <p className="tabular font-mono text-xl font-extrabold text-green-900">
            {formatUGX(item.basePrice)}
          </p>
          {customizable ? (
            <button
              type="button"
              onClick={() => onCustomize(item)}
              disabled={disabled}
              aria-label={
                soldOut ? `Sold out: ${item.name}` : `Customize ${item.name}`
              }
              className={buttonClasses({
                variant: soldOut ? "secondary" : "primary",
                className: cn(
                  "min-w-[7.5rem] rounded-full px-5",
                  !soldOut && "shadow-[0_8px_20px_rgba(23,63,53,0.22)]",
                ),
              })}
            >
              <SlidersHorizontal aria-hidden="true" className="size-4" />
              <span>{soldOut ? "Sold out" : "Customize"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onQuickAdd(item)}
              disabled={disabled}
              aria-label={
                soldOut ? `Sold out: ${item.name}` : `Add ${item.name} to cart`
              }
              className={buttonClasses({
                variant: soldOut ? "secondary" : "primary",
                className: cn(
                  "min-w-[7.5rem] rounded-full px-5",
                  !soldOut && "shadow-[0_8px_20px_rgba(23,63,53,0.22)]",
                ),
              })}
            >
              <Plus aria-hidden="true" className="size-4" />
              <span>{soldOut ? "Sold out" : "Add"}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
