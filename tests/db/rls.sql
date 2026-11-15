-- Database and RLS acceptance tests (TEST_PLAN.md §3).
-- Run against a database with the full migration chain and seed applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/db/rls.sql
-- The transaction is rolled back, so fixtures never persist.

\set ON_ERROR_STOP on

BEGIN;

-- Simulate the Supabase JWT subject used by auth.uid().
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- ---------------------------------------------------------------------------
-- Fixtures (inserted as the superuser, bypassing RLS).
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'admin@test.local'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'kitchen@test.local'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'rider@test.local'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'rider2@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles
  (id, full_name, phone_number, role, is_active, must_change_pin)
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'RLS Admin', '+256700900101', 'ADMIN', true, false),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'RLS Kitchen', '+256700900102', 'KITCHEN', true, false),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', 'RLS Rider', '+256700900103', 'RIDER', true, false),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4', 'RLS Rider Two', '+256700900104', 'RIDER', true, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.categories (id, name, slug, display_order, is_active)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1', 'RLS Test Category', 'rls-test-category', 999, true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.menu_items
  (id, category_id, name, slug, base_price, prep_time_minutes,
   is_available, is_active, is_combo, sort_order)
VALUES
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
   'RLS Visible Item', 'rls-visible-item', 5000, 5, true, true, false, 998),
  ('cccccccc-cccc-4ccc-8ccc-ccccccccccc2', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
   'RLS Hidden Item', 'rls-hidden-item', 5000, 5, true, false, false, 999)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Schema invariants
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'pin_code'
  ) THEN
    RAISE EXCEPTION 'FAIL: profiles.pin_code must not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'profiles_id_fkey'
      AND c.confrelid = 'auth.users'::regclass
  ) THEN
    RAISE EXCEPTION 'FAIL: profiles.id must reference auth.users';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'payment_transactions_order_attempt_uniq'
  ) THEN
    RAISE EXCEPTION 'FAIL: unique (order_id, attempt_number) index missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'payment_transactions_txref_uniq'
  ) THEN
    RAISE EXCEPTION 'FAIL: unique tx_ref index missing';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Privilege matrix (object privileges, before RLS)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.orders', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon has SELECT on orders';
  END IF;
  IF has_table_privilege('authenticated', 'public.orders', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: authenticated has SELECT on orders';
  END IF;
  IF has_table_privilege('anon', 'public.orders', 'INSERT') THEN
    RAISE EXCEPTION 'FAIL: anon has INSERT on orders';
  END IF;
  IF has_column_privilege('anon', 'public.orders', 'handover_pin', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon can read handover_pin';
  END IF;
  IF has_column_privilege('authenticated', 'public.orders', 'handover_pin', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: authenticated can read handover_pin';
  END IF;
  IF has_table_privilege('anon', 'public.rider_telemetry', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: anon has SELECT on rider_telemetry';
  END IF;
  IF has_table_privilege('authenticated', 'public.rider_telemetry', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: authenticated has SELECT on rider_telemetry';
  END IF;
  IF NOT has_table_privilege('service_role', 'public.orders', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: service_role must read orders';
  END IF;

  IF has_function_privilege('anon', 'public.get_rider_pool()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can execute get_rider_pool';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_rider_pool()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated must execute get_rider_pool';
  END IF;
  IF has_function_privilege('authenticated', 'public.resolve_payment_tx_ref(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated can execute resolve_payment_tx_ref';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.resolve_payment_tx_ref(text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: service_role must execute resolve_payment_tx_ref';
  END IF;
  IF has_function_privilege('authenticated', 'public.expire_pending_orders()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated can execute expire_pending_orders';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.expire_pending_orders()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: service_role must execute expire_pending_orders';
  END IF;
  IF NOT has_function_privilege('anon', 'public.start_payment_attempt(uuid, public.payment_method, text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon must start a payment attempt';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.admin_redeliver_order(uuid, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated must reach admin_redeliver_order (guarded inside)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Anonymous behavior
-- ---------------------------------------------------------------------------
SET LOCAL ROLE anon;

DO $$
DECLARE
  visible integer;
  hidden integer;
BEGIN
  SELECT count(*) INTO visible FROM public.menu_items;
  IF visible < 1 THEN
    RAISE EXCEPTION 'FAIL: anon sees no active menu items';
  END IF;

  SELECT count(*) INTO hidden FROM public.menu_items WHERE name = 'RLS Hidden Item';
  IF hidden <> 0 THEN
    RAISE EXCEPTION 'FAIL: anon sees an inactive menu item';
  END IF;
END $$;

DO $$
DECLARE
  n integer;
BEGIN
  BEGIN
    SELECT count(*) INTO n FROM public.orders;
    RAISE EXCEPTION 'FAIL: anon read orders';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

DO $$
DECLARE
  n integer;
BEGIN
  BEGIN
    SELECT count(*) INTO n FROM public.rider_telemetry;
    RAISE EXCEPTION 'FAIL: anon read rider_telemetry';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

DO $$
DECLARE
  result jsonb;
BEGIN
  result := public.get_order_by_token('00000000-0000-4000-8000-000000000000');
  IF result IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: unknown order token must return null';
  END IF;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Rider behavior
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  own_count integer;
  other_count integer;
  pool jsonb;
BEGIN
  SELECT count(*) INTO own_count FROM public.profiles;
  IF own_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: rider must see exactly one profile, saw %', own_count;
  END IF;

  SELECT count(*) INTO other_count
  FROM public.profiles
  WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  IF other_count <> 0 THEN
    RAISE EXCEPTION 'FAIL: rider can see another profile';
  END IF;

  pool := public.get_rider_pool();
  IF jsonb_typeof(pool) <> 'array' THEN
    RAISE EXCEPTION 'FAIL: get_rider_pool must return an array';
  END IF;
END $$;

DO $$
DECLARE
  n integer;
BEGIN
  BEGIN
    SELECT count(*) INTO n FROM public.orders;
    RAISE EXCEPTION 'FAIL: rider read orders directly';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM public.get_kitchen_orders();
    RAISE EXCEPTION 'FAIL: rider called get_kitchen_orders';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'AUTH_UNAUTHORIZED' THEN
      RAISE EXCEPTION 'FAIL: rider kitchen error was %', SQLERRM;
    END IF;
  END;
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM public.admin_get_order('00000000-0000-4000-8000-000000000000');
    RAISE EXCEPTION 'FAIL: rider called admin_get_order';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'AUTH_UNAUTHORIZED' THEN
      RAISE EXCEPTION 'FAIL: rider admin error was %', SQLERRM;
    END IF;
  END;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Kitchen behavior
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  own_count integer;
  orders jsonb;
BEGIN
  SELECT count(*) INTO own_count FROM public.profiles;
  IF own_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: kitchen must see exactly one profile, saw %', own_count;
  END IF;

  orders := public.get_kitchen_orders();
  IF orders IS NULL THEN
    RAISE EXCEPTION 'FAIL: get_kitchen_orders returned null';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    PERFORM public.get_rider_pool();
    RAISE EXCEPTION 'FAIL: kitchen called get_rider_pool';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'AUTH_UNAUTHORIZED' THEN
      RAISE EXCEPTION 'FAIL: kitchen rider-pool error was %', SQLERRM;
    END IF;
  END;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Admin behavior
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  profile_count integer;
  ledger jsonb;
BEGIN
  SELECT count(*) INTO profile_count FROM public.profiles;
  IF profile_count < 4 THEN
    RAISE EXCEPTION 'FAIL: admin must see all test profiles, saw %', profile_count;
  END IF;

  ledger := public.get_admin_ledger((now() AT TIME ZONE 'Africa/Kampala')::date);
  IF ledger IS NULL THEN
    RAISE EXCEPTION 'FAIL: get_admin_ledger returned null';
  END IF;
END $$;

DO $$
DECLARE
  n integer;
BEGIN
  BEGIN
    SELECT count(*) INTO n FROM public.orders;
    RAISE EXCEPTION 'FAIL: admin read orders directly';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END $$;

RESET ROLE;

ROLLBACK;
