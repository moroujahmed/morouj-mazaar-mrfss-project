-- ============================================================================
-- Phase 10 - Admin Hub: audited actions, settings history, last-admin guard,
-- redelivery reset, refunds on paid cancellation, and the canonical
-- USh 65,500 ledger (38,000 + 27,500) with an updating second settlement.
-- ============================================================================
-- Run against a database with the full migration chain and seed applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/db/admin.sql
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
-- Staff fixtures. Exactly one active admin so LAST_ADMIN_PROTECTED is testable.
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email) VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeee401', 'admin-phase10@test.local'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeee402', 'rider-phase10@test.local'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeee403', 'kitchen-phase10@test.local')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.profiles
  (id, full_name, phone_number, role, is_active, must_change_pin, motorcycle_plate)
VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeee401', 'Phase 10 Admin', '+256700910401', 'ADMIN', true, false, NULL),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeee402', 'Phase 10 Rider', '+256700910402', 'RIDER', true, false, 'UFD 342B'),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeee403', 'Phase 10 Kitchen', '+256700910403', 'KITCHEN', true, false, NULL)
ON CONFLICT (id) DO UPDATE
  SET role = EXCLUDED.role,
      is_active = true,
      motorcycle_plate = EXCLUDED.motorcycle_plate;

-- ---------------------------------------------------------------------------
-- Privilege matrix: admin RPCs are never executable by anon, and never usable
-- by a non-admin authenticated role even when called directly.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_fn TEXT;
  v_admin_fns TEXT[] := ARRAY[
    'public.admin_list_orders(text,text,integer,integer)',
    'public.admin_get_order(UUID)',
    'public.admin_update_order_contact(uuid,text,text,text,text,text,numeric,numeric,integer,integer,text)',
    'public.admin_cancel_order(UUID, TEXT)',
    'public.admin_reset_handover_pin(UUID, TEXT)',
    'public.admin_redeliver_order(UUID, TEXT, UUID)',
    'public.admin_update_settings(JSONB, TEXT)',
    'public.admin_upsert_category(JSONB, TEXT)',
    'public.admin_upsert_menu_item(JSONB, TEXT)',
    'public.admin_upsert_table(JSONB, TEXT)',
    'public.admin_update_staff(UUID, public.user_role, BOOLEAN, TEXT, TEXT)',
    'public.admin_approve_refund(UUID, TEXT, TEXT)',
    'public.get_admin_ledger(DATE)',
    'public.get_admin_analytics(DATE, DATE)',
    'public.admin_get_audit_feed(INTEGER, INTEGER, TEXT)',
    'public.reconcile_rider_cash(UUID, INTEGER, TEXT, DATE)'
  ];
BEGIN
  FOREACH v_fn IN ARRAY v_admin_fns LOOP
    IF has_function_privilege('anon', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: anon can execute %', v_fn;
    END IF;
    IF NOT has_function_privilege('authenticated', v_fn, 'EXECUTE') THEN
      RAISE EXCEPTION 'FAIL: authenticated cannot execute %', v_fn;
    END IF;
  END LOOP;

  IF NOT has_table_privilege('authenticated', 'public.admin_audit_log', 'SELECT')
     AND NOT EXISTS (
       SELECT 1 FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public' AND c.relname = 'admin_audit_log'
     ) THEN
    RAISE EXCEPTION 'FAIL: admin_audit_log missing';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Canonical order fixtures.
--   #1043 = 26,000 Smoked Beef Luwombo + 5,000 juice + 1,000 packaging
--           + 6,000 delivery (8,093 m) = 38,000 COD.
--   #1047 = 24,000 Chicken Luwombo + 1,000 Extra Chili Sauce + 1,000 packaging
--           + 1,500 delivery (5,500 m) = 27,500 COD.
-- Total = 65,500. These recipes are the documented canonical fixtures, not
-- invented totals (docs/AUDIT_REPORT.md § canonical #1047, CANONICAL_EXAMPLES §7).
-- ---------------------------------------------------------------------------
CREATE TEMP TABLE a_ids (label TEXT PRIMARY KEY, id UUID NOT NULL);

DO $$
DECLARE
  r jsonb;
BEGIN
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', 'eeeeeeee-eeee-4eee-8eee-000000000001',
    'requestHash', 'hash-admin-1043',
    'customerName', 'Admin Ledger 1043',
    'customerPhone', '0772910101',
    'orderType', 'DELIVERY',
    'deliveryAddressText', 'Ntinda Shopping Centre',
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
  IF (r->>'totalAmount')::int <> 38000 THEN
    RAISE EXCEPTION 'FAIL: #1043 total %, expected 38000', r->>'totalAmount';
  END IF;
  INSERT INTO a_ids VALUES ('1043', (r->>'orderId')::uuid);

  r := public.create_order(jsonb_build_object(
    'idempotencyKey', 'eeeeeeee-eeee-4eee-8eee-000000000002',
    'requestHash', 'hash-admin-1047',
    'customerName', 'Admin Ledger 1047',
    'customerPhone', '0772910102',
    'orderType', 'DELIVERY',
    'deliveryAddressText', 'Nakasero Plot 8',
    'deliveryLatitude', 0.3301,
    'deliveryLongitude', 32.5842,
    'roadDistanceM', 5500,
    'estimatedTravelMinutes', 6,
    'paymentMethod', 'CASH_ON_DELIVERY',
    'codChangeRequestedFor', 30000,
    'items', jsonb_build_array(
      jsonb_build_object(
        'menuItemId', '22222222-2222-4222-8222-222222222204',
        'quantity', 1,
        'modifiers', jsonb_build_array(
          jsonb_build_object('modifierId', '44444444-4444-4444-8444-444444444402')
        )
      )
    )
  ));
  IF (r->>'totalAmount')::int <> 27500 THEN
    RAISE EXCEPTION 'FAIL: #1047 total %, expected 27500', r->>'totalAmount';
  END IF;
  INSERT INTO a_ids VALUES ('1047', (r->>'orderId')::uuid);

  -- A prepaid PAID order that is still cancellable (refund-on-cancel case).
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', 'eeeeeeee-eeee-4eee-8eee-000000000003',
    'requestHash', 'hash-admin-paid',
    'customerName', 'Admin Paid Cancel',
    'customerPhone', '0772910103',
    'orderType', 'DELIVERY',
    'deliveryAddressText', 'Kampala Road 1',
    'deliveryLatitude', 0.316,
    'deliveryLongitude', 32.581,
    'roadDistanceM', 1200,
    'estimatedTravelMinutes', 3,
    'paymentMethod', 'MTN_MOMO',
    'items', jsonb_build_array(
      jsonb_build_object('menuItemId', '22222222-2222-4222-8222-222222222205', 'quantity', 3)
    )
  ));
  INSERT INTO a_ids VALUES ('paid', (r->>'orderId')::uuid);

  -- An unpaid COD control: cancelling it must not create a refund.
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', 'eeeeeeee-eeee-4eee-8eee-000000000004',
    'requestHash', 'hash-admin-unpaid',
    'customerName', 'Admin Unpaid Cancel',
    'customerPhone', '0772910104',
    'orderType', 'DELIVERY',
    'deliveryAddressText', 'Kampala Road 2',
    'deliveryLatitude', 0.317,
    'deliveryLongitude', 32.582,
    'roadDistanceM', 1200,
    'estimatedTravelMinutes', 3,
    'paymentMethod', 'CASH_ON_DELIVERY',
    'items', jsonb_build_array(
      jsonb_build_object('menuItemId', '22222222-2222-4222-8222-222222222205', 'quantity', 3)
    )
  ));
  INSERT INTO a_ids VALUES ('unpaid', (r->>'orderId')::uuid);

  -- An order that fails delivery, for the redelivery state-reset test.
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', 'eeeeeeee-eeee-4eee-8eee-000000000005',
    'requestHash', 'hash-admin-redeliver',
    'customerName', 'Admin Redeliver',
    'customerPhone', '0772910105',
    'orderType', 'DELIVERY',
    'deliveryAddressText', 'Kampala Road 3',
    'deliveryLatitude', 0.318,
    'deliveryLongitude', 32.583,
    'roadDistanceM', 1200,
    'estimatedTravelMinutes', 3,
    'paymentMethod', 'CASH_ON_DELIVERY',
    'items', jsonb_build_array(
      jsonb_build_object('menuItemId', '22222222-2222-4222-8222-222222222205', 'quantity', 3)
    )
  ));
  INSERT INTO a_ids VALUES ('redeliver', (r->>'orderId')::uuid);
END $$;

-- Kitchen hand-off and rider delivery of the two cash orders. Status changes
-- follow the documented transition graph; payment is captured on delivery.
-- The second order is claimed only after the first is delivered: the DB
-- enforces one active order per rider (orders_one_active_per_rider).
DO $$
DECLARE
  v_label text;
  v_id uuid;
BEGIN
  FOREACH v_label IN ARRAY ARRAY['1043', '1047'] LOOP
    SELECT id INTO v_id FROM a_ids WHERE label = v_label;

    UPDATE public.orders SET order_status = 'PREPARING' WHERE id = v_id;
    UPDATE public.orders SET order_status = 'READY_FOR_PICKUP' WHERE id = v_id;
    UPDATE public.orders
    SET order_status = 'CLAIMED', rider_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee402'
    WHERE id = v_id;
    UPDATE public.orders SET order_status = 'OUT_FOR_DELIVERY' WHERE id = v_id;
    UPDATE public.orders
    SET order_status = 'DELIVERED',
        payment_status = 'PAID',
        delivered_at = '2026-11-20 12:00:00+03'::timestamptz
    WHERE id = v_id;
  END LOOP;
END $$;

-- The prepaid order is PAID but not terminal (service role after payment).
UPDATE public.orders
SET payment_status = 'PAID', order_status = 'PREPARING'
WHERE id = (SELECT id FROM a_ids WHERE label = 'paid');

-- The redelivery order reaches DELIVERY_FAILED with dirty PIN/security state.
UPDATE public.orders
SET order_status = 'PREPARING'
WHERE id = (SELECT id FROM a_ids WHERE label = 'redeliver');
UPDATE public.orders
SET order_status = 'READY_FOR_PICKUP'
WHERE id = (SELECT id FROM a_ids WHERE label = 'redeliver');
UPDATE public.orders
SET order_status = 'CLAIMED', rider_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee402'
WHERE id = (SELECT id FROM a_ids WHERE label = 'redeliver');
UPDATE public.orders
SET order_status = 'OUT_FOR_DELIVERY'
WHERE id = (SELECT id FROM a_ids WHERE label = 'redeliver');
UPDATE public.orders
SET order_status = 'DELIVERY_FAILED',
    security_flag = 'SUSPECT_PIN',
    failed_pin_attempts = 2,
    pin_locked_until = '2099-01-01 00:00:00+03'::timestamptz
WHERE id = (SELECT id FROM a_ids WHERE label = 'redeliver');

DO $$
BEGIN
  IF (SELECT count(*) FROM public.orders
      WHERE id IN (SELECT id FROM a_ids WHERE label IN ('1043', '1047'))
        AND order_status = 'DELIVERED' AND payment_status = 'PAID') <> 2 THEN
    RAISE EXCEPTION 'FAIL: cash orders were not delivered and paid';
  END IF;
  IF (SELECT count(*) FROM a_ids) <> 5 THEN
    RAISE EXCEPTION 'FAIL: order fixtures missing';
  END IF;
END $$;

-- Expose the fixture ids through GUCs: the temporary table is owned by the
-- superuser and is not readable while running as the authenticated role.
SELECT set_config('test.order_1043', (SELECT id::text FROM a_ids WHERE label = '1043'), true);
SELECT set_config('test.order_1047', (SELECT id::text FROM a_ids WHERE label = '1047'), true);
SELECT set_config('test.order_paid', (SELECT id::text FROM a_ids WHERE label = 'paid'), true);
SELECT set_config('test.order_unpaid', (SELECT id::text FROM a_ids WHERE label = 'unpaid'), true);
SELECT set_config('test.order_redeliver', (SELECT id::text FROM a_ids WHERE label = 'redeliver'), true);

-- ---------------------------------------------------------------------------
-- Non-admin authentication cannot use any admin RPC.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee402', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_id uuid := current_setting('test.order_1043')::uuid;
BEGIN
  BEGIN
    PERFORM public.admin_list_orders();
    RAISE EXCEPTION 'FAIL: rider read the admin order list';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.admin_cancel_order(v_id, 'Rider attempted cancel');
    RAISE EXCEPTION 'FAIL: rider cancelled an order';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.admin_update_settings('{"maxCartLines": 40}'::jsonb, 'Rider attempted settings edit');
    RAISE EXCEPTION 'FAIL: rider edited settings';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.admin_get_audit_feed();
    RAISE EXCEPTION 'FAIL: rider read the audit feed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.reconcile_rider_cash(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeee402', 65500, 'Rider tried to settle', DATE '2026-11-20'
    );
    RAISE EXCEPTION 'FAIL: rider reconciled cash';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'AUTH_UNAUTHORIZED%' THEN RAISE; END IF;
  END;
END $$;

RESET ROLE;

-- ---------------------------------------------------------------------------
-- Admin session. Every mutation below must leave an admin_audit_log row.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee401', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_list jsonb;
  v_detail jsonb;
  v_result jsonb;
  v_refund uuid;
  v_order uuid := current_setting('test.order_paid')::uuid;
  v_unpaid uuid := current_setting('test.order_unpaid')::uuid;
  v_delivered uuid := current_setting('test.order_1043')::uuid;
  v_failed uuid := current_setting('test.order_redeliver')::uuid;
  v_feed jsonb;
BEGIN
  -- Order list and detail.
  v_list := public.admin_list_orders(NULL, 'Admin Ledger', 50, 0);
  IF (v_list->>'total')::int <> 2 THEN
    RAISE EXCEPTION 'FAIL: admin order search returned %', v_list->>'total';
  END IF;
  v_detail := public.admin_get_order(v_delivered);
  IF v_detail->>'totalAmount' <> '38000' OR v_detail->>'status' <> 'DELIVERED' THEN
    RAISE EXCEPTION 'FAIL: admin order detail %', v_detail;
  END IF;

  -- Contact edit: short reason rejected; valid edit changes only the requested
  -- fields and writes an audit row.
  BEGIN
    PERFORM public.admin_update_order_contact(v_order, 'Bad Reason', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'no');
    RAISE EXCEPTION 'FAIL: contact edit accepted a short reason';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'VALIDATION_ERROR%' THEN RAISE; END IF;
  END;
  v_result := public.admin_update_order_contact(
    v_order, 'Admin Paid Cancel Updated', NULL, 'Called to confirm', NULL, NULL, NULL, NULL, NULL, NULL,
    'Customer asked for a name correction'
  );
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'FAIL: contact edit %', v_result;
  END IF;
  v_feed := public.admin_get_audit_feed(50, 0, 'orders');
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_feed->'events') e
                 WHERE e->>'action' = 'ADMIN_UPDATE_ORDER_CONTACT'
                   AND e->>'reason' = 'Customer asked for a name correction') THEN
    RAISE EXCEPTION 'FAIL: contact edit audit row missing';
  END IF;

  BEGIN
    PERFORM public.admin_update_order_contact(v_delivered, 'Too Late', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Delivered order edit');
    RAISE EXCEPTION 'FAIL: delivered order contact was editable';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'ORDER_STATE_INVALID%' THEN RAISE; END IF;
  END;

  -- Paid cancellation creates a refund; unpaid cancellation does not.
  BEGIN
    PERFORM public.admin_cancel_order(v_order, 'no');
    RAISE EXCEPTION 'FAIL: cancel accepted a short reason';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'VALIDATION_ERROR%' THEN RAISE; END IF;
  END;
  v_result := public.admin_cancel_order(v_order, 'Customer cancelled after payment');
  v_refund := (v_result->>'refundId')::uuid;
  IF v_refund IS NULL THEN
    RAISE EXCEPTION 'FAIL: paid cancellation created no refund: %', v_result;
  END IF;
  v_detail := public.admin_get_order(v_order);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_detail->'refunds') r
                 WHERE r->>'id' = v_refund::text
                   AND r->>'status' = 'REQUESTED'
                   AND (r->>'amount')::int = (v_detail->>'totalAmount')::int) THEN
    RAISE EXCEPTION 'FAIL: refund request row missing or wrong amount: %', v_detail->'refunds';
  END IF;
  v_result := public.admin_cancel_order(v_unpaid, 'Duplicate order removed');
  IF v_result->>'refundId' IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: unpaid cancellation created a refund';
  END IF;
  BEGIN
    PERFORM public.admin_cancel_order(v_delivered, 'Too late to cancel');
    RAISE EXCEPTION 'FAIL: delivered order was cancelled';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'ORDER_STATE_INVALID%' THEN RAISE; END IF;
  END;

  -- Refund approval is audited with its notes as the reason.
  v_result := public.admin_approve_refund(v_refund, 'APPROVE', 'Refund approved after review');
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'FAIL: refund approval %', v_result;
  END IF;
  v_detail := public.admin_get_order(v_order);
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_detail->'refunds') r
                 WHERE r->>'id' = v_refund::text AND r->>'status' = 'PROCESSING') THEN
    RAISE EXCEPTION 'FAIL: refund did not move to PROCESSING';
  END IF;

  -- Redelivery returns a failed order to READY and clears rider/PIN/security
  -- state; a typed reason is mandatory.
  BEGIN
    PERFORM public.admin_redeliver_order(v_failed, 'no', NULL);
    RAISE EXCEPTION 'FAIL: redelivery accepted a short reason';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'VALIDATION_ERROR%' THEN RAISE; END IF;
  END;
  v_result := public.admin_redeliver_order(v_failed, 'Customer reached by phone', NULL);
  IF v_result->>'status' <> 'READY_FOR_PICKUP' THEN
    RAISE EXCEPTION 'FAIL: redelivery status %', v_result;
  END IF;
  PERFORM set_config('test.redeliver_id', v_failed::text, true);

  -- Settings: reasons and known keys only; settings_history and an audit row
  -- are written by the RPC and its trigger.
  BEGIN
    PERFORM public.admin_update_settings('{"maxCartLines": 40}'::jsonb, 'no');
    RAISE EXCEPTION 'FAIL: settings accepted a short reason';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'VALIDATION_ERROR%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.admin_update_settings('{"inventedSetting": 1}'::jsonb, 'Unknown setting key');
    RAISE EXCEPTION 'FAIL: settings accepted an unknown key';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'VALIDATION_ERROR%' THEN RAISE; END IF;
  END;
  v_result := public.admin_update_settings(
    '{"maxCartLines": 40, "restaurantName": "Bazaar Flame & Grill Admin"}'::jsonb,
    'Raise the cart line limit'
  );
  IF (v_result->'settings'->>'max_cart_lines')::int <> 40 THEN
    RAISE EXCEPTION 'FAIL: settings update returned %', v_result;
  END IF;
END $$;

-- Verify redelivery state as superuser (RLS does not expose orders directly).
RESET ROLE;
DO $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = current_setting('test.redeliver_id')::uuid;
  IF v_order.order_status <> 'READY_FOR_PICKUP'
     OR v_order.rider_id IS NOT NULL
     OR v_order.failed_pin_attempts <> 0
     OR v_order.pin_locked_until IS NOT NULL
     OR v_order.security_flag IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: redelivery did not clear rider/PIN/security state: %', to_jsonb(v_order);
  END IF;

  IF (SELECT count(*) FROM public.settings_history) < 1 THEN
    RAISE EXCEPTION 'FAIL: settings_history was not written';
  END IF;
END $$;

SELECT set_config('request.jwt.claim.sub', 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee401', true);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_result jsonb;
  v_category uuid;
  v_item uuid;
  v_table uuid;
  v_qr text;
  v_count int;
BEGIN
  -- Menu CRUD with soft archive; each action is audited.
  v_result := public.admin_upsert_category(
    jsonb_build_object('name', 'Phase 10 Test Category', 'slug', 'phase-10-test', 'displayOrder', 99),
    'Add a test category'
  );
  v_category := (v_result->>'categoryId')::uuid;
  IF v_category IS NULL THEN RAISE EXCEPTION 'FAIL: category upsert %', v_result; END IF;

  v_result := public.admin_upsert_menu_item(
    jsonb_build_object(
      'categoryId', v_category,
      'name', 'Phase 10 Test Item', 'slug', 'phase-10-item',
      'description', 'Temporary item', 'basePrice', 9000,
      'prepTimeMinutes', 10, 'sortOrder', 1,
      'imagePath', 'menu/phase-10.png'
    ),
    'Add a test menu item'
  );
  v_item := (v_result->>'itemId')::uuid;
  IF v_item IS NULL THEN RAISE EXCEPTION 'FAIL: menu item upsert %', v_result; END IF;

  v_result := public.admin_upsert_menu_item(
    jsonb_build_object(
      'id', v_item, 'categoryId', v_category,
      'name', 'Phase 10 Test Item', 'slug', 'phase-10-item',
      'description', 'Temporary item', 'basePrice', 9000,
      'isAvailable', false
    ),
    'Sold out for the season'
  );
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'FAIL: menu archive %', v_result;
  END IF;

  -- Table QR token is minted once and preserved on update.
  v_result := public.admin_upsert_table(
    jsonb_build_object('tableNumber', 'P10', 'label', 'Phase 10 Patio', 'isActive', true),
    'Add a patio table'
  );
  v_table := (v_result->>'tableId')::uuid;
  v_qr := v_result->>'qrToken';
  IF v_table IS NULL OR length(coalesce(v_qr, '')) < 10 THEN
    RAISE EXCEPTION 'FAIL: table upsert %', v_result;
  END IF;
  v_result := public.admin_upsert_table(
    jsonb_build_object('id', v_table, 'tableNumber', 'P10A', 'label', 'Phase 10 Patio Window', 'isActive', false),
    'Relabel the patio table'
  );
  IF v_result->>'qrToken' IS DISTINCT FROM v_qr THEN
    RAISE EXCEPTION 'FAIL: QR token changed on table update: %', v_result;
  END IF;

  -- Staff update and the last-active-admin guard (enforced by trigger).
  v_result := public.admin_update_staff(
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeee402', 'RIDER', true, 'UFD 999Z',
    'Replacement plate issued'
  );
  IF NOT coalesce((v_result->>'success')::boolean, false) THEN
    RAISE EXCEPTION 'FAIL: staff update %', v_result;
  END IF;

  BEGIN
    PERFORM public.admin_update_staff(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeee401', 'KITCHEN', true, NULL,
      'Attempt to demote the last admin'
    );
    RAISE EXCEPTION 'FAIL: last admin was demoted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'LAST_ADMIN_PROTECTED%' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.admin_update_staff(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeee401', 'ADMIN', false, NULL,
      'Attempt to deactivate the last admin'
    );
    RAISE EXCEPTION 'FAIL: last admin was deactivated';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'LAST_ADMIN_PROTECTED%' THEN RAISE; END IF;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- Ledger: Juma's 65,500 liability, then two settlements of the same day.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_ledger jsonb;
  v_row jsonb;
  v_first jsonb;
  v_second jsonb;
  v_count int;
  v_linked int;
BEGIN
  v_ledger := public.get_admin_ledger(DATE '2026-11-20');
  IF jsonb_array_length(v_ledger) <> 1 THEN
    RAISE EXCEPTION 'FAIL: expected one active rider in ledger, got %', v_ledger;
  END IF;
  v_row := v_ledger->0;
  IF (v_row->>'expectedCash')::int <> 65500 THEN
    RAISE EXCEPTION 'FAIL: ledger expected cash %, not 65500', v_row->>'expectedCash';
  END IF;
  -- The staff update earlier in this transaction issued plate UFD 999Z; the
  -- ledger must reflect the current profile, not a stale snapshot.
  IF (v_row->>'motorcyclePlate') <> 'UFD 999Z' THEN
    RAISE EXCEPTION 'FAIL: ledger plate %', v_row->>'motorcyclePlate';
  END IF;
  SELECT count(*) INTO v_linked FROM jsonb_array_elements(v_row->'linkedOrders');
  IF v_linked <> 2 THEN
    RAISE EXCEPTION 'FAIL: ledger has % linked orders, expected 2', v_linked;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_row->'linkedOrders') o
                 WHERE (o->>'amount')::int = 38000)
     OR NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_row->'linkedOrders') o
                    WHERE (o->>'amount')::int = 27500) THEN
    RAISE EXCEPTION 'FAIL: linked orders are not the 38,000 + 27,500 fixtures: %', v_row;
  END IF;

  BEGIN
    PERFORM public.reconcile_rider_cash(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeee402', -1, 'Negative counted cash', DATE '2026-11-20'
    );
    RAISE EXCEPTION 'FAIL: negative settlement validation missing';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'VALIDATION_ERROR%' THEN RAISE; END IF;
  END;

  v_first := public.reconcile_rider_cash(
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeee402', 65500, 'End-of-day cash counted once', DATE '2026-11-20'
  );
  IF (v_first->>'expectedCash')::int <> 65500
     OR (v_first->>'countedCash')::int <> 65500
     OR (v_first->>'variance')::int <> 0
     OR (v_first->>'status') <> 'SETTLED' THEN
    RAISE EXCEPTION 'FAIL: first settlement %', v_first;
  END IF;

  v_second := public.reconcile_rider_cash(
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeee402', 60000, 'Recount found a 5,500 shortfall', DATE '2026-11-20'
  );
  IF (v_second->>'expectedCash')::int <> 65500
     OR (v_second->>'countedCash')::int <> 60000
     OR (v_second->>'variance')::int <> -5500
     OR (v_second->>'shortfall')::int <> 5500
     OR (v_second->>'status') <> 'PARTIAL' THEN
    RAISE EXCEPTION 'FAIL: second settlement %', v_second;
  END IF;

  -- Matching settlementIds prove ON CONFLICT updated the same row rather than
  -- inserting a second one for the rider/business-date pair.
  IF v_first->>'settlementId' IS DISTINCT FROM v_second->>'settlementId' THEN
    RAISE EXCEPTION 'FAIL: second settlement created a new row: % vs %',
      v_first->>'settlementId', v_second->>'settlementId';
  END IF;

  v_row := (public.get_admin_ledger(DATE '2026-11-20')->0);
  IF (v_row->>'settledCash')::int <> 60000
     OR (v_row->>'variance')::int <> -5500
     OR (v_row->>'status') <> 'PARTIAL' THEN
    RAISE EXCEPTION 'FAIL: ledger after settlement %', v_row;
  END IF;
END $$;

-- Analytics and audit feed: every action above has a row with a typed reason.
DO $$
DECLARE
  v_analytics jsonb;
  v_feed jsonb;
  v_action text;
  v_actions text[] := ARRAY[
    'ADMIN_UPDATE_ORDER_CONTACT', 'ADMIN_CANCEL_ORDER', 'ADMIN_APPROVE_REFUND',
    'ADMIN_REDELIVER_ORDER', 'ADMIN_UPDATE_SETTINGS', 'ADMIN_UPSERT_CATEGORY',
    'ADMIN_UPSERT_MENU_ITEM', 'ADMIN_UPSERT_TABLE', 'ADMIN_UPDATE_STAFF',
    'RECONCILE_RIDER_CASH'
  ];
BEGIN
  v_analytics := public.get_admin_analytics(DATE '2026-11-01', DATE '2026-11-30');
  IF (v_analytics->>'orders')::int < 5 THEN
    RAISE EXCEPTION 'FAIL: analytics did not include the order fixtures %', v_analytics;
  END IF;

  FOREACH v_action IN ARRAY v_actions LOOP
    v_feed := public.admin_get_audit_feed(50, 0, NULL);
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(v_feed->'events') e
                   WHERE e->>'action' = v_action
                     AND e->>'actorId' = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeee401'
                     AND length(coalesce(e->>'reason', '')) >= 3) THEN
      RAISE EXCEPTION 'FAIL: audit row missing for %', v_action;
    END IF;
  END LOOP;

  v_feed := public.admin_get_audit_feed(50, 0, 'cash_settlements');
  IF (v_feed->>'total')::int <> 2 THEN
    RAISE EXCEPTION 'FAIL: cash audit feed total %, expected 2', v_feed->>'total';
  END IF;
END $$;

RESET ROLE;

ROLLBACK;
