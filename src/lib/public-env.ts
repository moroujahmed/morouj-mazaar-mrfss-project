/**
 * Public (browser-safe) environment values.
 *
 * Next.js inlines these exact `process.env.NEXT_PUBLIC_*` references at build
 * time, so this module must never import server-only code or secrets.
 */
export const publicEnv = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  supportWhatsApp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  maptilerKey: process.env.NEXT_PUBLIC_MAPTILER_KEY ?? "",
  // The browser suite disables the Realtime websocket so a dummy Supabase URL
  // never causes connection retries. Polling remains the fallback everywhere.
  realtimeEnabled: process.env.NEXT_PUBLIC_REALTIME_DISABLED !== "1",
} as const;

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}
