import type {
  ComboStep,
  ModifierGroup,
  StorefrontItem,
} from "./types";

export type CartModifier = {
  id: string;
  name: string;
  priceDelta: number;
};

export type CartComboSelection = {
  stepId: string;
  stepName: string;
  optionId: string;
  name: string;
  priceDelta: number;
};

export type CartLine = {
  key: string;
  itemId: string;
  name: string;
  imageUrl: string;
  basePrice: number;
  quantity: number;
  modifiers: CartModifier[];
  comboSelections: CartComboSelection[];
  /** Set by reconciliation when the current menu can no longer sell the line. */
  unavailable?: boolean;
};

export type CartLimits = {
  maxLines: number;
  maxItemQuantity: number;
  maxCartValue: number;
};

export type CartAddError =
  | "CART_LINE_LIMIT"
  | "ITEM_QUANTITY_LIMIT"
  | "CART_VALUE_LIMIT";

export type SelectionRule = Pick<
  ModifierGroup | ComboStep,
  "id" | "name" | "minSelections" | "maxSelections" | "isRequired"
>;

export type SelectionIssue = {
  ruleId: string;
  ruleName: string;
  code: "MIN" | "MAX";
  message: string;
};

export type SelectionMap = Record<string, readonly string[]>;

/** Stable cart-line identity: item + chosen modifier/option ids, order-independent. */
export function buildLineKey(
  itemId: string,
  modifierIds: readonly string[] = [],
  comboOptionIds: readonly string[] = [],
): string {
  return [
    itemId,
    ...[...modifierIds].sort(),
    ...comboOptionIds.map((id) => `c:${id}`).sort(),
  ].join("|");
}

export function lineUnitPrice(
  line: Pick<CartLine, "basePrice" | "modifiers" | "comboSelections">,
): number {
  const modifierTotal = line.modifiers.reduce(
    (total, modifier) => total + modifier.priceDelta,
    0,
  );
  const comboTotal = line.comboSelections.reduce(
    (total, selection) => total + selection.priceDelta,
    0,
  );
  return line.basePrice + modifierTotal + comboTotal;
}

export function lineTotal(line: CartLine): number {
  return lineUnitPrice(line) * line.quantity;
}

/** Items + modifiers only. Delivery and packaging are added at checkout. */
export function cartSubtotal(lines: readonly CartLine[]): number {
  return lines.reduce((total, line) => total + lineTotal(line), 0);
}

export function cartItemCount(lines: readonly CartLine[]): number {
  return lines.reduce((total, line) => total + line.quantity, 0);
}

export function cartHasUnavailableLines(lines: readonly CartLine[]): boolean {
  return lines.some((line) => line.unavailable);
}

/** Menu snapshot used by reconciliation. Full item data so modifier and combo
 * deltas can be refreshed, not just the base price. */
export type MenuSnapshotItem = Pick<
  StorefrontItem,
  | "id"
  | "name"
  | "basePrice"
  | "imageUrl"
  | "isAvailable"
  | "modifierGroups"
  | "comboSteps"
>;

export type ReconcileResult = {
  unavailable: number;
  priceChanged: number;
};

/**
 * Compare persisted lines with the current menu. Missing or unavailable items
 * (and modifier/combo options that disappeared) are marked unavailable rather
 * than silently dropped. Current names, images, and prices replace stale ones.
 * The customer must remove an unavailable line before checkout.
 */
export function reconcileCartLines(
  lines: readonly CartLine[],
  menuItems: readonly MenuSnapshotItem[],
): { lines: CartLine[]; result: ReconcileResult } {
  const byId = new Map(menuItems.map((item) => [item.id, item]));
  const result: ReconcileResult = {
    unavailable: 0,
    priceChanged: 0,
  };

  const next = lines.map((line) => {
    const item = byId.get(line.itemId);
    if (!item) {
      result.unavailable += 1;
      return { ...line, unavailable: true };
    }

    const modifiers: CartModifier[] = [];
    const comboSelections: CartComboSelection[] = [];
    let optionMissing = false;

    for (const saved of line.modifiers) {
      const option = item.modifierGroups
        .flatMap((group) => group.options)
        .find((candidate) => candidate.id === saved.id);
      if (!option) {
        optionMissing = true;
        modifiers.push(saved);
        continue;
      }
      modifiers.push({
        id: option.id,
        name: option.name,
        priceDelta: option.priceDelta,
      });
    }

    for (const saved of line.comboSelections) {
      const step = item.comboSteps.find(
        (candidate) => candidate.id === saved.stepId,
      );
      const option = step?.options.find(
        (candidate) => candidate.id === saved.optionId,
      );
      if (!step || !option) {
        optionMissing = true;
        comboSelections.push(saved);
        continue;
      }
      comboSelections.push({
        stepId: step.id,
        stepName: step.name,
        optionId: option.id,
        name: option.name,
        priceDelta: option.priceDelta,
      });
    }

    const updated: CartLine = {
      ...line,
      name: item.name,
      imageUrl: item.imageUrl,
      basePrice: item.basePrice,
      modifiers,
      comboSelections,
      unavailable: optionMissing || !item.isAvailable,
    };

    if (updated.unavailable) result.unavailable += 1;
    if (lineUnitPrice(updated) !== lineUnitPrice(line)) {
      result.priceChanged += 1;
    }

    return updated;
  });

  return { lines: next, result };
}

export function validateSelections(
  rules: readonly SelectionRule[],
  selected: SelectionMap,
): SelectionIssue[] {
  const issues: SelectionIssue[] = [];

  for (const rule of rules) {
    const count = selected[rule.id]?.length ?? 0;

    if (count < rule.minSelections) {
      issues.push({
        ruleId: rule.id,
        ruleName: rule.name,
        code: "MIN",
        message: `${rule.name}: choose at least ${rule.minSelections}.`,
      });
    }

    if (count > rule.maxSelections) {
      issues.push({
        ruleId: rule.id,
        ruleName: rule.name,
        code: "MAX",
        message: `${rule.name}: choose at most ${rule.maxSelections}.`,
      });
    }
  }

  return issues;
}

export function isSelectionValid(
  rules: readonly SelectionRule[],
  selected: SelectionMap,
): boolean {
  return validateSelections(rules, selected).length === 0;
}

/** Merge a candidate line into the cart while enforcing storefront limits. */
export function addLineWithLimits(
  lines: readonly CartLine[],
  candidate: CartLine,
  limits: CartLimits,
):
  | { ok: true; lines: CartLine[] }
  | { ok: false; code: CartAddError } {
  const existing = lines.find((line) => line.key === candidate.key);

  if (!existing && lines.length >= limits.maxLines) {
    return { ok: false, code: "CART_LINE_LIMIT" };
  }

  const nextQuantity = (existing?.quantity ?? 0) + candidate.quantity;
  if (nextQuantity > limits.maxItemQuantity) {
    return { ok: false, code: "ITEM_QUANTITY_LIMIT" };
  }

  const nextLines = existing
    ? lines.map((line) =>
        line.key === candidate.key
          ? { ...line, quantity: nextQuantity, unavailable: false }
          : line,
      )
    : [...lines, { ...candidate, quantity: nextQuantity }];

  if (cartSubtotal(nextLines) > limits.maxCartValue) {
    return { ok: false, code: "CART_VALUE_LIMIT" };
  }

  return { ok: true, lines: nextLines };
}
