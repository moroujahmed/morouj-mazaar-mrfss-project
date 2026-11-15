"use client";

import { Ban, Plus, SlidersHorizontal, UtensilsCrossed } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { formatUGX } from "@/lib/currency";
import type { StorefrontItem } from "@/lib/storefront/types";

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
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-green-100 bg-surface shadow-card">
      <div className="relative aspect-[4/3] w-full">
        <DishImage src={item.imageUrl} />
        {item.isCombo ? (
          <span className="absolute left-3 top-3">
            <Badge tone="orange" icon={<UtensilsCrossed className="size-4" />}>
              Combo
            </Badge>
          </span>
        ) : null}
        {soldOut ? (
          <span className="absolute right-3 top-3">
            <Badge tone="danger" icon={<Ban className="size-4" />}>
              Sold out
            </Badge>
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-extrabold leading-snug text-green-800">
            {item.name}
          </h3>
          <p className="tabular shrink-0 font-mono text-base font-semibold text-green-900">
            {formatUGX(item.basePrice)}
          </p>
        </div>
        {item.description ? (
          <p className="line-clamp-3 text-sm text-ink-secondary">
            {item.description}
          </p>
        ) : null}
        <p className="text-sm text-ink-secondary">
          Ready in about {item.prepTimeMinutes} min
        </p>

        <div className="mt-auto pt-2">
          {customizable ? (
            <button
              type="button"
              onClick={() => onCustomize(item)}
              disabled={disabled}
              aria-label={`Customize ${item.name}`}
              className={buttonClasses({
                variant: soldOut ? "secondary" : "primary",
                fullWidth: true,
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
              aria-label={`Add ${item.name} to cart`}
              className={buttonClasses({
                variant: soldOut ? "secondary" : "primary",
                fullWidth: true,
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
