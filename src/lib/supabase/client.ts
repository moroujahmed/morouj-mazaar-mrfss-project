"use client";

import { createBrowserClient } from "@supabase/ssr";

import { publicEnv } from "@/lib/public-env";
import type { Database } from "@/types/database.types";

/** Browser client. The anon key is public; RLS still enforces every row. */
export function createClient() {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    throw new Error("Supabase public environment is not configured");
  }

  return createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
  );
}
