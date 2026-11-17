-- ============================================================================
-- MRFSS - Phase 6 follow-up: resolve pgcrypto from Supabase's extensions schema
-- ============================================================================
-- Supabase installs pgcrypto in the `extensions` schema, while local PostgreSQL
-- installs it in `public`. The COD OTP functions call `crypt` and `gen_salt`;
-- their explicit search_path must include both locations. `extensions` is
-- ignored when it does not exist, so the same definition works in both setups.
--
-- This migration only changes function configuration; the bodies are unchanged.
-- ============================================================================

BEGIN;

ALTER FUNCTION public.store_cod_otp(
  TEXT, TEXT, TIMESTAMPTZ, TEXT, INTEGER
) SET search_path = public, extensions, pg_temp;

ALTER FUNCTION public.verify_cod_otp(TEXT, TEXT)
  SET search_path = public, extensions, pg_temp;

COMMIT;
