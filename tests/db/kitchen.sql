-- ============================================================================
-- Phase 8 - Kitchen board, 86, busy mode, intake pause, and reprint audit
-- ============================================================================
-- Run against a database with the full migration chain (including
-- 20261119000000_kitchen_reprint.sql) and seed applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/db/kitchen.sql
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
  ('dddddddd-dddd-4ddd-8ddd-ddddddddd201', 'kitchen-phase8@test.local'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddd202', 'admin-phase8@test.local'),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddd203', 'rider-phase8@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles
  (id, full_name, phone_number, role, is_active, must_change_pin)
VALUES
  ('dddddddd-dddd-4ddd-8ddd-ddddddddd201', 'Phase 8 Kitchen', '+256700900201', 'KITCHEN', true, false),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddd202', 'Phase 8 Admin', '+256700900202', 'ADMIN', true, false),
  ('dddddddd-dddd-4ddd-8ddd-ddddddddd203', 'Phase 8 Rider', '+256700900203', 'RIDER', true, false)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Privilege matrix
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.get_kitchen_orders()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can read the kitchen board';
  END IF;
  IF has_function_privilege('anon', 'public.accept_order(UUID)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can accept orders';
  END IF;
  IF has_function_privilege('anon', 'public.bump_order(UUID)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can bump orders';
  END IF;
  IF has_function_privilege('anon', 'public.set_kitchen_busy(BOOLEAN, INTEGER)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can change busy mode';
  END IF;
  IF has_function_privilege('anon', 'public.set_kitchen_paused(BOOLEAN)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can pause intake';
  END IF;
  IF has_function_privilege('anon', 'public.set_menu_item_availability(UUID, BOOLEAN)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can change stock';
  END IF;
  IF has_function_privilege('anon', 'public.audit_kitchen_reprint(UUID)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can write reprint audits';
  END IF;

  IF NOT has_function_privilege('authenticated', 'public.get_kitchen_orders()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated cannot call get_kitchen_orders';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.audit_kitchen_reprint(UUID)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated cannot call audit_kitchen_reprint';
  END IF;

  IF has_table_privilege('authenticated', 'public.orders', 'SELECT') THEN
    RAISE EXCEPTION 'FAIL: authenticated can read the orders table directly';
  END IF;
END $$;

CREATE TEMP TABLE k_ids (label TEXT PRIMARY KEY, id UUID NOT NULL);

-- ---------------------------------------------------------------------------
-- Order fixtures. A and B are cash (CONFIRMED_UNPAID); C is unpaid digital
-- (PENDING_PAYMENT, not a kitchen ticket); D is cash dine-in.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r jsonb;
BEGIN
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '11111111-1111-4111-8111-0000000000a1',
    'requestHash', 'hash-kitchen-a',
    'customerName', 'Kitchen COD A',
    'customerPhone', '0772950001',
    'orderType', 'DELIVERY',
    'deliveryAddressText', 'Nakasero Plot 12',
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

  INSERT INTO k_ids VALUES ('a', (r->>'orderId')::uuid);
  INSERT INTO k_ids VALUES ('a_token', (r->>'orderToken')::uuid);
END $$;

DO $$
DECLARE
  r jsonb;
BEGIN
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '11111111-1111-4111-8111-0000000000b1',
    'requestHash', 'hash-kitchen-b',
    'customerName', 'Kitchen COD B',
    'customerPhone', '0772950002',
    'orderType', 'DELIVERY',
    'deliveryAddressText', 'Ntinda',
    'deliveryLatitude', 0.3542,
    'deliveryLongitude', 32.612,
    'roadDistanceM', 8093,
    'estimatedTravelMinutes', 9,
    'paymentMethod', 'CASH_ON_DELIVERY',
    'codChangeRequestedFor', 50000,
    'items', jsonb_build_array(
      jsonb_build_object('menuItemId', '22222222-2222-4222-8222-222222222203', 'quantity', 1),
      jsonb_build_object('menuItemId', '22222222-2222-4222-8222-222222222210', 'quantity', 1)
    )
  ));

  IF (r->>'orderStatus') <> 'CONFIRMED_UNPAID' THEN
    RAISE EXCEPTION 'FAIL: COD order B status %', r->>'orderStatus';
  END IF;

  INSERT INTO k_ids VALUES ('b', (r->>'orderId')::uuid);
END $$;

DO $$
DECLARE
  r jsonb;
BEGIN
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '11111111-1111-4111-8111-0000000000c1',
    'requestHash', 'hash-kitchen-c',
    'customerName', 'Kitchen Prepaid C',
    'customerPhone', '0772950003',
    'orderType', 'DELIVERY',
    'deliveryAddressText', 'Nakasero Plot 14',
    'deliveryLatitude', 0.3245,
    'deliveryLongitude', 32.5782,
    'roadDistanceM', 1562,
    'estimatedTravelMinutes', 4,
    'paymentMethod', 'MTN_MOMO',
    'items', jsonb_build_array(
      jsonb_build_object('menuItemId', '22222222-2222-4222-8222-222222222201', 'quantity', 1,
        'modifiers', jsonb_build_array(
          jsonb_build_object('modifierId', '44444444-4444-4444-8444-444444444401'),
          jsonb_build_object('comboOptionId', '66666666-6666-4666-8666-666666666601'),
          jsonb_build_object('comboOptionId', '66666666-6666-4666-8666-666666666603')
        )
      )
    )
  ));

  IF (r->>'orderStatus') <> 'PENDING_PAYMENT' THEN
    RAISE EXCEPTION 'FAIL: prepaid order C status %', r->>'orderStatus';
  END IF;

  INSERT INTO k_ids VALUES ('c', (r->>'orderId')::uuid);
END $$;

DO $$
DECLARE
  r jsonb;
BEGIN
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '11111111-1111-4111-8111-0000000000d1',
    'requestHash', 'hash-kitchen-d',
    'customerName', 'Kitchen Dine In D',
    'customerPhone', '0772950004',
    'orderType', 'DINE_IN',
    'tableId', '77777777-7777-4777-8777-777777777704',
    'paymentMethod', 'CASH_ON_DELIVERY',
    'items', jsonb_build_array(
      jsonb_build_object('menuItemId', '22222222-2222-4222-8222-222222222205', 'quantity', 1)
    )
  ));

  IF (r->>'totalAmount')::int <> 8000 THEN
    RAISE EXCEPTION 'FAIL: dine-in order D total %', r->>'totalAmount';
  END IF;

  INSERT INTO k_ids VALUES ('d', (r->>'orderId')::uuid);
END $$;

SELECT set_config('test.order_a', (SELECT id::text FROM k_ids WHERE label = 'a'), true);
SELECT set_config('test.order_b', (SELECT id::text FROM k_ids WHERE label = 'b'), true);
SELECT set_config('test.order_c', (SELECT id::text FROM k_ids WHERE label = 'c'), true);
SELECT set_config('test.order_d', (SELECT id::text FROM k_ids WHERE label = 'd'), true);

-- ---------------------------------------------------------------------------
-- Kitchen reads and the accept/bump state machine.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-ddddddddd201', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_orders jsonb;
  v_leak boolean;
  v_result jsonb;
  v_a uuid := current_setting('test.order_a')::uuid;
  v_b uuid := current_setting('test.order_b')::uuid;
  v_c uuid := current_setting('test.order_c')::uuid;
  v_d uuid := current_setting('test.order_d')::uuid;
BEGIN
  v_orders := public.get_kitchen_orders();

  IF jsonb_array_length(v_orders) <> 3 THEN
    RAISE EXCEPTION 'FAIL: kitchen board has % tickets, expected 3', jsonb_array_length(v_orders);
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_orders) t WHERE (t->>'orderId')::uuid = v_c
  ) THEN
    RAISE EXCEPTION 'FAIL: unpaid digital order is on the kitchen board';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_orders) t WHERE (t->>'orderId')::uuid = v_a
  ) OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_orders) t WHERE (t->>'orderId')::uuid = v_b
  ) OR NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_orders) t WHERE (t->>'orderId')::uuid = v_d
  ) THEN
    RAISE EXCEPTION 'FAIL: active COD orders missing from the kitchen board';
  END IF;

  SELECT bool_or(t ? 'customerPhone' OR t ? 'handoverPin' OR t ? 'paymentReference')
  INTO v_leak
  FROM jsonb_array_elements(v_orders) t;
  IF coalesce(v_leak, false) THEN
    RAISE EXCEPTION 'FAIL: kitchen board leaked phone, PIN, or payment reference';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_orders) t
    WHERE (t->>'orderId')::uuid = v_a
      AND jsonb_array_length(coalesce(t->'items', '[]'::jsonb)) > 0
      AND t->'items'->0 ? 'name'
  ) THEN
    RAISE EXCEPTION 'FAIL: kitchen ticket is missing item snapshots';
  END IF;

  -- Accept COD B and acknowledge it.
  v_result := public.accept_order(v_b);
  IF (v_result->>'status') <> 'PREPARING' THEN
    RAISE EXCEPTION 'FAIL: accept_order returned %', v_result->>'status';
  END IF;

  SELECT jsonb_agg(t) INTO v_orders
  FROM jsonb_array_elements(public.get_kitchen_orders()) t
  WHERE (t->>'orderId')::uuid = v_b;

  IF (v_orders->0->>'status') <> 'PREPARING'
     OR (v_orders->0->>'acknowledgedAt') IS NULL THEN
    RAISE EXCEPTION 'FAIL: accepted ticket not acknowledged: %', v_orders->0;
  END IF;

  BEGIN
    PERFORM public.accept_order(v_b);
    RAISE EXCEPTION 'FAIL: second accept succeeded';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'ORDER_STATE_INVALID%' THEN RAISE; END IF;
  END;

  -- Bump only applies to PREPARING.
  BEGIN
    PERFORM public.bump_order(v_a);
    RAISE EXCEPTION 'FAIL: bump accepted an unpaid ticket';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'ORDER_STATE_INVALID%' THEN RAISE; END IF;
  END;

  v_result := public.bump_order(v_b);
  IF (v_result->>'status') <> 'READY_FOR_PICKUP' THEN
    RAISE EXCEPTION 'FAIL: delivery bump returned %', v_result->>'status';
  END IF;

  -- Dine-in bumps straight to DELIVERED and leaves the board.
  PERFORM public.accept_order(v_d);
  v_result := public.bump_order(v_d);
  IF (v_result->>'status') <> 'DELIVERED' THEN
    RAISE EXCEPTION 'FAIL: dine-in bump returned %', v_result->>'status';
  END IF;

  IF jsonb_array_length(public.get_kitchen_orders()) <> 2 THEN
    RAISE EXCEPTION 'FAIL: delivered dine-in ticket stayed on the board';
  END IF;
END $$;

-- Snapshot the two remaining active tickets so busy/pause/86 can be proven not
-- to mutate existing orders.
DO $$
DECLARE
  v_snapshot text;
  v_a uuid := current_setting('test.order_a')::uuid;
  v_b uuid := current_setting('test.order_b')::uuid;
BEGIN
  SELECT jsonb_agg(t ORDER BY t->>'orderId')::text INTO v_snapshot
  FROM jsonb_array_elements(public.get_kitchen_orders()) t
  WHERE (t->>'orderId')::uuid IN (v_a, v_b);

  PERFORM set_config('test.existing_board', v_snapshot, true);
END $$;

-- 86 propagates to the menu and is audited; existing tickets keep their items.
DO $$
DECLARE
  v_result jsonb;
  v_available boolean;
  v_state text;
BEGIN
  v_result := public.set_menu_item_availability(
    '22222222-2222-4222-8222-222222222201', false
  );
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'FAIL: 86 toggle failed: %', v_result;
  END IF;

  SELECT is_available INTO v_available
  FROM public.menu_items
  WHERE id = '22222222-2222-4222-8222-222222222201';
  IF v_available IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: 86 toggle did not hide the item';
  END IF;

  BEGIN
    PERFORM public.set_menu_item_availability(
      '99999999-9999-4999-8999-999999999999', true
    );
    RAISE EXCEPTION 'FAIL: unknown menu item accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'ITEM_NOT_FOUND%' THEN RAISE; END IF;
  END;

  PERFORM public.set_menu_item_availability(
    '22222222-2222-4222-8222-222222222201', true
  );

  SELECT is_available INTO v_available
  FROM public.menu_items
  WHERE id = '22222222-2222-4222-8222-222222222201';
  IF v_available IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FAIL: 86 restore did not make the item available';
  END IF;

  SELECT jsonb_agg(t ORDER BY t->>'orderId')::text INTO v_state
  FROM jsonb_array_elements(public.get_kitchen_orders()) t
  WHERE (t->>'orderId')::uuid IN (
    current_setting('test.order_a')::uuid,
    current_setting('test.order_b')::uuid
  );
  IF v_state IS DISTINCT FROM current_setting('test.existing_board') THEN
    RAISE EXCEPTION 'FAIL: 86 changed an existing kitchen ticket';
  END IF;
END $$;

-- Busy mode audits, applies to new orders, and leaves existing tickets alone.
DO $$
DECLARE
  v_settings jsonb;
  v_board text;
BEGIN
  PERFORM public.set_kitchen_busy(true, 30);

  v_settings := public.get_public_settings();
  IF NOT (v_settings->>'isKitchenBusy')::boolean
     OR (v_settings->>'busyBufferMinutes')::int <> 30 THEN
    RAISE EXCEPTION 'FAIL: busy mode did not persist: %', v_settings;
  END IF;

  SELECT jsonb_agg(t ORDER BY t->>'orderId')::text INTO v_board
  FROM jsonb_array_elements(public.get_kitchen_orders()) t
  WHERE (t->>'orderId')::uuid IN (
    current_setting('test.order_a')::uuid,
    current_setting('test.order_b')::uuid
  );
  IF v_board IS DISTINCT FROM current_setting('test.existing_board') THEN
    RAISE EXCEPTION 'FAIL: busy mode changed an existing kitchen ticket';
  END IF;
END $$;

RESET ROLE;

-- Sold-out items are rejected when a new order is created (create_order is
-- service-role only, so this runs as the superuser test harness).
UPDATE public.menu_items
SET is_available = false
WHERE id = '22222222-2222-4222-8222-222222222201';

DO $$
BEGIN
  BEGIN
    PERFORM public.create_order(jsonb_build_object(
      'idempotencyKey', '11111111-1111-4111-8111-0000000000e1',
      'requestHash', 'hash-sold-out',
      'customerName', 'Kitchen Sold Out',
      'customerPhone', '0772950005',
      'orderType', 'DINE_IN',
      'tableId', '77777777-7777-4777-8777-777777777704',
      'paymentMethod', 'CASH_ON_DELIVERY',
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
    RAISE EXCEPTION 'FAIL: sold-out item accepted into a new order';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'ITEM_OUT_OF_STOCK%' THEN RAISE; END IF;
  END;
END $$;

UPDATE public.menu_items
SET is_available = true
WHERE id = '22222222-2222-4222-8222-222222222201';

-- A new order created while busy records the buffer for the kitchen.
DO $$
DECLARE
  r jsonb;
  v_buffer integer;
BEGIN
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '11111111-1111-4111-8111-0000000000f1',
    'requestHash', 'hash-busy-new',
    'customerName', 'Kitchen Busy New',
    'customerPhone', '0772950006',
    'orderType', 'DELIVERY',
    'deliveryAddressText', 'Nakasero Plot 16',
    'deliveryLatitude', 0.3245,
    'deliveryLongitude', 32.5782,
    'roadDistanceM', 1562,
    'estimatedTravelMinutes', 4,
    'paymentMethod', 'CASH_ON_DELIVERY',
    'items', jsonb_build_array(
      jsonb_build_object('menuItemId', '22222222-2222-4222-8222-222222222201', 'quantity', 1,
        'modifiers', jsonb_build_array(
          jsonb_build_object('modifierId', '44444444-4444-4444-8444-444444444401'),
          jsonb_build_object('comboOptionId', '66666666-6666-4666-8666-666666666601'),
          jsonb_build_object('comboOptionId', '66666666-6666-4666-8666-666666666603')
        )
      )
    )
  ));

  SELECT kitchen_busy_buffer_applied INTO v_buffer
  FROM public.orders WHERE id = (r->>'orderId')::uuid;

  IF v_buffer <> 30 THEN
    RAISE EXCEPTION 'FAIL: new order busy buffer is %, expected 30', v_buffer;
  END IF;

  INSERT INTO k_ids VALUES ('busy_new', (r->>'orderId')::uuid);
  PERFORM set_config('test.order_busy_new', (r->>'orderId')::text, true);
END $$;

SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-ddddddddd201', true);
SET LOCAL ROLE authenticated;

-- Intake pause audits, is visible in settings, and leaves existing tickets alone.
DO $$
DECLARE
  v_settings jsonb;
  v_board text;
BEGIN
  PERFORM public.set_kitchen_paused(true);

  v_settings := public.get_public_settings();
  IF NOT (v_settings->>'isKitchenPaused')::boolean THEN
    RAISE EXCEPTION 'FAIL: intake pause did not persist';
  END IF;

  SELECT jsonb_agg(t ORDER BY t->>'orderId')::text INTO v_board
  FROM jsonb_array_elements(public.get_kitchen_orders()) t
  WHERE (t->>'orderId')::uuid IN (
    current_setting('test.order_a')::uuid,
    current_setting('test.order_b')::uuid
  );
  IF v_board IS DISTINCT FROM current_setting('test.existing_board') THEN
    RAISE EXCEPTION 'FAIL: intake pause changed an existing kitchen ticket';
  END IF;

  PERFORM public.set_kitchen_paused(false);
  PERFORM public.set_kitchen_busy(false, 20);

  v_settings := public.get_public_settings();
  IF (v_settings->>'isKitchenPaused')::boolean
     OR (v_settings->>'isKitchenBusy')::boolean
     OR (v_settings->>'busyBufferMinutes')::int <> 20 THEN
    RAISE EXCEPTION 'FAIL: kitchen settings were not restored: %', v_settings;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Reprint audit
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.audit_kitchen_reprint(current_setting('test.order_a')::uuid);
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'FAIL: reprint audit returned %', v_result;
  END IF;

  BEGIN
    PERFORM public.audit_kitchen_reprint('99999999-9999-4999-8999-999999999999');
    RAISE EXCEPTION 'FAIL: reprint audit accepted an unknown order';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'ORDER_NOT_FOUND%' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Admin can read the board; riders cannot use any kitchen action.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-ddddddddd202', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF jsonb_array_length(public.get_kitchen_orders()) < 1 THEN
    RAISE EXCEPTION 'FAIL: admin can no longer read the kitchen board';
  END IF;
END $$;

RESET ROLE;

SELECT set_config('request.jwt.claim.sub', 'dddddddd-dddd-4ddd-8ddd-ddddddddd203', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_a uuid := current_setting('test.order_a')::uuid;
BEGIN
  BEGIN
    PERFORM public.get_kitchen_orders();
    RAISE EXCEPTION 'FAIL: rider can read the kitchen board';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.accept_order(v_a);
    RAISE EXCEPTION 'FAIL: rider can accept orders';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.bump_order(v_a);
    RAISE EXCEPTION 'FAIL: rider can bump orders';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.set_kitchen_busy(true, 30);
    RAISE EXCEPTION 'FAIL: rider can change busy mode';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.set_kitchen_paused(true);
    RAISE EXCEPTION 'FAIL: rider can pause intake';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.set_menu_item_availability(
      '22222222-2222-4222-8222-222222222201', false
    );
    RAISE EXCEPTION 'FAIL: rider can change stock';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.audit_kitchen_reprint(v_a);
    RAISE EXCEPTION 'FAIL: rider can write reprint audits';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Audit trail completeness (superuser).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
  v_a uuid := current_setting('test.order_a')::uuid;
  v_actor uuid := 'dddddddd-dddd-4ddd-8ddd-ddddddddd201';
BEGIN
  SELECT count(*) INTO v_count
  FROM public.admin_audit_log
  WHERE action = 'KITCHEN_ACCEPT_ORDER' AND actor_id = v_actor;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: expected 2 kitchen accepts, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.admin_audit_log
  WHERE action = 'KITCHEN_BUMP_ORDER' AND actor_id = v_actor;
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'FAIL: expected 2 kitchen bumps, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.admin_audit_log
  WHERE action = 'SET_ITEM_AVAILABILITY' AND actor_id = v_actor;
  IF v_count < 2 THEN
    RAISE EXCEPTION 'FAIL: expected item availability audits, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.admin_audit_log
  WHERE action = 'SET_KITCHEN_BUSY' AND actor_id = v_actor;
  IF v_count < 2 THEN
    RAISE EXCEPTION 'FAIL: expected busy-mode audits, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.admin_audit_log
  WHERE action = 'SET_KITCHEN_PAUSED' AND actor_id = v_actor;
  IF v_count < 2 THEN
    RAISE EXCEPTION 'FAIL: expected intake-pause audits, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count
  FROM public.admin_audit_log
  WHERE action = 'KITCHEN_REPRINT_DOCKET'
    AND actor_id = v_actor
    AND entity_id = v_a::text;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected one reprint audit, found %', v_count;
  END IF;
END $$;

ROLLBACK;
