"use client";

import { AlertCircle, Ban, Minus, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import {
  lineUnitPrice,
  validateSelections,
  type CartLimits,
  type CartLine,
  type SelectionMap,
} from "@/lib/storefront/cart";
import {
  buildCartLine,
  createInitialSelections,
  selectionRules,
  toggleSelection,
} from "@/lib/storefront/selection";
import type { StorefrontItem } from "@/lib/storefront/types";
import { formatUGX } from "@/lib/currency";
import { cn } from "@/lib/utils";

export type ItemSheetProps = {
  item: StorefrontItem | null;
  open: boolean;
  orderingEnabled: boolean;
  limits: CartLimits;
  onClose: () => void;
  onAdd: (line: CartLine) => void;
};

export function ItemSheet({
  item,
  open,
  orderingEnabled,
  limits,
  onClose,
  onAdd,
}: ItemSheetProps) {
  const [quantity, setQuantity] = useState(1);
  const [selections, setSelections] = useState<SelectionMap>({});
  const issuesId = useId();
  const itemId = item?.id;

  useEffect(() => {
    if (!open || !item) return;
    setQuantity(1);
    setSelections(createInitialSelections(item));
  }, [open, item]);

  const rules = item ? selectionRules(item) : [];
  const issues = item ? validateSelections(rules, selections) : [];
  const candidate = item ? buildCartLine(item, selections, quantity) : null;
  const unitPrice = candidate ? lineUnitPrice(candidate) : 0;
  const lineTotal = unitPrice * quantity;

  const blocked =
    !item ||
    !item.isAvailable ||
    !orderingEnabled ||
    issues.length > 0;

  if (!item) return null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={item.name}
      description={item.description ?? undefined}
      footer={
        <div className="flex flex-col gap-3">
          {!item.isAvailable ? (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl bg-status-dangerSurface p-3 text-sm font-semibold text-status-danger"
            >
              <Ban aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              This item just sold out. Choose something else from the menu.
            </p>
          ) : null}

          {!orderingEnabled && item.isAvailable ? (
            <p className="rounded-xl bg-status-warningSurface p-3 text-sm font-semibold text-status-warning">
              Ordering is closed right now. You can come back during opening
              hours to add this item.
            </p>
          ) : null}

          {issues.length > 0 && orderingEnabled ? (
            <ul
              id={issuesId}
              role="status"
              className="flex flex-col gap-1 rounded-xl bg-status-warningSurface p-3 text-sm font-semibold text-status-warning"
            >
              {issues.map((issue) => (
                <li key={`${issue.ruleId}-${issue.code}`} className="flex gap-2">
                  <AlertCircle
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <Button
            size="xl"
            fullWidth
            onClick={() => {
              if (blocked || !candidate) return;
              onAdd(candidate);
            }}
            disabled={blocked}
            aria-describedby={
              issues.length > 0 && orderingEnabled ? issuesId : undefined
            }
          >
            {item.isAvailable
              ? `Add to cart · ${formatUGX(lineTotal)}`
              : "Sold out"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {item.isCombo ? (
          <Badge tone="orange">Combo · choose each step</Badge>
        ) : null}

        <p className="text-base font-semibold text-green-900">
          {formatUGX(item.basePrice)} base price
        </p>

        {item.comboSteps.map((step) => {
          const chosen = selections[step.id] ?? [];
          const isSingle = step.maxSelections === 1;
          const atMax = chosen.length >= step.maxSelections;

          return (
            <fieldset
              key={step.id}
              className="rounded-xl border border-green-100 bg-surface p-4"
            >
              <legend className="px-1 text-base font-extrabold text-green-800">
                {step.name}
                {step.isRequired ? (
                  <span className="ml-2 text-sm font-semibold text-status-danger">
                    Required
                  </span>
                ) : null}
              </legend>
              <p className="mt-1 text-sm text-ink-secondary">
                {step.minSelections > 1
                  ? `Choose ${step.minSelections} to ${step.maxSelections}.`
                  : isSingle
                    ? "Choose one."
                    : `Choose up to ${step.maxSelections}.`}
              </p>
              <div className="mt-3 grid gap-2">
                {step.options.length === 0 ? (
                  <p className="text-sm font-semibold text-status-danger">
                    No options are available right now.
                  </p>
                ) : null}

                {isSingle && step.minSelections === 0 ? (
                  <label
                    className={cn(
                      "flex min-h-touch cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors",
                      chosen.length === 0
                        ? "border-green-800 bg-green-50"
                        : "border-green-100 bg-surface hover:border-green-700",
                    )}
                  >
                    <input
                      type="radio"
                      name={`combo-${itemId}-${step.id}`}
                      value=""
                      checked={chosen.length === 0}
                      onChange={() =>
                        setSelections((current) => ({
                          ...current,
                          [step.id]: [],
                        }))
                      }
                      className="size-5 shrink-0 accent-green-800"
                    />
                    <span className="flex-1 text-base font-semibold text-green-900">
                      No preference
                    </span>
                    <span className="text-sm text-ink-secondary">Included</span>
                  </label>
                ) : null}

                {step.options.map((option) => {
                  const checked = chosen.includes(option.id);
                  const disabled = !isSingle && !checked && atMax;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "flex min-h-touch items-center gap-3 rounded-xl border-2 p-3 transition-colors",
                        disabled
                          ? "cursor-not-allowed border-green-100 bg-surface-inset opacity-60"
                          : "cursor-pointer",
                        !disabled && checked
                          ? "border-green-800 bg-green-50"
                          : !disabled
                            ? "border-green-100 bg-surface hover:border-green-700"
                            : "",
                      )}
                    >
                      <input
                        type={isSingle ? "radio" : "checkbox"}
                        name={`combo-${itemId}-${step.id}`}
                        value={option.id}
                        checked={checked}
                        disabled={disabled}
                        onChange={() =>
                          setSelections((current) =>
                            toggleSelection(
                              current,
                              step.id,
                              option.id,
                              step.maxSelections,
                            ),
                          )
                        }
                        className="size-5 shrink-0 accent-green-800"
                      />
                      <span className="flex-1 text-base font-semibold text-green-900">
                        {option.name}
                      </span>
                      <span className="tabular shrink-0 font-mono text-sm text-ink-secondary">
                        {option.priceDelta > 0
                          ? `+${formatUGX(option.priceDelta)}`
                          : "Included"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        {item.modifierGroups.map((group) => {
          const chosen = selections[group.id] ?? [];
          const isSingle = group.maxSelections === 1;
          const atMax = chosen.length >= group.maxSelections;

          return (
            <fieldset
              key={group.id}
              className="rounded-xl border border-green-100 bg-surface p-4"
            >
              <legend className="px-1 text-base font-extrabold text-green-800">
                {group.name}
                {group.isRequired ? (
                  <span className="ml-2 text-sm font-semibold text-status-danger">
                    Required
                  </span>
                ) : null}
              </legend>
              <p className="mt-1 text-sm text-ink-secondary">
                {group.isRequired
                  ? `Choose ${group.minSelections === group.maxSelections ? group.minSelections : `${group.minSelections} to ${group.maxSelections}`}.`
                  : `Optional · choose up to ${group.maxSelections}.`}
              </p>

              <div className="mt-3 grid gap-2">
                {isSingle ? (
                  <label
                    className={cn(
                      "flex min-h-touch cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-colors",
                      chosen.length === 0
                        ? "border-green-800 bg-green-50"
                        : "border-green-100 bg-surface hover:border-green-700",
                    )}
                  >
                    <input
                      type="radio"
                      name={`group-${itemId}-${group.id}`}
                      value=""
                      checked={chosen.length === 0}
                      onChange={() =>
                        setSelections((current) => ({
                          ...current,
                          [group.id]: [],
                        }))
                      }
                      className="size-5 shrink-0 accent-green-800"
                    />
                    <span className="flex-1 text-base font-semibold text-green-900">
                      No preference
                    </span>
                    <span className="text-sm text-ink-secondary">Included</span>
                  </label>
                ) : null}

                {group.options.map((option) => {
                  const checked = chosen.includes(option.id);
                  const disabled = !isSingle && !checked && atMax;
                  return (
                    <label
                      key={option.id}
                      className={cn(
                        "flex min-h-touch items-center gap-3 rounded-xl border-2 p-3 transition-colors",
                        disabled
                          ? "cursor-not-allowed border-green-100 bg-surface-inset opacity-60"
                          : "cursor-pointer",
                        !disabled && checked
                          ? "border-green-800 bg-green-50"
                          : !disabled
                            ? "border-green-100 bg-surface hover:border-green-700"
                            : "",
                      )}
                    >
                      <input
                        type={isSingle ? "radio" : "checkbox"}
                        name={`group-${itemId}-${group.id}`}
                        value={option.id}
                        checked={checked}
                        disabled={disabled}
                        onChange={() =>
                          setSelections((current) =>
                            toggleSelection(
                              current,
                              group.id,
                              option.id,
                              group.maxSelections,
                            ),
                          )
                        }
                        className="size-5 shrink-0 accent-green-800"
                      />
                      <span className="flex-1 text-base font-semibold text-green-900">
                        {option.name}
                        <span className="block text-sm font-normal text-ink-secondary">
                          {option.type === "OMISSION"
                            ? "Omission"
                            : option.type === "COOKING_STYLE"
                              ? "Cooking style"
                              : "Add-on"}
                        </span>
                      </span>
                      <span className="tabular shrink-0 font-mono text-sm text-ink-secondary">
                        {option.priceDelta > 0
                          ? `+${formatUGX(option.priceDelta)}`
                          : "No charge"}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <div className="flex items-center justify-between gap-4 rounded-xl border border-green-100 bg-surface p-3">
          <span
            id={`quantity-${itemId}`}
            className="text-base font-semibold text-green-900"
          >
            Quantity
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              disabled={quantity <= 1}
              className="inline-flex size-12 items-center justify-center rounded-xl border-2 border-green-800 text-green-800 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Minus aria-hidden="true" className="size-5" />
            </button>
            <span
              aria-live="polite"
              aria-atomic="true"
              className="tabular min-w-8 text-center font-mono text-lg font-semibold text-green-900"
            >
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() =>
                setQuantity((value) =>
                  Math.min(limits.maxItemQuantity, value + 1),
                )
              }
              disabled={quantity >= limits.maxItemQuantity}
              className="inline-flex size-12 items-center justify-center rounded-xl border-2 border-green-800 text-green-800 hover:bg-green-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus aria-hidden="true" className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
