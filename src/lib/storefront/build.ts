import type { Database } from "@/types/database.types";

import type {
  ComboStep,
  ComboStepOption,
  MenuResult,
  ModifierGroup,
  ModifierOption,
  ModifierOptionType,
  StorefrontCategory,
  StorefrontItem,
  StoreSettings,
} from "./types";

type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
type ItemRow = Database["public"]["Tables"]["menu_items"]["Row"];
type LinkRow = Database["public"]["Tables"]["menu_item_modifier_groups"]["Row"];
type GroupRow = Database["public"]["Tables"]["modifier_groups"]["Row"];
type ModifierRow = Database["public"]["Tables"]["item_modifiers"]["Row"];
type StepRow = Database["public"]["Tables"]["combo_steps"]["Row"];
type StepOptionRow = Database["public"]["Tables"]["combo_step_options"]["Row"];

export type MenuRows = {
  settings: StoreSettings;
  categories: Pick<CategoryRow, "id" | "name" | "slug" | "display_order">[];
  items: Pick<
    ItemRow,
    | "id"
    | "category_id"
    | "name"
    | "slug"
    | "description"
    | "base_price"
    | "image_url"
    | "prep_time_minutes"
    | "is_available"
    | "is_combo"
    | "sort_order"
  >[];
  links: Pick<LinkRow, "menu_item_id" | "group_id" | "sort_order">[];
  groups: Pick<
    GroupRow,
    "id" | "name" | "is_required" | "min_selections" | "max_selections"
  >[];
  modifiers: Pick<
    ModifierRow,
    "id" | "group_id" | "name" | "price_delta" | "modifier_type" | "sort_order"
  >[];
  steps: Pick<
    StepRow,
    | "id"
    | "combo_item_id"
    | "name"
    | "step_order"
    | "min_selections"
    | "max_selections"
    | "is_required"
  >[];
  stepOptions: Pick<
    StepOptionRow,
    "id" | "step_id" | "option_item_id" | "price_delta" | "is_default" | "sort_order"
  >[];
};

const PLACEHOLDER_IMAGE = "/images/placeholder-dish.svg";

function asModifierType(value: string): ModifierOptionType {
  return value === "OMISSION" || value === "COOKING_STYLE"
    ? value
    : "PAID_ADDON";
}

export function buildStorefrontMenu(rows: MenuRows): MenuResult {
  const groupsById = new Map<string, ModifierGroup>();

  for (const group of rows.groups) {
    groupsById.set(group.id, {
      id: group.id,
      name: group.name,
      isRequired: group.is_required,
      minSelections: group.min_selections,
      maxSelections: group.max_selections,
      sortOrder: 0,
      options: [],
    });
  }

  for (const modifier of rows.modifiers) {
    const group = groupsById.get(modifier.group_id);
    if (!group) continue;
    const option: ModifierOption = {
      id: modifier.id,
      name: modifier.name,
      priceDelta: modifier.price_delta,
      type: asModifierType(modifier.modifier_type),
    };
    group.options.push(option);
  }
  for (const group of groupsById.values()) {
    group.options.sort((a, b) => a.name.localeCompare(b.name));
  }

  const groupsByItem = new Map<string, ModifierGroup[]>();
  const sortedLinks = [...rows.links].sort((a, b) => a.sort_order - b.sort_order);
  for (const link of sortedLinks) {
    const group = groupsById.get(link.group_id);
    if (!group) continue;
    const list = groupsByItem.get(link.menu_item_id) ?? [];
    if (!list.some((entry) => entry.id === group.id)) {
      list.push({ ...group, sortOrder: link.sort_order });
      groupsByItem.set(link.menu_item_id, list);
    }
  }

  const stepsById = new Map<string, ComboStep>();
  for (const step of rows.steps) {
    stepsById.set(step.id, {
      id: step.id,
      name: step.name,
      stepOrder: step.step_order,
      minSelections: step.min_selections,
      maxSelections: step.max_selections,
      isRequired: step.is_required,
      options: [],
    });
  }

  const optionItemById = new Map(rows.items.map((item) => [item.id, item]));
  for (const option of rows.stepOptions) {
    const step = stepsById.get(option.step_id);
    const optionItem = optionItemById.get(option.option_item_id);
    if (!step || !optionItem || !optionItem.is_available) continue;
    const mapped: ComboStepOption = {
      id: option.id,
      itemId: option.option_item_id,
      name: optionItem.name,
      priceDelta: option.price_delta,
      isDefault: option.is_default,
      sortOrder: option.sort_order,
    };
    step.options.push(mapped);
  }
  for (const step of stepsById.values()) {
    step.options.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const stepsByCombo = new Map<string, ComboStep[]>();
  for (const row of rows.steps) {
    const step = stepsById.get(row.id);
    if (!step) continue;
    const list = stepsByCombo.get(row.combo_item_id) ?? [];
    list.push(step);
    stepsByCombo.set(row.combo_item_id, list);
  }
  for (const steps of stepsByCombo.values()) {
    steps.sort((a, b) => a.stepOrder - b.stepOrder);
  }

  const items: StorefrontItem[] = rows.items
    .map((item) => ({
      id: item.id,
      categoryId: item.category_id,
      name: item.name,
      slug: item.slug,
      description: item.description,
      basePrice: item.base_price,
      imageUrl: item.image_url?.trim() || PLACEHOLDER_IMAGE,
      prepTimeMinutes: item.prep_time_minutes,
      isCombo: item.is_combo,
      isAvailable: item.is_available,
      sortOrder: item.sort_order,
      modifierGroups: groupsByItem.get(item.id) ?? [],
      comboSteps: stepsByCombo.get(item.id) ?? [],
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

  const categories: StorefrontCategory[] = rows.categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
      displayOrder: category.display_order,
      items: items.filter((item) => item.categoryId === category.id),
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return {
    status: "ok",
    menu: {
      settings: rows.settings,
      categories,
      items,
      fetchedAt: new Date().toISOString(),
    },
  };
}
