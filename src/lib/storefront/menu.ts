import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import { buildStorefrontMenu, type MenuRows } from "./build";
import { createFixtureMenu } from "./fixture";
import { storeSettingsSchema } from "./settings";
import type { MenuResult } from "./types";

const ITEM_COLUMNS =
  "id, category_id, name, slug, description, base_price, image_url, prep_time_minutes, is_available, is_combo, sort_order";

export async function getStorefrontMenu(): Promise<MenuResult> {
  // Test-only harness: Playwright runs without a Supabase stack. Production
  // never sets this, and the server environment validation still gate-keeps
  // the real clients.
  if (process.env.STOREFRONT_FIXTURE === "1") {
    return createFixtureMenu();
  }

  try {
    const supabase = await createServerSupabaseClient();

    const [settingsResult, categoriesResult, itemsResult] = await Promise.all([
      supabase.rpc("get_public_settings"),
      supabase
        .from("categories")
        .select("id, name, slug, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("menu_items")
        .select(ITEM_COLUMNS)
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    if (
      settingsResult.error ||
      categoriesResult.error ||
      itemsResult.error ||
      !settingsResult.data ||
      !categoriesResult.data ||
      !itemsResult.data
    ) {
      return { status: "unavailable" };
    }

    const parsedSettings = storeSettingsSchema.safeParse(settingsResult.data);
    if (!parsedSettings.success) {
      return { status: "unavailable" };
    }

    const items = itemsResult.data;
    const itemIds = items.map((item) => item.id);
    const comboIds = items.filter((item) => item.is_combo).map((item) => item.id);

    const linksResult =
      itemIds.length > 0
        ? await supabase
            .from("menu_item_modifier_groups")
            .select("menu_item_id, group_id, sort_order")
            .in("menu_item_id", itemIds)
            .order("sort_order", { ascending: true })
        : { data: [] as MenuRows["links"], error: null };

    if (linksResult.error) return { status: "unavailable" };

    const links = linksResult.data ?? [];
    const groupIds = [...new Set(links.map((link) => link.group_id))];

    const groupsResult =
      groupIds.length > 0
        ? await supabase
            .from("modifier_groups")
            .select("id, name, is_required, min_selections, max_selections")
            .in("id", groupIds)
            .eq("is_active", true)
        : { data: [] as MenuRows["groups"], error: null };

    if (groupsResult.error) return { status: "unavailable" };
    const groups = groupsResult.data ?? [];
    const activeGroupIds = groups.map((group) => group.id);

    const modifiersResult =
      activeGroupIds.length > 0
        ? await supabase
            .from("item_modifiers")
            .select("id, group_id, name, price_delta, modifier_type, sort_order")
            .in("group_id", activeGroupIds)
            .eq("is_active", true)
            .order("sort_order", { ascending: true })
        : { data: [] as MenuRows["modifiers"], error: null };

    if (modifiersResult.error) return { status: "unavailable" };

    const stepsResult =
      comboIds.length > 0
        ? await supabase
            .from("combo_steps")
            .select(
              "id, combo_item_id, name, step_order, min_selections, max_selections, is_required",
            )
            .in("combo_item_id", comboIds)
            .order("step_order", { ascending: true })
        : { data: [] as MenuRows["steps"], error: null };

    if (stepsResult.error) return { status: "unavailable" };
    const steps = stepsResult.data ?? [];
    const stepIds = steps.map((step) => step.id);

    const stepOptionsResult =
      stepIds.length > 0
        ? await supabase
            .from("combo_step_options")
            .select("id, step_id, option_item_id, price_delta, is_default, sort_order")
            .in("step_id", stepIds)
            .order("sort_order", { ascending: true })
        : { data: [] as MenuRows["stepOptions"], error: null };

    if (stepOptionsResult.error) return { status: "unavailable" };
    const stepOptions = stepOptionsResult.data ?? [];

    const knownItemIds = new Set(itemIds);
    const missingOptionIds = [
      ...new Set(
        stepOptions
          .map((option) => option.option_item_id)
          .filter((id) => !knownItemIds.has(id)),
      ),
    ];

    const optionItemsResult =
      missingOptionIds.length > 0
        ? await supabase
            .from("menu_items")
            .select(ITEM_COLUMNS)
            .in("id", missingOptionIds)
            .eq("is_active", true)
        : { data: [] as MenuRows["items"], error: null };

    if (optionItemsResult.error) return { status: "unavailable" };

    return buildStorefrontMenu({
      settings: parsedSettings.data,
      categories: categoriesResult.data,
      items: [...items, ...(optionItemsResult.data ?? [])],
      links,
      groups,
      modifiers: modifiersResult.data ?? [],
      steps,
      stepOptions,
    });
  } catch {
    return { status: "unavailable" };
  }
}
