import "server-only";

import { buildStorefrontMenu, type MenuRows } from "./build";
import type { DineInTable, MenuResult, StoreSettings } from "./types";

/**
 * Canonical storefront fixture for browser tests.
 *
 * Values mirror `supabase/seed.sql` exactly (items, prices, modifier deltas,
 * combo steps, and app settings). It is imported only by `menu.ts` when
 * `STOREFRONT_FIXTURE=1`, which automated tests set explicitly. It never
 * replaces the database path in production.
 */
const settings: StoreSettings = {
  restaurantName: "Bazaar Flame & Grill",
  restaurantLat: 0.3136,
  restaurantLng: 32.5811,
  supportWhatsapp: "+256700000000",
  currency: "UGX",
  timezone: "Africa/Kampala",
  freeDeliveryRadiusKm: 5,
  ratePerExcessKm: 1500,
  maxDeliveryRadiusKm: 15,
  codMaxRadiusKm: 8.1,
  minimumOrderValue: 20_000,
  minimumOrderValueDineIn: 0,
  packagingFeeDefault: 1_000,
  packagingFeeDineIn: 0,
  maxCartValue: 200_000,
  maxItemQuantity: 20,
  maxCartLines: 30,
  isStoreOpen: true,
  openingTime: "10:00:00",
  closingTime: "22:00:00",
  isKitchenBusy: false,
  busyBufferMinutes: 20,
  isKitchenPaused: false,
};

const categories: MenuRows["categories"] = [
  {
    id: "11111111-1111-4111-8111-111111111101",
    name: "Combos & Bazaar Deals",
    slug: "combos",
    display_order: 1,
  },
  {
    id: "11111111-1111-4111-8111-111111111102",
    name: "Charcoal Flame Grills",
    slug: "grills",
    display_order: 2,
  },
  {
    id: "11111111-1111-4111-8111-111111111103",
    name: "Traditional Luwombo",
    slug: "luwombo",
    display_order: 3,
  },
  {
    id: "11111111-1111-4111-8111-111111111104",
    name: "Sides & Street Bites",
    slug: "sides",
    display_order: 4,
  },
  {
    id: "11111111-1111-4111-8111-111111111105",
    name: "Fresh Juices & Drinks",
    slug: "beverages",
    display_order: 5,
  },
];

function item(
  id: string,
  categoryId: string,
  name: string,
  slug: string,
  description: string,
  basePrice: number,
  prepTimeMinutes: number,
  sortOrder: number,
  isCombo = false,
  imageUrl: string | null = null,
): MenuRows["items"][number] {
  return {
    id,
    category_id: categoryId,
    name,
    slug,
    description,
    base_price: basePrice,
    image_url: imageUrl,
    prep_time_minutes: prepTimeMinutes,
    is_available: true,
    is_combo: isCombo,
    sort_order: sortOrder,
  };
}

const items: MenuRows["items"] = [
  item(
    "22222222-2222-4222-8222-222222222201",
    "11111111-1111-4111-8111-111111111101",
    "Whole Tilapia Flame Combo",
    "whole-tilapia-flame-combo",
    "Whole grilled tilapia served with a side and a drink. Choose your side and drink in the combo builder.",
    32_000,
    25,
    1,
    true,
    "/images/menu/grilled_tilapia_combo_1793348738708.jpg",
  ),
  item(
    "22222222-2222-4222-8222-222222222202",
    "11111111-1111-4111-8111-111111111102",
    "Quarter Charcoal Grilled Chicken",
    "quarter-charcoal-grilled-chicken",
    "Flame-grilled quarter chicken marinated in local herbs and garlic ginger glaze.",
    18_000,
    20,
    1,
    false,
    "/images/menu/charcoal_grilled_chicken_1793348776274.jpg",
  ),
  item(
    "22222222-2222-4222-8222-222222222203",
    "11111111-1111-4111-8111-111111111103",
    "Smoked Beef Luwombo",
    "smoked-beef-luwombo",
    "Traditional steamed beef wrapped in banana leaves with rich groundnut sauce, served with matoke.",
    26_000,
    30,
    1,
    false,
    "/images/menu/flame_burger.jpg",
  ),
  item(
    "22222222-2222-4222-8222-222222222204",
    "11111111-1111-4111-8111-111111111103",
    "Chicken Luwombo",
    "chicken-luwombo",
    "Steamed chicken in groundnut sauce, wrapped in banana leaves and served with matoke.",
    24_000,
    30,
    2,
    false,
    "/images/menu/grilled_chicken.jpg",
  ),
  item(
    "22222222-2222-4222-8222-222222222205",
    "11111111-1111-4111-8111-111111111104",
    "Special Bazaar Rolex",
    "special-bazaar-rolex",
    "Three-egg omelette with diced tomatoes and shredded cabbage, rolled inside two warm handmade chapatis.",
    8_000,
    10,
    1,
    false,
    "/images/menu/passion_juice_rolex_1793348796512.jpg",
  ),
  item(
    "22222222-2222-4222-8222-222222222206",
    "11111111-1111-4111-8111-111111111104",
    "Golden Chips",
    "golden-chips",
    "Crispy hand-cut potato chips with a light sprinkle of salt.",
    6_000,
    12,
    2,
  ),
  item(
    "22222222-2222-4222-8222-222222222207",
    "11111111-1111-4111-8111-111111111104",
    "Matoke & Groundnut",
    "matoke-groundnut",
    "Steamed green banana in a rich groundnut sauce.",
    15_000,
    20,
    3,
  ),
  item(
    "22222222-2222-4222-8222-222222222212",
    "11111111-1111-4111-8111-111111111104",
    "Chapati",
    "chapati",
    "Soft handmade chapati.",
    1_500,
    5,
    4,
  ),
  item(
    "22222222-2222-4222-8222-222222222208",
    "11111111-1111-4111-8111-111111111105",
    "Mineral Water (500 ml)",
    "mineral-water-500ml",
    "Chilled bottled mineral water.",
    2_000,
    1,
    1,
  ),
  item(
    "22222222-2222-4222-8222-222222222209",
    "11111111-1111-4111-8111-111111111105",
    "Soda (300 ml)",
    "soda-300ml",
    "Chilled bottled soda. Ask for available flavours.",
    3_000,
    1,
    2,
  ),
  item(
    "22222222-2222-4222-8222-222222222210",
    "11111111-1111-4111-8111-111111111105",
    "Cold-Pressed Passion Juice (500 ml)",
    "cold-pressed-passion-juice-500ml",
    "Fresh natural Masaka passion fruit juice, lightly sweetened.",
    5_000,
    5,
    3,
    false,
    "/images/menu/passion_juice_rolex.jpg",
  ),
  item(
    "22222222-2222-4222-8222-222222222211",
    "11111111-1111-4111-8111-111111111105",
    "African Coffee",
    "african-coffee",
    "Freshly brewed Ugandan coffee.",
    4_000,
    5,
    4,
  ),
];

const groups: MenuRows["groups"] = [
  {
    id: "33333333-3333-4333-8333-333333333301",
    name: "Extra Dips & Sauces",
    is_required: false,
    min_selections: 0,
    max_selections: 3,
  },
  {
    id: "33333333-3333-4333-8333-333333333302",
    name: "Spice Level",
    is_required: false,
    min_selections: 0,
    max_selections: 1,
  },
  {
    id: "33333333-3333-4333-8333-333333333303",
    name: "Omissions",
    is_required: false,
    min_selections: 0,
    max_selections: 5,
  },
  {
    id: "33333333-3333-4333-8333-333333333304",
    name: "Protein Add-On",
    is_required: false,
    min_selections: 0,
    max_selections: 1,
  },
];

const modifiers: MenuRows["modifiers"] = [
  {
    id: "44444444-4444-4444-8444-444444444401",
    group_id: "33333333-3333-4333-8333-333333333301",
    name: "Extra Garlic Pepper Dip",
    price_delta: 2_000,
    modifier_type: "PAID_ADDON",
    sort_order: 1,
  },
  {
    id: "44444444-4444-4444-8444-444444444402",
    group_id: "33333333-3333-4333-8333-333333333301",
    name: "Extra Chili Sauce",
    price_delta: 1_000,
    modifier_type: "PAID_ADDON",
    sort_order: 2,
  },
  {
    id: "44444444-4444-4444-8444-444444444403",
    group_id: "33333333-3333-4333-8333-333333333301",
    name: "Extra Groundnut Sauce",
    price_delta: 1_500,
    modifier_type: "PAID_ADDON",
    sort_order: 3,
  },
  {
    id: "44444444-4444-4444-8444-444444444404",
    group_id: "33333333-3333-4333-8333-333333333302",
    name: "Mild",
    price_delta: 0,
    modifier_type: "COOKING_STYLE",
    sort_order: 1,
  },
  {
    id: "44444444-4444-4444-8444-444444444405",
    group_id: "33333333-3333-4333-8333-333333333302",
    name: "Medium",
    price_delta: 0,
    modifier_type: "COOKING_STYLE",
    sort_order: 2,
  },
  {
    id: "44444444-4444-4444-8444-444444444406",
    group_id: "33333333-3333-4333-8333-333333333302",
    name: "Hot",
    price_delta: 0,
    modifier_type: "COOKING_STYLE",
    sort_order: 3,
  },
  {
    id: "44444444-4444-4444-8444-444444444407",
    group_id: "33333333-3333-4333-8333-333333333303",
    name: "No Onions",
    price_delta: 0,
    modifier_type: "OMISSION",
    sort_order: 1,
  },
  {
    id: "44444444-4444-4444-8444-444444444408",
    group_id: "33333333-3333-4333-8333-333333333303",
    name: "Light Salt",
    price_delta: 0,
    modifier_type: "OMISSION",
    sort_order: 2,
  },
  {
    id: "44444444-4444-4444-8444-444444444409",
    group_id: "33333333-3333-4333-8333-333333333304",
    name: "Add Chicken",
    price_delta: 5_000,
    modifier_type: "PAID_ADDON",
    sort_order: 1,
  },
  {
    id: "44444444-4444-4444-8444-444444444410",
    group_id: "33333333-3333-4333-8333-333333333304",
    name: "Add Beef",
    price_delta: 4_000,
    modifier_type: "PAID_ADDON",
    sort_order: 2,
  },
  {
    id: "44444444-4444-4444-8444-444444444411",
    group_id: "33333333-3333-4333-8333-333333333304",
    name: "Add Fish",
    price_delta: 6_000,
    modifier_type: "PAID_ADDON",
    sort_order: 3,
  },
];

const DIPS = "33333333-3333-4333-8333-333333333301";
const SPICE = "33333333-3333-4333-8333-333333333302";
const OMISSIONS = "33333333-3333-4333-8333-333333333303";

const links: MenuRows["links"] = [
  { menu_item_id: "22222222-2222-4222-8222-222222222201", group_id: DIPS, sort_order: 1 },
  { menu_item_id: "22222222-2222-4222-8222-222222222201", group_id: SPICE, sort_order: 2 },
  { menu_item_id: "22222222-2222-4222-8222-222222222201", group_id: OMISSIONS, sort_order: 3 },
  { menu_item_id: "22222222-2222-4222-8222-222222222202", group_id: DIPS, sort_order: 1 },
  { menu_item_id: "22222222-2222-4222-8222-222222222202", group_id: SPICE, sort_order: 2 },
  { menu_item_id: "22222222-2222-4222-8222-222222222202", group_id: OMISSIONS, sort_order: 3 },
  { menu_item_id: "22222222-2222-4222-8222-222222222203", group_id: DIPS, sort_order: 1 },
  { menu_item_id: "22222222-2222-4222-8222-222222222203", group_id: SPICE, sort_order: 2 },
  { menu_item_id: "22222222-2222-4222-8222-222222222203", group_id: OMISSIONS, sort_order: 3 },
  { menu_item_id: "22222222-2222-4222-8222-222222222204", group_id: DIPS, sort_order: 1 },
  { menu_item_id: "22222222-2222-4222-8222-222222222204", group_id: SPICE, sort_order: 2 },
  { menu_item_id: "22222222-2222-4222-8222-222222222204", group_id: OMISSIONS, sort_order: 3 },
  { menu_item_id: "22222222-2222-4222-8222-222222222205", group_id: DIPS, sort_order: 1 },
  { menu_item_id: "22222222-2222-4222-8222-222222222205", group_id: SPICE, sort_order: 2 },
  { menu_item_id: "22222222-2222-4222-8222-222222222205", group_id: OMISSIONS, sort_order: 3 },
  { menu_item_id: "22222222-2222-4222-8222-222222222206", group_id: OMISSIONS, sort_order: 1 },
  { menu_item_id: "22222222-2222-4222-8222-222222222207", group_id: OMISSIONS, sort_order: 1 },
];

const steps: MenuRows["steps"] = [
  {
    id: "55555555-5555-4555-8555-555555555501",
    combo_item_id: "22222222-2222-4222-8222-222222222201",
    name: "Choose a side",
    step_order: 1,
    min_selections: 1,
    max_selections: 1,
    is_required: true,
  },
  {
    id: "55555555-5555-4555-8555-555555555502",
    combo_item_id: "22222222-2222-4222-8222-222222222201",
    name: "Choose a drink",
    step_order: 2,
    min_selections: 1,
    max_selections: 1,
    is_required: true,
  },
];

const stepOptions: MenuRows["stepOptions"] = [
  {
    id: "66666666-6666-4666-8666-666666666601",
    step_id: "55555555-5555-4555-8555-555555555501",
    option_item_id: "22222222-2222-4222-8222-222222222206",
    price_delta: 0,
    is_default: true,
    sort_order: 1,
  },
  {
    id: "66666666-6666-4666-8666-666666666602",
    step_id: "55555555-5555-4555-8555-555555555501",
    option_item_id: "22222222-2222-4222-8222-222222222207",
    price_delta: 0,
    is_default: false,
    sort_order: 2,
  },
  {
    id: "66666666-6666-4666-8666-666666666603",
    step_id: "55555555-5555-4555-8555-555555555502",
    option_item_id: "22222222-2222-4222-8222-222222222208",
    price_delta: 0,
    is_default: true,
    sort_order: 1,
  },
  {
    id: "66666666-6666-4666-8666-666666666604",
    step_id: "55555555-5555-4555-8555-555555555502",
    option_item_id: "22222222-2222-4222-8222-222222222209",
    price_delta: 0,
    is_default: false,
    sort_order: 2,
  },
];

export type FixtureTable = DineInTable;

/** Canonical seed QR tokens, available only when the fixture branch is on. */
const fixtureTables: Record<string, FixtureTable> = {
  "88888888-8888-4888-8888-888888888801": {
    tableId: "77777777-7777-4777-8777-777777777701",
    tableNumber: "T1",
    label: "Window 1",
  },
  "88888888-8888-4888-8888-888888888804": {
    tableId: "77777777-7777-4777-8777-777777777704",
    tableNumber: "T4",
    label: "Food Court Table T4",
  },
};

export function createFixtureTable(token: string): FixtureTable | null {
  return fixtureTables[token.toLowerCase()] ?? null;
}

/** Resolve the label for a table id, mirroring `create_order`'s snapshot. */
export function createFixtureTableNumber(tableId: string | null): string | null {
  if (!tableId) return null;
  const match = Object.values(fixtureTables).find(
    (table) => table.tableId === tableId,
  );
  return match?.tableNumber ?? null;
}

/**
 * Canonical OSRM snapshot from `CANONICAL_EXAMPLES.md` §3 plus one far point
 * used to exercise the out-of-bounds block. These distances are test fixtures,
 * never production truth: a real deployment must call OSRM.
 */
export const FIXTURE_ROUTES = [
  {
    lat: 0.3245,
    lng: 32.5782,
    distanceM: 1_562,
    durationSeconds: 212,
  },
  {
    lat: 0.3542,
    lng: 32.612,
    distanceM: 8_093,
    durationSeconds: 507,
  },
  {
    lat: 0.36,
    lng: 32.62,
    distanceM: 9_400,
    durationSeconds: 600,
  },
  {
    lat: 0.0512,
    lng: 32.4637,
    distanceM: 35_000,
    durationSeconds: 2_700,
  },
] as const;

const FIXTURE_TOLERANCE_DEGREES = 0.0006;

export function resolveFixtureRoute(
  lat: number,
  lng: number,
): { distanceM: number; durationSeconds: number } | null {
  const match = FIXTURE_ROUTES.find(
    (route) =>
      Math.abs(route.lat - lat) <= FIXTURE_TOLERANCE_DEGREES &&
      Math.abs(route.lng - lng) <= FIXTURE_TOLERANCE_DEGREES,
  );

  return match
    ? { distanceM: match.distanceM, durationSeconds: match.durationSeconds }
    : null;
}

export function createFixtureSettings(): StoreSettings {
  const state = kitchenFixtureState();
  return {
    ...settings,
    isKitchenBusy: state.isKitchenBusy,
    busyBufferMinutes: state.busyBufferMinutes,
    isKitchenPaused: state.isKitchenPaused,
    ...Object.fromEntries(state.settingsOverrides),
  } as StoreSettings;
}

/** Admin settings edits are reflected by the storefront fixture as well. */
export function applyFixtureSettingsOverrides(
  patch: Record<string, unknown>,
): void {
  const state = kitchenFixtureState();
  for (const [key, value] of Object.entries(patch)) {
    if (key in settings) state.settingsOverrides.set(key, value);
  }
}

type KitchenFixtureState = {
  isKitchenBusy: boolean;
  busyBufferMinutes: number;
  isKitchenPaused: boolean;
  overrides: Map<string, boolean>;
  settingsOverrides: Map<string, unknown>;
};

type FixtureGlobal = typeof globalThis & {
  __mrfssKitchen?: KitchenFixtureState;
};

/**
 * Per-process kitchen overrides for Playwright. Production uses the database;
 * the fixture store never exists outside `STOREFRONT_FIXTURE=1`.
 *
 * State lives on `globalThis` because Next.js can evaluate this module in more
 * than one server bundle (page render, server actions, route handlers). A
 * module-local object would let the kitchen toggle write to a different copy
 * than the storefront and kitchen board read from.
 */
function kitchenFixtureState(): KitchenFixtureState {
  const globalStore = globalThis as FixtureGlobal;
  globalStore.__mrfssKitchen ??= {
    isKitchenBusy: false,
    busyBufferMinutes: settings.busyBufferMinutes,
    isKitchenPaused: false,
    overrides: new Map(),
    settingsOverrides: new Map(),
  };
  return globalStore.__mrfssKitchen;
}

export function setFixtureItemAvailability(
  itemId: string,
  available: boolean,
): boolean {
  if (!items.some((item) => item.id === itemId)) return false;
  kitchenFixtureState().overrides.set(itemId, available);
  return true;
}

export function setFixtureKitchenBusy(
  busy: boolean,
  bufferMinutes?: number,
): void {
  const state = kitchenFixtureState();
  state.isKitchenBusy = busy;
  if (bufferMinutes !== undefined) state.busyBufferMinutes = bufferMinutes;
}

export function setFixtureKitchenPaused(paused: boolean): void {
  kitchenFixtureState().isKitchenPaused = paused;
}

export function resetFixtureKitchenStateForTests(): void {
  const state = kitchenFixtureState();
  state.isKitchenBusy = false;
  state.busyBufferMinutes = settings.busyBufferMinutes;
  state.isKitchenPaused = false;
  state.overrides.clear();
  state.settingsOverrides.clear();
}

export function createFixtureMenu(): MenuResult {
  const state = kitchenFixtureState();
  return buildStorefrontMenu({
    settings: createFixtureSettings(),
    categories,
    items: items.map((item) => ({
      ...item,
      is_available: state.overrides.get(item.id) ?? item.is_available,
    })),
    links,
    groups,
    modifiers,
    steps,
    stepOptions,
  });
}
