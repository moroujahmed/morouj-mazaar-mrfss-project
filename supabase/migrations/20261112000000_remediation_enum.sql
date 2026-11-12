-- ============================================================================
-- PROJECT-BAZAAR-D2C / MRFSS — v1.4 remediation: enum additions
-- Target: PostgreSQL 15+ / Supabase (validated on PostgreSQL 18)
-- Date: 2026-11-12
-- ============================================================================
-- `ALTER TYPE ... ADD VALUE` is kept in its own transaction so the new value
-- is committed before any later migration or function body can reference it.
-- ============================================================================

BEGIN;

ALTER TYPE public.delivery_outcome ADD VALUE IF NOT EXISTS 'RETURNED';

COMMIT;
