import { describe, expect, it } from "vitest";

import {
  addLineWithLimits,
  buildLineKey,
  cartItemCount,
  cartSubtotal,
  lineTotal,
  lineUnitPrice,
  reconcileCartLines,
  validateSelections,
  type CartLine,
  type CartLimits,
  type SelectionMap,
} from "@/lib/storefront/cart";
import {
  buildCartLine,
  createInitialSelections,
  selectionRules,
  toggleSelection,
} from "@/lib/storefront/selection";
import type { StorefrontItem } from "@/lib/storefront/types";

const limits: CartLimits = {
  maxLines: 2,
  maxItemQuantity: 3,
  maxCartValue: 100_000,
};

function makeTilapia(overrides: Partial<StorefrontItem> = {}): StorefrontItem {
  return {
    id: "item-tilapia",
    categoryId: "category-combos",
    name: "Whole Tilapia Flame Combo",
    slug: "whole-tilapia-flame-combo",
    description: "Whole grilled tilapia with a side and a drink.",
    basePrice: 32_000,
    imageUrl: "/images/placeholder-dish.svg",
    prepTimeMinutes: 25,
    isCombo: true,
    isAvailable: true,
    sortOrder: 1,
    modifierGroups: [
      {
        id: "group-dips",
        name: "Extra Dips & Sauces",
        isRequired: false,
        minSelections: 0,
        maxSelections: 3,
        sortOrder: 1,
        options: [
          {
            id: "mod-garlic",
            name: "Extra Garlic Pepper Dip",
            priceDelta: 2_000,
            type: "PAID_ADDON",
          },
          {
            id: "mod-chili",
            name: "Extra Chili Sauce",
            priceDelta: 1_000,
            type: "PAID_ADDON",
          },
          {
            id: "mod-groundnut",
            name: "Extra Groundnut Sauce",
            priceDelta: 1_500,
            type: "PAID_ADDON",
          },
          {
            id: "mod-cheese",
            name: "Extra Cheese",
            priceDelta: 2_500,
            type: "PAID_ADDON",
          },
        ],
      },
    ],
    comboSteps: [
      {
        id: "step-side",
        name: "Choose a side",
        stepOrder: 1,
        minSelections: 1,
        maxSelections: 1,
        isRequired: true,
        options: [
          {
            id: "opt-chips",
            itemId: "item-chips",
            name: "Golden Chips",
            priceDelta: 0,
            isDefault: true,
            sortOrder: 1,
          },
          {
            id: "opt-matoke",
            itemId: "item-matoke",
            name: "Matoke & Groundnut",
            priceDelta: 0,
            isDefault: false,
            sortOrder: 2,
          },
        ],
      },
      {
        id: "step-drink",
        name: "Choose a drink",
        stepOrder: 2,
        minSelections: 1,
        maxSelections: 1,
        isRequired: true,
        options: [
          {
            id: "opt-water",
            itemId: "item-water",
            name: "Mineral Water (500 ml)",
            priceDelta: 0,
            isDefault: true,
            sortOrder: 1,
          },
          {
            id: "opt-soda",
            itemId: "item-soda",
            name: "Soda (300 ml)",
            priceDelta: 0,
            isDefault: false,
            sortOrder: 2,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function line(overrides: Partial<CartLine> = {}): CartLine {
  return {
    key: "line-a",
    itemId: "item-a",
    name: "Test Dish",
    imageUrl: "/images/placeholder-dish.svg",
    basePrice: 10_000,
    quantity: 1,
    modifiers: [],
    comboSelections: [],
    ...overrides,
  };
}

describe("canonical cart pricing", () => {
  it("computes 34,000 for the tilapia combo with a 2,000 dip before fees", () => {
    const item = makeTilapia();
    const selections = toggleSelection(
      createInitialSelections(item),
      "group-dips",
      "mod-garlic",
      3,
    );
    const cartLine = buildCartLine(item, selections, 1);

    expect(cartLine.comboSelections).toHaveLength(2);
    expect(cartLine.comboSelections.map((selection) => selection.name)).toEqual([
      "Golden Chips",
      "Mineral Water (500 ml)",
    ]);
    expect(cartLine.modifiers).toEqual([
      {
        id: "mod-garlic",
        name: "Extra Garlic Pepper Dip",
        priceDelta: 2_000,
      },
    ]);
    expect(lineUnitPrice(cartLine)).toBe(34_000);
    expect(lineTotal(cartLine)).toBe(34_000);
    // Subtotal excludes delivery and packaging; checkout adds those later.
    expect(cartSubtotal([cartLine])).toBe(34_000);
  });

  it("multiplies the line price by quantity", () => {
    const item = makeTilapia();
    const cartLine = buildCartLine(
      item,
      createInitialSelections(item),
      2,
    );

    expect(lineUnitPrice(cartLine)).toBe(32_000);
    expect(lineTotal(cartLine)).toBe(64_000);
    expect(cartSubtotal([cartLine])).toBe(64_000);
  });

  it("sums items and modifiers only, never a fee", () => {
    const first = line({ key: "one", basePrice: 8_000, quantity: 2 });
    const second = line({
      key: "two",
      basePrice: 2_000,
      modifiers: [
        { id: "dip", name: "Extra Garlic Pepper Dip", priceDelta: 2_000 },
      ],
    });

    expect(cartItemCount([first, second])).toBe(3);
    expect(cartSubtotal([first, second])).toBe(20_000);
  });

  it("builds a stable line key regardless of selection order", () => {
    expect(buildLineKey("item", ["b", "a"], ["z", "y"])).toBe(
      buildLineKey("item", ["a", "b"], ["y", "z"]),
    );
    expect(buildLineKey("item", ["a"])).not.toBe(buildLineKey("item", []));
  });
});

describe("modifier and combo validation", () => {
  it("requires each combo step to be chosen", () => {
    const item = makeTilapia();
    const rules = selectionRules(item);
    const valid = createInitialSelections(item);

    expect(validateSelections(rules, valid)).toEqual([]);

    const missingSide = { ...valid, "step-side": [] };
    const issues = validateSelections(rules, missingSide);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      ruleId: "step-side",
      ruleName: "Choose a side",
      code: "MIN",
    });
  });

  it("reports a required modifier group that is left empty", () => {
    const item = makeTilapia();
    const group = item.modifierGroups[0]!;
    item.modifierGroups[0] = {
      ...group,
      isRequired: true,
      minSelections: 1,
    };

    const issues = validateSelections(
      selectionRules(item),
      createInitialSelections(item),
    );
    expect(issues[0]?.ruleId).toBe("group-dips");
    expect(issues[0]?.message).toContain("choose at least 1");
  });

  it("enforces a multi-select maximum", () => {
    let selections: SelectionMap = {};
    for (const id of ["a", "b", "c", "d"]) {
      selections = toggleSelection(selections, "group-dips", id, 3);
    }

    expect(selections["group-dips"]).toEqual(["a", "b", "c"]);
  });

  it("replaces the choice for a single-select rule", () => {
    const first = toggleSelection({}, "spice", "mild", 1);
    const second = toggleSelection(first, "spice", "hot", 1);
    expect(second.spice).toEqual(["hot"]);
  });

  it("preselects every default option in a multi-select combo step", () => {
    const item = makeTilapia();
    const step = item.comboSteps[0]!;
    item.comboSteps[0] = {
      ...step,
      maxSelections: 2,
      options: step.options.map((option) => ({ ...option, isDefault: true })),
    };

    expect(createInitialSelections(item)["step-side"]).toEqual([
      "opt-chips",
      "opt-matoke",
    ]);
  });
});

describe("cart limits", () => {
  it("merges an identical line and sums its quantity", () => {
    const first = addLineWithLimits([], line(), limits);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = addLineWithLimits(first.lines, line({ quantity: 2 }), limits);
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    expect(second.lines).toHaveLength(1);
    expect(second.lines[0]?.quantity).toBe(3);
  });

  it("rejects quantity above max_item_quantity", () => {
    const result = addLineWithLimits([], line({ quantity: 4 }), limits);
    expect(result).toEqual({ ok: false, code: "ITEM_QUANTITY_LIMIT" });
  });

  it("rejects a new line beyond max_cart_lines", () => {
    const first = line({ key: "one", itemId: "item-one" });
    const second = line({ key: "two", itemId: "item-two" });
    const third = line({ key: "three", itemId: "item-three" });

    const result = addLineWithLimits([first, second], third, limits);
    expect(result).toEqual({ ok: false, code: "CART_LINE_LIMIT" });
  });

  it("rejects a cart above max_cart_value", () => {
    const result = addLineWithLimits(
      [],
      line({ basePrice: limits.maxCartValue + 1 }),
      limits,
    );
    expect(result).toEqual({ ok: false, code: "CART_VALUE_LIMIT" });
  });
});

describe("menu reconciliation", () => {
  function baseLine(): CartLine {
    const item = makeTilapia();
    const selections = toggleSelection(
      createInitialSelections(item),
      "group-dips",
      "mod-garlic",
      3,
    );
    return buildCartLine(item, selections, 1);
  }

  it("refreshes a changed base price", () => {
    const menu = makeTilapia({ basePrice: 33_000 });
    const { lines, result } = reconcileCartLines([baseLine()], [menu]);

    expect(result).toEqual({ unavailable: 0, priceChanged: 1 });
    expect(lines[0]?.basePrice).toBe(33_000);
    expect(cartSubtotal(lines)).toBe(35_000);
  });

  it("refreshes a changed modifier delta", () => {
    const menu = makeTilapia();
    menu.modifierGroups[0]!.options[0] = {
      ...menu.modifierGroups[0]!.options[0]!,
      priceDelta: 3_000,
    };

    const { lines, result } = reconcileCartLines([baseLine()], [menu]);
    expect(result.priceChanged).toBe(1);
    expect(lines[0]?.modifiers[0]?.priceDelta).toBe(3_000);
    expect(lineUnitPrice(lines[0]!)).toBe(35_000);
  });

  it("marks a sold-out item unavailable and keeps it removable", () => {
    const menu = makeTilapia({ isAvailable: false });
    const { lines, result } = reconcileCartLines([baseLine()], [menu]);

    expect(result.unavailable).toBe(1);
    expect(lines).toHaveLength(1);
    expect(lines[0]?.unavailable).toBe(true);
  });

  it("marks a missing item unavailable", () => {
    const { lines, result } = reconcileCartLines([baseLine()], []);
    expect(result.unavailable).toBe(1);
    expect(lines[0]?.unavailable).toBe(true);
  });

  it("marks a line unavailable when its modifier option disappears", () => {
    const menu = makeTilapia();
    menu.modifierGroups = [];

    const { lines, result } = reconcileCartLines([baseLine()], [menu]);
    expect(result.unavailable).toBe(1);
    expect(lines[0]?.unavailable).toBe(true);
  });

  it("clears the unavailable flag when the item returns", () => {
    const unavailable = makeTilapia({ isAvailable: false });
    const { lines } = reconcileCartLines([baseLine()], [unavailable]);
    expect(lines[0]?.unavailable).toBe(true);

    const restored = reconcileCartLines(lines, [makeTilapia()]);
    expect(restored.result.unavailable).toBe(0);
    expect(restored.lines[0]?.unavailable).toBe(false);
  });
});
