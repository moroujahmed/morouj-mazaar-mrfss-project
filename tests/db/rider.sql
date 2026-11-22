-- ============================================================================
-- Phase 9 - Rider portal, claim/start/PIN/telemetry, shifts, and cash summary
-- ============================================================================
-- Run against a database with the full migration chain (including
-- 20261120000000_rider_shift.sql) and seed applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/db/rider.sql
-- The transaction is rolled back, so fixtures never persist.

\set ON_ERROR_STOP on

BEGIN;

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

-- ---------------------------------------------------------------------------
-- Staff fixtures (superuser inserts bypass RLS).
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('dddddddd-dddd-4ddd-8ddd-ddddddddd301', 'kitchen-phase9@test.local'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddd302', 'rider-one-phase9@test.local'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddd303', 'rider-two-phase9@test.local'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddd304', 'admin-phase9@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles
  (id, full_name, phone_number, role, is_active, must_change_pin, motorcycle_plate)
VALUES
  ('dddddddd-dddd-4ddd-8ddd-ddddddddd301', 'Phase 9 Kitchen', '+256700900401', 'KITCHEN', true, false, NULL),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddd302', 'Phase 9 Rider One', '+256700900402', 'RIDER', true, false, 'UFD 342B'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddd303', 'Phase 9 Rider Two', '+256700900403', 'RIDER', true, false, 'UEX 119A'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddd304', 'Phase 9 Admin', '+256700900404', 'ADMIN', true, false, NULL)
ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role,
      is_active = true,
      motorcycle_plate = EXCLUDED.motorcycle_plate;

-- ---------------------------------------------------------------------------
-- Privilege matrix
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.get_rider_pool()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can read the rider pool';
  END IF;
  IF has_function_privilege('anon', 'public.get_rider_active_order()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can read the active rider order';
  END IF;
  IF has_function_privilege('anon', 'public.claim_order_atomic(UUID)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can claim orders';
  END IF;
  IF has_function_privilege('anon', 'public.start_delivery(UUID)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can start deliveries';
  END IF;
  IF has_function_privilege('anon', 'public.verify_delivery_pin(UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can verify handover PINs';
  END IF;
  IF has_function_privilege('anon', 'public.update_rider_telemetry(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can write rider telemetry';
  END IF;
  IF has_function_privilege('anon', 'public.start_rider_shift(INTEGER)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can start rider shifts';
  END IF;
  IF has_function_privilege('anon', 'public.get_rider_shift()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can read rider shifts';
  END IF;
  IF has_function_privilege('anon', 'public.get_rider_cash_summary(UUID)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can read rider cash';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.get_rider_pool()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated cannot read the rider pool';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.get_rider_shift()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated cannot read rider shifts';
  END IF;

  IF has_table_privilege('authenticated', 'public.orders', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: authenticated can read the orders table directly';
  END IF;
  IF has_table_privilege('authenticated', 'public.rider_shifts', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: authenticated can read rider_shifts directly';
  END IF;
  IF has_table_privilege('authenticated', 'public.rider_telemetry', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: authenticated can read rider_telemetry directly';
  END IF;
  IF has_table_privilege('authenticated', 'public.pin_verification_attempts', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: authenticated can read pin_verification_attempts directly';
  END IF;
END $$;

CREATE TEMP TABLE r_ids (label TEXT PRIMARY KEY, id UUID NOT NULL);

-- ---------------------------------------------------------------------------
-- Order fixtures. A and B are cash 35,000 deliveries; C is prepaid and is
-- advanced to PREPARING as the service role would after a successful payment.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r jsonb;
BEGIN
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '99999999-9999-4999-8999-0000000000a1',
    'requestHash', 'hash-rider-a',
    'customerName', 'Rider Cash A',
    'customerPhone', '0772960001',
    'orderType', 'DELIVERY',
    'deliveryAddressText', 'Nakasero Plot 12, ground floor',
    'deliveryLatitude', 0.3245,
    'deliveryLongitude', 32.5782,
    'roadDistanceM', 1562,
    'estimatedTravelMinutes', 4,
    'paymentMethod', 'CASH_ON_DELIVERY',
    'codChangeRequestedFor', 50000,
    'items', jsonb_build_array(
      jsonb_build_object(
        'menuItemId', '22222222-2222-4222-8222-222222222201',
        'quantity', 1,
        'modifiers', jsonb_build_array(
          jsonb_build_object('modifierId', '44444444-4444-4444-8444-444444444401'),
          jsonb_build_object('comboOptionId', '66666666-6666-4666-8666-666666666601'),
          jsonb_build_object('comboOptionId', '66666666-6666-4666-8666-666666666603')
        )
      )
    )
  ));

  IF (r->>'orderStatus') <> 'CONFIRMED_UNPAID' THEN
    RAISE EXCEPTION 'FAIL: COD order A status %', r->>'orderStatus';
  END IF;
  IF (r->>'totalAmount')::int <> 35000 THEN
    RAISE EXCEPTION 'FAIL: COD order A total %', r->>'totalAmount';
  END IF;

  INSERT INTO r_ids VALUES ('a', (r->>'orderId')::uuid);
END $$;

DO $$
DECLARE
  r jsonb;
BEGIN
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '99999999-9999-4999-8999-0000000000b1',
    'requestHash', 'hash-rider-b',
    'customerName', 'Rider Cash B',
    'customerPhone', '0772960002',
    'orderType', 'DELIVERY',
    'deliveryAddressText', 'Ntinda Shopping Centre',
    'deliveryLatitude', 0.3542,
    'deliveryLongitude', 32.612,
    'roadDistanceM', 8093,
    'estimatedTravelMinutes', 9,
    'paymentMethod', 'CASH_ON_DELIVERY',
    'codChangeRequestedFor', 50000,
    'items', jsonb_build_array(
      jsonb_build_object('menuItemId', '22222222-2222-4222-8222-222222222208', 'quantity', 10)
    )
  ));

  IF (r->>'orderStatus') <> 'CONFIRMED_UNPAID' THEN
    RAISE EXCEPTION 'FAIL: COD order B status %', r->>'orderStatus';
  END IF;

  INSERT INTO r_ids VALUES ('b', (r->>'orderId')::uuid);
END $$;

DO $$
DECLARE
  r jsonb;
BEGIN
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '99999999-9999-4999-8999-0000000000c1',
    'requestHash', 'hash-rider-c',
    'customerName', 'Rider Prepaid C',
    'customerPhone', '0772960003',
    'orderType', 'DELIVERY',
    'deliveryAddressText', 'Nakasero Plot 14',
    'deliveryLatitude', 0.3246,
    'deliveryLongitude', 32.5783,
    'roadDistanceM', 1562,
    'estimatedTravelMinutes', 4,
    'paymentMethod', 'MTN_MOMO',
    'items', jsonb_build_array(
      jsonb_build_object('menuItemId', '22222222-2222-4222-8222-222222222208', 'quantity', 10)
    )
  ));

  IF (r->>'orderStatus') <> 'PENDING_PAYMENT' THEN
    RAISE EXCEPTION 'FAIL: prepaid order C status %', r->>'orderStatus';
  END IF;

  INSERT INTO r_ids VALUES ('c', (r->>'orderId')::uuid);
END $$;

-- A successful digital payment precedes the kitchen hand-off in production.
UPDATE public.orders
SET payment_status = 'PAID',
    order_status = 'PREPARING'
WHERE id = (SELECT id FROM r_ids WHERE label = 'c');

SELECT set_config('test.order_a', (SELECT id::text FROM r_ids WHERE label = 'a'), true);
SELECT set_config('test.order_b', (SELECT id::text FROM r_ids WHERE label = 'b'), true);
SELECT set_config('test.order_c', (SELECT id::text FROM r_ids WHERE label = 'c'), true);

-- The kitchen readies all three deliveries without exposing customer secrets.
SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-ddddddddd301', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_a uuid := current_setting('test.order_a')::uuid;
  v_b uuid := current_setting('test.order_b')::uuid;
  v_c uuid := current_setting('test.order_c')::uuid;
  v_result jsonb;
BEGIN
  PERFORM public.accept_order(v_a);
  v_result := public.bump_order(v_a);
  IF (v_result->>'status') <> 'READY_FOR_PICKUP' THEN
    RAISE EXCEPTION 'FAIL: order A did not become ready: %', v_result;
  END IF;

  PERFORM public.accept_order(v_b);
  v_result := public.bump_order(v_b);
  IF (v_result->>'status') <> 'READY_FOR_PICKUP' THEN
    RAISE EXCEPTION 'FAIL: order B did not become ready: %', v_result;
  END IF;

  v_result := public.bump_order(v_c);
  IF (v_result->>'status') <> 'READY_FOR_PICKUP' THEN
    RAISE EXCEPTION 'FAIL: prepaid order C did not become ready: %', v_result;
  END IF;
END $$;

RESET ROLE;

-- Capture the prepaid PIN as the service role so rider two can hand it over.
DO $$
DECLARE
  v_pin text;
BEGIN
  SELECT handover_pin INTO v_pin
  FROM public.orders
  WHERE id = current_setting('test.order_c')::uuid;

  PERFORM set_config('test.pin_c', v_pin, true);
END $$;

-- ---------------------------------------------------------------------------
-- Rider one: safe pool, one active delivery, telemetry, lockout.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-ddddddddd302', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_pool jsonb;
  v_active jsonb;
  v_result jsonb;
  v_shift jsonb;
  v_leak boolean;
  v_a uuid := current_setting('test.order_a')::uuid;
  v_b uuid := current_setting('test.order_b')::uuid;
  v_c uuid := current_setting('test.order_c')::uuid;
BEGIN
  v_shift := public.get_rider_shift();
  IF (v_shift->>'isOpen')::boolean THEN
    RAISE EXCEPTION 'FAIL: rider one started with an open shift';
  END IF;

  v_result := public.start_rider_shift(50000);
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'FAIL: start_rider_shift returned %', v_result;
  END IF;

  BEGIN
    PERFORM public.start_rider_shift(0);
    RAISE EXCEPTION 'FAIL: a second shift was opened';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'SHIFT_ALREADY_OPEN%' THEN RAISE; END IF;
  END;

  v_shift := public.get_rider_shift();
  IF NOT (v_shift->>'isOpen')::boolean
     OR (v_shift->>'openingFloat')::int <> 50000
     OR (v_shift->>'shiftId') IS NULL THEN
    RAISE EXCEPTION 'FAIL: open shift was not reported: %', v_shift;
  END IF;

  v_pool := public.get_rider_pool();
  IF jsonb_array_length(v_pool) <> 3 THEN
    RAISE EXCEPTION 'FAIL: rider pool has % deliveries, expected 3', jsonb_array_length(v_pool);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_pool) t WHERE (t->>'orderId')::uuid = v_a
  ) OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_pool) t WHERE (t->>'orderId')::uuid = v_c
  ) THEN
    RAISE EXCEPTION 'FAIL: ready deliveries missing from the rider pool';
  END IF;

  SELECT bool_or(
    t ? 'customerPhone'
    OR t ? 'customerName'
    OR t ? 'customerNotes'
    OR t ? 'deliveryAddressText'
    OR t ? 'handoverPin'
    OR t ? 'paymentReference'
  ) INTO v_leak
  FROM jsonb_array_elements(v_pool) t;
  IF coalesce(v_leak, false) THEN
    RAISE EXCEPTION 'FAIL: rider pool leaked customer contact, address, or PIN';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_pool) t
    WHERE (t->>'orderId')::uuid = v_a
      AND (t->>'itemCount')::int = 1
      AND (t->>'distanceKm')::numeric = 1.56
  ) THEN
    RAISE EXCEPTION 'FAIL: rider pool summary is missing item count or distance';
  END IF;

  v_active := public.claim_order_atomic(v_a);
  IF (v_active->>'orderId')::uuid <> v_a
     OR (v_active->>'status') <> 'CLAIMED'
     OR (v_active->>'customerPhone') IS NULL THEN
    RAISE EXCEPTION 'FAIL: claim did not return the rider active order: %', v_active;
  END IF;
  IF v_active ? 'handoverPin' THEN
    RAISE EXCEPTION 'FAIL: active order leaked the handover PIN';
  END IF;

  BEGIN
    PERFORM public.claim_order_atomic(v_b);
    RAISE EXCEPTION 'FAIL: a rider with an active delivery claimed another';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'RIDER_HAS_ACTIVE_ORDER%' THEN RAISE; END IF;
  END;

  -- Telemetry is refused until the trip is actually started.
  BEGIN
    PERFORM public.update_rider_telemetry(v_a, 0.3245, 32.5782);
    RAISE EXCEPTION 'FAIL: telemetry accepted before the trip started';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'ORDER_STATE_INVALID%' THEN RAISE; END IF;
  END;

  v_result := public.start_delivery(v_a);
  IF (v_result->>'status') <> 'OUT_FOR_DELIVERY' THEN
    RAISE EXCEPTION 'FAIL: start_delivery returned %', v_result->>'status';
  END IF;

  PERFORM public.update_rider_telemetry(v_a, 0.32450, 32.57820, 8, 90, 6.5);
  PERFORM public.update_rider_telemetry(v_a, 0.32455, 32.57825, 5, 95, 7.0);

  -- A far-away attempt is rejected before any PIN attempt is spent.
  v_result := public.verify_delivery_pin(v_a, '0000', 0.4, 32.7, 'ip-far', 'rider-test');
  IF (v_result->>'ok')::boolean
     OR (v_result->>'code') <> 'TOO_FAR_FROM_DESTINATION'
     OR (v_result->>'allowedM')::int <> 300 THEN
    RAISE EXCEPTION 'FAIL: geofence did not reject a far handover: %', v_result;
  END IF;

  v_result := public.verify_delivery_pin(v_a, '0000', 0.3245, 32.5782, 'ip-one', 'rider-test');
  IF (v_result->>'code') <> 'INVALID_HANDOVER_PIN'
     OR (v_result->>'remainingAttempts')::int <> 2 THEN
    RAISE EXCEPTION 'FAIL: first wrong PIN returned %', v_result;
  END IF;

  v_result := public.verify_delivery_pin(v_a, '0000', 0.3245, 32.5782, 'ip-one', 'rider-test');
  IF (v_result->>'code') <> 'INVALID_HANDOVER_PIN'
     OR (v_result->>'remainingAttempts')::int <> 1 THEN
    RAISE EXCEPTION 'FAIL: second wrong PIN returned %', v_result;
  END IF;

  v_result := public.verify_delivery_pin(v_a, '0000', 0.3245, 32.5782, 'ip-one', 'rider-test');
  IF (v_result->>'code') <> 'PIN_LOCKED'
     OR (v_result->>'remainingAttempts')::int <> 0
     OR (v_result->>'lockedUntil') IS NULL THEN
    RAISE EXCEPTION 'FAIL: third wrong PIN did not lock: %', v_result;
  END IF;

  v_result := public.verify_delivery_pin(v_a, '0000', 0.3245, 32.5782, 'ip-one', 'rider-test');
  IF (v_result->>'code') <> 'PIN_LOCKED' THEN
    RAISE EXCEPTION 'FAIL: locked order accepted another attempt: %', v_result;
  END IF;

  v_active := public.get_rider_active_order();
  IF (v_active->>'orderId')::uuid <> v_a
     OR (v_active->>'status') <> 'OUT_FOR_DELIVERY' THEN
    RAISE EXCEPTION 'FAIL: active order changed during the lockout: %', v_active;
  END IF;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Rider two: cross-rider isolation, release is not available after a start,
-- failed delivery, and a prepaid handover that never counts as cash.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-ddddddddd303', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_pool jsonb;
  v_active jsonb;
  v_result jsonb;
  v_a uuid := current_setting('test.order_a')::uuid;
  v_b uuid := current_setting('test.order_b')::uuid;
  v_c uuid := current_setting('test.order_c')::uuid;
BEGIN
  BEGIN
    PERFORM public.end_rider_shift();
    RAISE EXCEPTION 'FAIL: a rider without a shift closed one';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'SHIFT_NOT_OPEN%' THEN RAISE; END IF;
  END;

  v_pool := public.get_rider_pool();
  IF jsonb_array_length(v_pool) <> 2 THEN
    RAISE EXCEPTION 'FAIL: claimed delivery stayed in the pool (size %)', jsonb_array_length(v_pool);
  END IF;

  BEGIN
    PERFORM public.claim_order_atomic(v_a);
    RAISE EXCEPTION 'FAIL: another rider claimed an in-progress delivery';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'ORDER_ALREADY_CLAIMED%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.start_delivery(v_a);
    RAISE EXCEPTION 'FAIL: another rider started someone else''s trip';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'ORDER_STATE_INVALID%' THEN RAISE; END IF;
  END;

  v_active := public.claim_order_atomic(v_b);
  IF (v_active->>'orderId')::uuid <> v_b THEN
    RAISE EXCEPTION 'FAIL: rider two claimed the wrong order: %', v_active;
  END IF;

  v_active := public.get_rider_active_order();
  IF (v_active->>'orderId')::uuid <> v_b THEN
    RAISE EXCEPTION 'FAIL: rider two sees % instead of their own delivery', v_active;
  END IF;

  v_active := public.start_delivery(v_b);
  IF (v_active->>'status') <> 'OUT_FOR_DELIVERY' THEN
    RAISE EXCEPTION 'FAIL: rider two did not start the trip: %', v_active;
  END IF;

  PERFORM public.update_rider_telemetry(v_b, 0.35420, 32.61200);

  BEGIN
    PERFORM public.report_delivery_failed(
      v_b, 'DELIVERED'::public.delivery_outcome, 'Should be rejected', 0.3542, 32.612
    );
    RAISE EXCEPTION 'FAIL: failed-delivery RPC accepted DELIVERED';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'VALIDATION_ERROR%' THEN RAISE; END IF;
  END;

  v_result := public.report_delivery_failed(
    v_b,
    'CUSTOMER_UNREACHABLE'::public.delivery_outcome,
    'Customer did not answer the gate phone',
    0.3542,
    32.612
  );
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'FAIL: failed delivery was not recorded: %', v_result;
  END IF;

  IF public.get_rider_active_order() IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: failed delivery stayed active for the rider';
  END IF;

  BEGIN
    PERFORM public.verify_delivery_pin(v_b, '0000', 0.3542, 32.612, NULL, NULL);
    RAISE EXCEPTION 'FAIL: a failed delivery accepted a handover PIN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'ORDER_STATE_INVALID%' THEN RAISE; END IF;
  END;

  -- Prepaid handover: paid stays paid and no COD cash is expected.
  v_active := public.claim_order_atomic(v_c);
  IF (v_active->>'orderId')::uuid <> v_c
     OR (v_active->>'paymentStatus') <> 'PAID' THEN
    RAISE EXCEPTION 'FAIL: prepaid claim returned %', v_active;
  END IF;
  PERFORM public.start_delivery(v_c);

  v_result := public.verify_delivery_pin(
    v_c,
    current_setting('test.pin_c'),
    0.3246,
    32.5783,
    'ip-prepaid',
    'rider-test'
  );
  IF NOT coalesce((v_result->>'ok')::boolean, false)
     OR (v_result->>'code') <> 'DELIVERED'
     OR (v_result->>'changeDue') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: prepaid handover returned %', v_result;
  END IF;

  v_result := public.get_rider_cash_summary();
  IF (v_result->>'outstandingCash')::int <> 0
     OR (v_result->>'unsettledOrderCash')::int <> 0 THEN
    RAISE EXCEPTION 'FAIL: prepaid delivery counted as cash: %', v_result;
  END IF;

  BEGIN
    PERFORM public.get_rider_cash_summary(
      'dddddddd-dddd-4ddd-8ddd-ddddddddd302'
    );
    RAISE EXCEPTION 'FAIL: rider two read rider one''s cash summary';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;

  IF public.get_rider_active_order() IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: completed prepaid delivery stayed active';
  END IF;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Admin: PIN reset with a reason and the read-only cross-rider cash view.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-ddddddddd304', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_result jsonb;
  v_a uuid := current_setting('test.order_a')::uuid;
  v_c uuid := current_setting('test.order_c')::uuid;
BEGIN
  BEGIN
    PERFORM public.admin_reset_handover_pin(v_a, 'no');
    RAISE EXCEPTION 'FAIL: PIN reset accepted a short reason';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'VALIDATION_ERROR%' THEN RAISE; END IF;
  END;

  v_result := public.admin_reset_handover_pin(v_a, 'Customer could not read the original PIN');
  IF NOT coalesce((v_result->>'success')::boolean, false)
     OR (v_result->>'handoverPin') !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'FAIL: admin PIN reset returned %', v_result;
  END IF;
  PERFORM set_config('test.pin_a', v_result->>'handoverPin', true);

  BEGIN
    PERFORM public.admin_reset_handover_pin(v_c, 'Too late to reset');
    RAISE EXCEPTION 'FAIL: PIN reset accepted a delivered order';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'ORDER_STATE_INVALID%' THEN RAISE; END IF;
  END;

  v_result := public.get_rider_cash_summary(
    'dddddddd-dddd-4ddd-8ddd-ddddddddd302'
  );
  IF (v_result->>'outstandingCash')::int <> 0 THEN
    RAISE EXCEPTION 'FAIL: in-progress cash was counted before handover: %', v_result;
  END IF;

  BEGIN
    PERFORM public.get_rider_pool();
    RAISE EXCEPTION 'FAIL: admin read the rider pool';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.claim_order_atomic(v_a);
    RAISE EXCEPTION 'FAIL: admin claimed a delivery';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.get_rider_shift();
    RAISE EXCEPTION 'FAIL: admin read a rider shift';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Rider one finishes the cash delivery, then closes the shift.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-ddddddddd302', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_result jsonb;
  v_shift jsonb;
  v_a uuid := current_setting('test.order_a')::uuid;
BEGIN
  v_result := public.verify_delivery_pin(
    v_a,
    current_setting('test.pin_a'),
    0.3245,
    32.5782,
    'ip-final',
    'rider-test'
  );
  IF NOT coalesce((v_result->>'ok')::boolean, false)
     OR (v_result->>'code') <> 'DELIVERED'
     OR (v_result->>'changeDue')::int <> 15000 THEN
    RAISE EXCEPTION 'FAIL: reset PIN handover returned %', v_result;
  END IF;

  IF public.get_rider_active_order() IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: delivered order stayed active';
  END IF;

  v_result := public.get_rider_cash_summary();
  IF (v_result->>'outstandingCash')::int <> 35000
     OR (v_result->>'unsettledOrderCash')::int <> 35000
     OR (v_result->>'settlementShortfall')::int <> 0
     OR (v_result->>'totalSettled')::int <> 0 THEN
    RAISE EXCEPTION 'FAIL: cash summary after delivery is %', v_result;
  END IF;

  v_result := public.end_rider_shift();
  IF NOT coalesce((v_result->>'success')::boolean, false)
     OR (v_result->>'expectedCash')::int <> 35000 THEN
    RAISE EXCEPTION 'FAIL: end_rider_shift returned %', v_result;
  END IF;

  v_shift := public.get_rider_shift();
  IF (v_shift->>'isOpen')::boolean THEN
    RAISE EXCEPTION 'FAIL: closed shift still reports open: %', v_shift;
  END IF;

  BEGIN
    PERFORM public.end_rider_shift();
    RAISE EXCEPTION 'FAIL: a closed shift was closed twice';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'SHIFT_NOT_OPEN%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.verify_delivery_pin(v_a, '0000', 0.3245, 32.5782, NULL, NULL);
    RAISE EXCEPTION 'FAIL: a delivered order accepted another PIN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'ORDER_STATE_INVALID%' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Kitchen cannot use rider-only RPCs.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-ddddddddd301', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_a uuid := current_setting('test.order_a')::uuid;
BEGIN
  BEGIN
    PERFORM public.get_rider_pool();
    RAISE EXCEPTION 'FAIL: kitchen read the rider pool';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.get_rider_shift();
    RAISE EXCEPTION 'FAIL: kitchen read a rider shift';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.claim_order_atomic(v_a);
    RAISE EXCEPTION 'FAIL: kitchen claimed a delivery';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.admin_reset_handover_pin(v_a, 'Kitchen should not reset');
    RAISE EXCEPTION 'FAIL: kitchen reset a handover PIN';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Persisted evidence (superuser): telemetry is one latest row, attempts are
-- auditable, the failed delivery is recorded, and the shift stores cash.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_a uuid := current_setting('test.order_a')::uuid;
  v_b uuid := current_setting('test.order_b')::uuid;
  v_c uuid := current_setting('test.order_c')::uuid;
  v_rider uuid := 'dddddddd-dddd-4ddd-8ddd-ddddddddd302';
  v_count integer;
  v_status public.order_status;
  v_payment public.payment_status;
  v_lat numeric;
  v_lng numeric;
  v_shift public.rider_shifts%ROWTYPE;
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT count(*), max(latitude), max(longitude)
  INTO v_count, v_lat, v_lng
  FROM public.rider_telemetry
  WHERE rider_id = v_rider AND order_id = v_a;

  IF v_count <> 1
     OR v_lat <> 0.32455
     OR v_lng <> 32.57825 THEN
    RAISE EXCEPTION 'FAIL: telemetry is not one latest row (% / % / %)', v_count, v_lat, v_lng;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.pin_verification_attempts
  WHERE order_id = v_a AND rider_id = v_rider;
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'FAIL: expected 4 PIN attempts for order A, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.pin_verification_attempts
  WHERE order_id = v_a AND rider_id = v_rider AND success;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected one successful PIN attempt, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.delivery_attempts
  WHERE order_id = v_b AND rider_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddd303';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: failed delivery attempt was not recorded';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.admin_audit_log
  WHERE action = 'ADMIN_RESET_HANDOVER_PIN'
    AND entity_id = v_a::text
    AND actor_id = 'dddddddd-dddd-4ddd-8ddd-ddddddddd304';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: PIN reset was not audited';
  END IF;

  SELECT * INTO v_shift
  FROM public.rider_shifts
  WHERE rider_id = v_rider
  ORDER BY started_at DESC
  LIMIT 1;
  IF v_shift.status <> 'CLOSED'
     OR v_shift.expected_cash <> 35000
     OR v_shift.ended_at IS NULL THEN
    RAISE EXCEPTION 'FAIL: closed shift did not store expected cash: % / %', v_shift.status, v_shift.expected_cash;
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = v_a;
  IF v_order.order_status <> 'DELIVERED'
     OR v_order.payment_status <> 'PAID'
     OR v_order.cod_collected_at IS NULL
     OR v_order.rider_id <> v_rider THEN
    RAISE EXCEPTION 'FAIL: cash order A is not fully delivered: % / %', v_order.order_status, v_order.payment_status;
  END IF;

  SELECT order_status, payment_status
  INTO v_status, v_payment
  FROM public.orders WHERE id = v_b;
  IF v_status <> 'DELIVERY_FAILED' OR v_payment = 'PAID' THEN
    RAISE EXCEPTION 'FAIL: failed order B was marked delivered or paid: % / %', v_status, v_payment;
  END IF;

  SELECT order_status, payment_status
  INTO v_status, v_payment
  FROM public.orders WHERE id = v_c;
  IF v_status <> 'DELIVERED' OR v_payment <> 'PAID' THEN
    RAISE EXCEPTION 'FAIL: prepaid order C ended as % / %', v_status, v_payment;
  END IF;
END $$;

ROLLBACK;
