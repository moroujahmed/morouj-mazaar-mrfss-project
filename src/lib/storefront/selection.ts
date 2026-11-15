import {
  buildLineKey,
  type CartComboSelection,
  type CartLine,
  type CartModifier,
  type SelectionMap,
  type SelectionRule,
} from "./cart";
import type { StorefrontItem } from "./types";

/** Required groups plus combo steps in the order the customer should answer them. */
export function selectionRules(item: StorefrontItem): SelectionRule[] {
  return [
    ...item.modifierGroups.map((group) => ({
      id: group.id,
      name: group.name,
      minSelections: group.minSelections,
      maxSelections: group.maxSelections,
      isRequired: group.isRequired,
    })),
    ...item.comboSteps.map((step) => ({
      id: step.id,
      name: step.name,
      minSelections: step.minSelections,
      maxSelections: step.maxSelections,
      isRequired: step.isRequired,
    })),
  ];
}

/**
 * Combo steps ship admin-defined defaults, so the common path is valid on
 * open. Modifier groups are never pre-selected: required groups must be a
 * deliberate customer choice.
 */
export function createInitialSelections(item: StorefrontItem): SelectionMap {
  const selections: Record<string, string[]> = {};

  for (const step of item.comboSteps) {
    if (step.maxSelections === 1) {
      const preferred =
        step.options.find((option) => option.isDefault) ??
        (step.isRequired ? step.options[0] : undefined);
      if (preferred) selections[step.id] = [preferred.id];
      continue;
    }

    const defaults = step.options
      .filter((option) => option.isDefault)
      .map((option) => option.id)
      .slice(0, step.maxSelections);
    if (defaults.length > 0) selections[step.id] = defaults;
  }

  return selections;
}

export function toggleSelection(
  selected: SelectionMap,
  ruleId: string,
  optionId: string,
  maxSelections: number,
): SelectionMap {
  const current = selected[ruleId] ?? [];

  if (maxSelections === 1) {
    return { ...selected, [ruleId]: [optionId] };
  }

  const isSelected = current.includes(optionId);
  if (isSelected) {
    return { ...selected, [ruleId]: current.filter((id) => id !== optionId) };
  }

  if (current.length >= maxSelections) return selected;
  return { ...selected, [ruleId]: [...current, optionId] };
}

function modifierSnapshots(
  item: StorefrontItem,
  selected: SelectionMap,
): CartModifier[] {
  const snapshots: CartModifier[] = [];

  for (const group of item.modifierGroups) {
    const chosen = new Set(selected[group.id] ?? []);
    for (const option of group.options) {
      if (!chosen.has(option.id)) continue;
      snapshots.push({
        id: option.id,
        name: option.name,
        priceDelta: option.priceDelta,
      });
    }
  }

  return snapshots;
}

function comboSnapshots(
  item: StorefrontItem,
  selected: SelectionMap,
): CartComboSelection[] {
  const snapshots: CartComboSelection[] = [];

  for (const step of item.comboSteps) {
    const chosen = new Set(selected[step.id] ?? []);
    for (const option of step.options) {
      if (!chosen.has(option.id)) continue;
      snapshots.push({
        stepId: step.id,
        stepName: step.name,
        optionId: option.id,
        name: option.name,
        priceDelta: option.priceDelta,
      });
    }
  }

  return snapshots;
}

/**
 * Build the immutable cart-line snapshot. Prices come from the server-rendered
 * menu, never from the customer's input.
 */
export function buildCartLine(
  item: StorefrontItem,
  selected: SelectionMap,
  quantity: number,
): CartLine {
  const modifiers = modifierSnapshots(item, selected);
  const comboSelections = comboSnapshots(item, selected);

  return {
    key: buildLineKey(
      item.id,
      modifiers.map((modifier) => modifier.id),
      comboSelections.map((selection) => selection.optionId),
    ),
    itemId: item.id,
    name: item.name,
    imageUrl: item.imageUrl,
    basePrice: item.basePrice,
    quantity,
    modifiers,
    comboSelections,
  };
}
