import "server-only";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  createFixtureSettings,
  createFixtureTable,
} from "./fixture";
import { storeSettingsSchema } from "./settings";
import type { DineInTable, StoreSettings } from "./types";

/**
 * Public settings and dine-in token resolution.
 *
 * Both paths are anon-RLS safe: settings come from `get_public_settings()` and
 * table tokens from `validate_table_token()`. Neither `app_settings` nor
 * `tables` is readable directly by the browser.
 */

export type SettingsResult =
  | { status: "ok"; settings: StoreSettings }
  | { status: "unavailable" };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const tableSchema = z.object({
  tableId: z.string().uuid(),
  tableNumber: z.string().min(1),
  label: z.string().min(1),
});

export async function getPublicSettings(): Promise<SettingsResult> {
  // Test-only harness, shared with the storefront fixture. Production never
  // sets this flag.
  if (process.env.STOREFRONT_FIXTURE === "1") {
    return { status: "ok", settings: createFixtureSettings() };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("get_public_settings");
    if (error || !data) return { status: "unavailable" };

    const parsed = storeSettingsSchema.safeParse(data);
    return parsed.success
      ? { status: "ok", settings: parsed.data }
      : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}

/** Resolve a dine-in QR token. Malformed, inactive, or unknown tokens return null. */
export async function getTableByToken(
  token: string | null | undefined,
): Promise<DineInTable | null> {
  if (!token || !UUID_PATTERN.test(token)) return null;

  if (process.env.STOREFRONT_FIXTURE === "1") {
    return createFixtureTable(token);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("validate_table_token", {
      p_token: token,
    });
    if (error || !data) return null;

    const parsed = tableSchema.safeParse(data);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
