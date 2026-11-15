import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { publicEnv } from "@/lib/public-env";
import type { Database } from "@/types/database.types";

/**
 * Server Component / Server Action / Route Handler client.
 * Cookie writes are best-effort: Server Components cannot set cookies, and the
 * middleware refreshes the session before the request reaches them.
 */
export async function createServerSupabaseClient() {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    throw new Error("Supabase public environment is not configured");
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component; middleware handles the refresh.
          }
        },
      },
    },
  );
}
