/** Shared storefront domain types. Pure data; safe to import from client code. */

export type StoreSettings = {
  restaurantName: string;
  restaurantLat: number;
  restaurantLng: number;
  supportWhatsapp: string;
  currency: string;
  timezone: string;
  freeDeliveryRadiusKm: number;
  ratePerExcessKm: number;
  maxDeliveryRadiusKm: number;
  codMaxRadiusKm: number;
  minimumOrderValue: number;
  minimumOrderValueDineIn: number;
  packagingFeeDefault: number;
  packagingFeeDineIn: number;
  maxCartValue: number;
  maxItemQuantity: number;
  maxCartLines: number;
  isStoreOpen: boolean;
  openingTime: string;
  closingTime: string;
  isKitchenBusy: boolean;
  busyBufferMinutes: number;
  isKitchenPaused: boolean;
};

export type ModifierOptionType =
  | "PAID_ADDON"
  | "OMISSION"
  | "COOKING_STYLE";

export type ModifierOption = {
  id: string;
  name: string;
  priceDelta: number;
  type: ModifierOptionType;
};

export type ModifierGroup = {
  id: string;
  name: string;
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
  sortOrder: number;
  options: ModifierOption[];
};

export type ComboStepOption = {
  id: string;
  itemId: string;
  name: string;
  priceDelta: number;
  isDefault: boolean;
  sortOrder: number;
};

export type ComboStep = {
  id: string;
  name: string;
  stepOrder: number;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  options: ComboStepOption[];
};

export type StorefrontItem = {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  imageUrl: string;
  prepTimeMinutes: number;
  isCombo: boolean;
  isAvailable: boolean;
  sortOrder: number;
  modifierGroups: ModifierGroup[];
  comboSteps: ComboStep[];
};

export type StorefrontCategory = {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  items: StorefrontItem[];
};

export type StorefrontMenu = {
  settings: StoreSettings;
  categories: StorefrontCategory[];
  items: StorefrontItem[];
  fetchedAt: string;
};

/** Server-validated dine-in table. A forged QR token never yields one. */
export type DineInTable = {
  tableId: string;
  tableNumber: string;
  label: string;
};

export type MenuResult =
  | { status: "ok"; menu: StorefrontMenu }
  | { status: "unavailable" };
