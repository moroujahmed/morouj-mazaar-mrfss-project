-- Order pipeline acceptance tests (Phase 6).
-- Run against a database with the migration chain and canonical seed applied:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/db/orders.sql
-- Everything runs in one transaction and is rolled back, so no order persists.

\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE t_ctx (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
) ON COMMIT DROP;

-- ---------------------------------------------------------------------------
-- Function privileges: only the service role may write orders or codes.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF has_function_privilege('anon', 'public.create_order(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can execute create_order';
  END IF;
  IF has_function_privilege('authenticated', 'public.create_order(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated can execute create_order';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.create_order(jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: service_role must execute create_order';
  END IF;
  IF has_function_privilege('anon', 'public.finalize_payment_attempt(text,boolean,text,jsonb,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: anon can finalize payments';
  END IF;
  IF has_function_privilege('authenticated', 'public.store_cod_otp(text,text,timestamptz,text,integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated can store OTPs';
  END IF;
  IF has_function_privilege('authenticated', 'public.verify_cod_otp(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: authenticated can verify OTPs';
  END IF;
  IF NOT has_function_privilege('service_role', 'public.verify_cod_otp(text,text)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: service_role must verify OTPs';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Canonical total A: Tilapia combo + garlic dip, 1,562 m.
-- 32,000 + 2,000 + 0 delivery + 1,000 packaging = 35,000.
-- The payload carries no prices; any client value would be ignored.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r jsonb;
  v_token UUID;
BEGIN
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '00000000-0000-4000-8000-0000000000a1',
    'requestHash', 'hash-order-a',
    'customerName', 'DB Test A',
    'customerPhone', '0772900001',
    'orderType', 'DELIVERY',
    'deliveryAddressText', 'Nakasero Plot 12',
    'deliveryLatitude', 0.3245,
    'deliveryLongitude', 32.5782,
    'roadDistanceM', 1562,
    'estimatedTravelMinutes', 4,
    'paymentMethod', 'MTN_MOMO',
    'items', jsonb_build_array(
      jsonb_build_object(
        'menuItemId', '22222222-2222-4222-8222-222222222201',
        'quantity', 1,
        'price', 1, -- deliberately bogus; must be ignored
        'modifiers', jsonb_build_array(
          jsonb_build_object('modifierId', '44444444-4444-4444-8444-444444444401'),
          jsonb_build_object('comboOptionId', '66666666-6666-4666-8666-666666666601'),
          jsonb_build_object('comboOptionId', '66666666-6666-4666-8666-666666666603')
        )
      )
    )
  ));

  IF (r->>'itemsSubtotal')::int <> 32000 THEN
    RAISE EXCEPTION 'FAIL: order A itemsSubtotal %, expected 32000', r->>'itemsSubtotal';
  END IF;
  IF (r->>'modifiersTotal')::int <> 2000 THEN
    RAISE EXCEPTION 'FAIL: order A modifiersTotal %, expected 2000', r->>'modifiersTotal';
  END IF;
  IF (r->>'deliveryFee')::int <> 0 THEN
    RAISE EXCEPTION 'FAIL: order A deliveryFee %, expected 0', r->>'deliveryFee';
  END IF;
  IF (r->>'packagingFee')::int <> 1000 THEN
    RAISE EXCEPTION 'FAIL: order A packagingFee %, expected 1000', r->>'packagingFee';
  END IF;
  IF (r->>'totalAmount')::int <> 35000 THEN
    RAISE EXCEPTION 'FAIL: order A total %, expected 35000', r->>'totalAmount';
  END IF;
  IF (r->>'orderStatus') <> 'PENDING_PAYMENT' OR (r->>'paymentStatus') <> 'PENDING' THEN
    RAISE EXCEPTION 'FAIL: order A status %, %', r->>'orderStatus', r->>'paymentStatus';
  END IF;
  IF (r->>'idempotent')::boolean THEN
    RAISE EXCEPTION 'FAIL: first order A must not be idempotent';
  END IF;

  v_token := (r->>'orderToken')::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE order_token = v_token
      AND customer_phone_normalized = '+256772900001'
      AND order_status = 'PENDING_PAYMENT'
      AND total_amount = 35000
      AND handover_pin ~ '^[0-9]{4}$'
  ) THEN
    RAISE EXCEPTION 'FAIL: order A row is not authoritative';
  END IF;

  IF (SELECT count(*) FROM public.order_items oi WHERE oi.order_id = (r->>'orderId')::uuid) <> 1 THEN
    RAISE EXCEPTION 'FAIL: order A line count';
  END IF;
  IF (SELECT count(*) FROM public.order_item_modifiers m
      JOIN public.order_items oi ON oi.id = m.order_item_id
      WHERE oi.order_id = (r->>'orderId')::uuid) <> 3 THEN
    RAISE EXCEPTION 'FAIL: order A modifier snapshot count';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.order_status_history
    WHERE order_id = (r->>'orderId')::uuid
      AND from_status IS NULL
      AND to_status = 'PENDING_PAYMENT'
      AND reason = 'ORDER_CREATED'
  ) THEN
    RAISE EXCEPTION 'FAIL: order A creation history row missing';
  END IF;

  INSERT INTO t_ctx (k, v) VALUES
    ('a_token', r->>'orderToken'),
    ('a_id', r->>'orderId')
  ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v;
END $$;

-- Same key + same payload replays the original order.
DO $$
DECLARE
  r jsonb;
  v_token TEXT;
BEGIN
  SELECT v INTO v_token FROM t_ctx WHERE k = 'a_token';

  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '00000000-0000-4000-8000-0000000000a1',
    'requestHash', 'hash-order-a',
    'customerName', 'DB Test A',
    'customerPhone', '0772900001',
    'orderType', 'DELIVERY',
    'deliveryAddressText', 'Nakasero Plot 12',
    'deliveryLatitude', 0.3245,
    'deliveryLongitude', 32.5782,
    'roadDistanceM', 1562,
    'estimatedTravelMinutes', 4,
    'paymentMethod', 'MTN_MOMO',
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

  IF (r->>'orderToken') <> v_token THEN
    RAISE EXCEPTION 'FAIL: replay returned a different order';
  END IF;
  IF NOT (r->>'idempotent')::boolean THEN
    RAISE EXCEPTION 'FAIL: replay must report idempotent=true';
  END IF;
  IF (SELECT count(*) FROM public.orders WHERE order_token = v_token::uuid) <> 1 THEN
    RAISE EXCEPTION 'FAIL: replay created a second order';
  END IF;
END $$;

-- A different payload under the same key must fail.
DO $$
BEGIN
  BEGIN
    PERFORM public.create_order(jsonb_build_object(
      'idempotencyKey', '00000000-0000-4000-8000-0000000000a1',
      'requestHash', 'hash-order-a-changed',
      'customerName', 'Someone Else',
      'customerPhone', '0772900001',
      'orderType', 'DELIVERY',
      'deliveryLatitude', 0.3245,
      'deliveryLongitude', 32.5782,
      'roadDistanceM', 1562,
      'paymentMethod', 'MTN_MOMO',
      'items', jsonb_build_array(
        jsonb_build_object(
          'menuItemId', '22222222-2222-4222-8222-222222222201',
          'quantity', 1
        )
      )
    ));
    RAISE EXCEPTION 'FAIL: idempotency conflict was accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'IDEMPOTENCY_CONFLICT%' THEN
      RAISE;
    END IF;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- Canonical total B: Luwombo + juice at 8,093 m, cash from 50,000.
-- 31,000 + 6,000 delivery + 1,000 packaging = 38,000; change 12,000.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r jsonb;
BEGIN
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '00000000-0000-4000-8000-0000000000b1',
    'requestHash', 'hash-order-b',
    'customerName', 'DB Test B',
    'customerPhone', '0772900002',
    'orderType', 'DELIVERY',
    'deliveryAddressText', 'Ntinda',
    'deliveryLatitude', 0.3542,
    'deliveryLongitude', 32.612,
    'roadDistanceM', 8093,
    'estimatedTravelMinutes', 9,
    'paymentMethod', 'CASH_ON_DELIVERY',
    'codChangeRequestedFor', 50000,
    'items', jsonb_build_array(
      jsonb_build_object(
        'menuItemId', '22222222-2222-4222-8222-222222222203',
        'quantity', 1
      ),
      jsonb_build_object(
        'menuItemId', '22222222-2222-4222-8222-222222222210',
        'quantity', 1
      )
    )
  ));

  IF (r->>'itemsSubtotal')::int <> 31000 THEN
    RAISE EXCEPTION 'FAIL: order B itemsSubtotal %', r->>'itemsSubtotal';
  END IF;
  IF (r->>'deliveryFee')::int <> 6000 THEN
    RAISE EXCEPTION 'FAIL: order B deliveryFee %', r->>'deliveryFee';
  END IF;
  IF (r->>'totalAmount')::int <> 38000 THEN
    RAISE EXCEPTION 'FAIL: order B total %', r->>'totalAmount';
  END IF;
  IF (r->>'orderStatus') <> 'CONFIRMED_UNPAID' THEN
    RAISE EXCEPTION 'FAIL: cash order B status %', r->>'orderStatus';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE order_token = (r->>'orderToken')::uuid
      AND cod_change_requested_for = 50000
      AND cod_change_due = 12000
  ) THEN
    RAISE EXCEPTION 'FAIL: order B change due is wrong';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Dine-in: table T4, no delivery or packaging fee.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r jsonb;
BEGIN
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '00000000-0000-4000-8000-0000000000c1',
    'requestHash', 'hash-order-c1',
    'customerName', 'DB Dine In',
    'customerPhone', '0772900003',
    'orderType', 'DINE_IN',
    'tableId', '77777777-7777-4777-8777-777777777704',
    'paymentMethod', 'CASH_ON_DELIVERY',
    'items', jsonb_build_array(
      jsonb_build_object(
        'menuItemId', '22222222-2222-4222-8222-222222222205',
        'quantity', 1
      )
    )
  ));

  IF (r->>'itemsSubtotal')::int <> 8000
     OR (r->>'deliveryFee')::int <> 0
     OR (r->>'packagingFee')::int <> 0
     OR (r->>'totalAmount')::int <> 8000 THEN
    RAISE EXCEPTION 'FAIL: dine-in totals %, %, %, %',
      r->>'itemsSubtotal', r->>'deliveryFee', r->>'packagingFee', r->>'totalAmount';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE order_token = (r->>'orderToken')::uuid
      AND order_type = 'DINE_IN'
      AND source = 'TABLE_QR'
      AND table_number = 'T4'
      AND delivery_latitude IS NULL
      AND delivery_longitude IS NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: dine-in order row is wrong';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Server-side gates.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    PERFORM public.create_order(jsonb_build_object(
      'idempotencyKey', '00000000-0000-4000-8000-0000000000d1',
      'requestHash', 'hash-far',
      'customerName', 'DB Far',
      'customerPhone', '0772900004',
      'orderType', 'DELIVERY',
      'deliveryLatitude', 0.0512,
      'deliveryLongitude', 32.4637,
      'roadDistanceM', 35000,
      'paymentMethod', 'MTN_MOMO',
      'items', jsonb_build_array(
        jsonb_build_object(
          'menuItemId', '22222222-2222-4222-8222-222222222203',
          'quantity', 1
        )
      )
    ));
    RAISE EXCEPTION 'FAIL: out-of-bounds distance accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'DISTANCE_OUT_OF_BOUNDS%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.create_order(jsonb_build_object(
      'idempotencyKey', '00000000-0000-4000-8000-0000000000d2',
      'requestHash', 'hash-cod-far',
      'customerName', 'DB COD Far',
      'customerPhone', '0772900005',
      'orderType', 'DELIVERY',
      'deliveryLatitude', 0.36,
      'deliveryLongitude', 32.62,
      'roadDistanceM', 9400,
      'paymentMethod', 'CASH_ON_DELIVERY',
      'items', jsonb_build_array(
        jsonb_build_object(
          'menuItemId', '22222222-2222-4222-8222-222222222203',
          'quantity', 1
        )
      )
    ));
    RAISE EXCEPTION 'FAIL: cash beyond the COD radius accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'COD_NOT_AVAILABLE%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.create_order(jsonb_build_object(
      'idempotencyKey', '00000000-0000-4000-8000-0000000000d3',
      'requestHash', 'hash-mov',
      'customerName', 'DB MOV',
      'customerPhone', '0772900006',
      'orderType', 'DELIVERY',
      'deliveryLatitude', 0.3245,
      'deliveryLongitude', 32.5782,
      'roadDistanceM', 1562,
      'paymentMethod', 'MTN_MOMO',
      'items', jsonb_build_array(
        jsonb_build_object(
          'menuItemId', '22222222-2222-4222-8222-222222222208',
          'quantity', 1
        )
      )
    ));
    RAISE EXCEPTION 'FAIL: order below the minimum accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'MOV_NOT_MET%' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.create_order(jsonb_build_object(
      'idempotencyKey', '00000000-0000-4000-8000-0000000000d4',
      'requestHash', 'hash-sold-out',
      'customerName', 'DB Inactive',
      'customerPhone', '0772900007',
      'orderType', 'DELIVERY',
      'deliveryLatitude', 0.3245,
      'deliveryLongitude', 32.5782,
      'roadDistanceM', 1562,
      'paymentMethod', 'MTN_MOMO',
      'items', jsonb_build_array(
        jsonb_build_object(
          'menuItemId', '00000000-0000-4000-8000-000000000999',
          'quantity', 1
        )
      )
    ));
    RAISE EXCEPTION 'FAIL: unknown item accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'VALIDATION_ERROR%' THEN RAISE; END IF;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- Payment attempts: retry abandons the open attempt; late success is
-- recorded with a refund and never satisfies the current attempt.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_token UUID;
  r1 jsonb;
  r2 jsonb;
  f jsonb;
BEGIN
  SELECT v::uuid INTO v_token FROM t_ctx WHERE k = 'a_token';

  r1 := public.start_payment_attempt(v_token, 'MTN_MOMO', 'flutterwave');
  IF (r1->>'txRef') <> v_token::text || '-1' THEN
    RAISE EXCEPTION 'FAIL: attempt 1 tx_ref %', r1->>'txRef';
  END IF;
  IF (r1->>'amount')::int <> 35000 OR (r1->>'currency') <> 'UGX' THEN
    RAISE EXCEPTION 'FAIL: attempt 1 amount/currency';
  END IF;

  r2 := public.start_payment_attempt(v_token, 'MTN_MOMO', 'flutterwave');
  IF (r2->>'txRef') <> v_token::text || '-2' THEN
    RAISE EXCEPTION 'FAIL: attempt 2 tx_ref %', r2->>'txRef';
  END IF;
  IF (r2->>'attemptNumber')::int <> 2 THEN
    RAISE EXCEPTION 'FAIL: attempt 2 number %', r2->>'attemptNumber';
  END IF;

  IF (SELECT status FROM public.payment_transactions WHERE id = (r1->>'transactionId')::uuid) <> 'ABANDONED' THEN
    RAISE EXCEPTION 'FAIL: attempt 1 was not abandoned';
  END IF;

  f := public.finalize_payment_attempt(
    r1->>'txRef', true, 'FLW-DB-LATE', '{}'::jsonb, NULL
  );
  IF (f->>'reason') <> 'ATTEMPT_ABANDONED' OR (f->>'applied')::boolean THEN
    RAISE EXCEPTION 'FAIL: late attempt result %', f;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.refunds
    WHERE payment_transaction_id = (r1->>'transactionId')::uuid
      AND reason = 'LATE_PAYMENT_ON_ABANDONED_ATTEMPT'
      AND status = 'REQUESTED'
      AND amount = 35000
  ) THEN
    RAISE EXCEPTION 'FAIL: late attempt refund missing';
  END IF;
  IF (SELECT order_status FROM public.orders WHERE order_token = v_token) <> 'PENDING_PAYMENT' THEN
    RAISE EXCEPTION 'FAIL: late attempt changed the order';
  END IF;

  f := public.finalize_payment_attempt(
    r2->>'txRef', true, 'FLW-DB-CURRENT', '{}'::jsonb, NULL
  );
  IF NOT (f->>'applied')::boolean
     OR (f->>'orderStatus') <> 'PREPARING'
     OR (f->>'paymentStatus') <> 'PAID' THEN
    RAISE EXCEPTION 'FAIL: current attempt result %', f;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE order_token = v_token
      AND order_status = 'PREPARING'
      AND payment_status = 'PAID'
      AND payment_reference = 'FLW-DB-CURRENT'
      AND acknowledged_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: paid order row is wrong';
  END IF;

  f := public.finalize_payment_attempt(
    r2->>'txRef', true, 'FLW-DB-CURRENT', '{}'::jsonb, NULL
  );
  IF (f->>'reason') <> 'ALREADY_PROCESSED' THEN
    RAISE EXCEPTION 'FAIL: replay reason %', f->>'reason';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Amount mismatch never marks an order paid.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r jsonb;
  a jsonb;
  f jsonb;
BEGIN
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '00000000-0000-4000-8000-0000000000e1',
    'requestHash', 'hash-mismatch',
    'customerName', 'DB Mismatch',
    'customerPhone', '0772900008',
    'orderType', 'DELIVERY',
    'deliveryLatitude', 0.3245,
    'deliveryLongitude', 32.5782,
    'roadDistanceM', 1562,
    'paymentMethod', 'MTN_MOMO',
    'items', jsonb_build_array(
      jsonb_build_object(
        'menuItemId', '22222222-2222-4222-8222-222222222203',
        'quantity', 1
      )
    )
  ));
  IF (r->>'totalAmount')::int <> 27000 THEN
    RAISE EXCEPTION 'FAIL: mismatch order total %', r->>'totalAmount';
  END IF;

  a := public.start_payment_attempt((r->>'orderToken')::uuid, 'MTN_MOMO', 'flutterwave');
  UPDATE public.payment_transactions
  SET amount = amount + 500
  WHERE id = (a->>'transactionId')::uuid;

  f := public.finalize_payment_attempt(
    a->>'txRef', true, 'FLW-DB-MISMATCH', '{}'::jsonb, NULL
  );
  IF (f->>'reason') <> 'PAYMENT_MISMATCH' OR (f->>'applied')::boolean THEN
    RAISE EXCEPTION 'FAIL: mismatch result %', f;
  END IF;
  IF (SELECT order_status FROM public.orders WHERE order_token = (r->>'orderToken')::uuid) <> 'PENDING_PAYMENT' THEN
    RAISE EXCEPTION 'FAIL: mismatch changed the order';
  END IF;
  IF (SELECT status FROM public.payment_transactions WHERE id = (a->>'transactionId')::uuid) <> 'FAILED' THEN
    RAISE EXCEPTION 'FAIL: mismatch transaction was not failed';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Terminal orders never revive; a late payment opens a refund task.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r jsonb;
  a jsonb;
  f jsonb;
  v_token UUID;
BEGIN
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '00000000-0000-4000-8000-0000000000f1',
    'requestHash', 'hash-terminal',
    'customerName', 'DB Terminal',
    'customerPhone', '0772900009',
    'orderType', 'DELIVERY',
    'deliveryLatitude', 0.3245,
    'deliveryLongitude', 32.5782,
    'roadDistanceM', 1562,
    'paymentMethod', 'MTN_MOMO',
    'items', jsonb_build_array(
      jsonb_build_object(
        'menuItemId', '22222222-2222-4222-8222-222222222203',
        'quantity', 1
      )
    )
  ));

  v_token := (r->>'orderToken')::uuid;
  a := public.start_payment_attempt(v_token, 'MTN_MOMO', 'flutterwave');

  UPDATE public.orders
  SET order_status = 'CANCELLED',
      cancelled_at = timezone('utc', now()),
      cancellation_reason = 'DB_TEST_CANCEL'
  WHERE order_token = v_token;

  f := public.finalize_payment_attempt(
    a->>'txRef', true, 'FLW-DB-TERMINAL', '{}'::jsonb, NULL
  );
  IF (f->>'reason') <> 'ORDER_TERMINAL' OR (f->>'applied')::boolean THEN
    RAISE EXCEPTION 'FAIL: terminal result %', f;
  END IF;
  IF (SELECT order_status FROM public.orders WHERE order_token = v_token) <> 'CANCELLED' THEN
    RAISE EXCEPTION 'FAIL: terminal order revived';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.refunds
    WHERE payment_transaction_id = (a->>'transactionId')::uuid
      AND reason = 'LATE_PAYMENT_AFTER_TERMINAL'
  ) THEN
    RAISE EXCEPTION 'FAIL: terminal refund missing';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- COD one-time codes: hashed at rest, single use, attempt-limited, expiring.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  o jsonb;
  v jsonb;
  v_otp UUID;
BEGIN
  o := public.store_cod_otp(
    '0772900010', '123456', timezone('utc', now()) + INTERVAL '10 minutes'
  );
  v_otp := (o->>'otpId')::uuid;

  IF NOT EXISTS (
    SELECT 1 FROM public.otp_verifications
    WHERE id = v_otp
      AND phone = '+256772900010'
      AND code_hash <> '123456'
      AND code_hash LIKE '$2%'
      AND consumed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'FAIL: OTP was not hashed at rest';
  END IF;

  v := public.verify_cod_otp('0772900010', '000000');
  IF (v->>'valid')::boolean OR (v->>'reason') <> 'OTP_INVALID' THEN
    RAISE EXCEPTION 'FAIL: wrong OTP result %', v;
  END IF;
  IF (v->>'remainingAttempts')::int <> 2 THEN
    RAISE EXCEPTION 'FAIL: wrong OTP remaining %', v->>'remainingAttempts';
  END IF;

  v := public.verify_cod_otp('0772900010', '123456');
  IF NOT (v->>'valid')::boolean THEN
    RAISE EXCEPTION 'FAIL: correct OTP rejected %', v;
  END IF;

  -- A used code cannot be replayed.
  v := public.verify_cod_otp('0772900010', '123456');
  IF (v->>'valid')::boolean OR (v->>'reason') <> 'OTP_REQUIRED' THEN
    RAISE EXCEPTION 'FAIL: used OTP accepted %', v;
  END IF;

  -- Three wrong attempts lock the newest code.
  PERFORM public.store_cod_otp(
    '0772900010', '654321', timezone('utc', now()) + INTERVAL '10 minutes'
  );
  v := public.verify_cod_otp('0772900010', '111111');
  v := public.verify_cod_otp('0772900010', '111112');
  v := public.verify_cod_otp('0772900010', '111113');
  IF (v->>'reason') <> 'OTP_LOCKED' THEN
    RAISE EXCEPTION 'FAIL: lock reason %', v->>'reason';
  END IF;
  v := public.verify_cod_otp('0772900010', '654321');
  IF (v->>'valid')::boolean THEN
    RAISE EXCEPTION 'FAIL: locked OTP accepted';
  END IF;

  -- Expired codes are rejected as expired.
  o := public.store_cod_otp(
    '0772900011', '246810', timezone('utc', now()) + INTERVAL '10 minutes'
  );
  UPDATE public.otp_verifications
  SET expires_at = timezone('utc', now()) - INTERVAL '1 minute'
  WHERE id = (o->>'otpId')::uuid;
  v := public.verify_cod_otp('0772900011', '246810');
  IF (v->>'valid')::boolean OR (v->>'reason') <> 'OTP_EXPIRED' THEN
    RAISE EXCEPTION 'FAIL: expired OTP result %', v;
  END IF;

  BEGIN
    PERFORM public.store_cod_otp(
      '0772900010', '12345', timezone('utc', now()) + INTERVAL '10 minutes'
    );
    RAISE EXCEPTION 'FAIL: short OTP accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'VALIDATION_ERROR%' THEN RAISE; END IF;
  END;
END $$;

-- ---------------------------------------------------------------------------
-- Timeout cron: pending orders older than ten minutes are cancelled and
-- their open transactions failed.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r jsonb;
  a jsonb;
  v_token UUID;
  v_expired INTEGER;
BEGIN
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '00000000-0000-4000-8000-0000000000a2',
    'requestHash', 'hash-expiry',
    'customerName', 'DB Expiry',
    'customerPhone', '0772900012',
    'orderType', 'DELIVERY',
    'deliveryLatitude', 0.3245,
    'deliveryLongitude', 32.5782,
    'roadDistanceM', 1562,
    'paymentMethod', 'MTN_MOMO',
    'items', jsonb_build_array(
      jsonb_build_object(
        'menuItemId', '22222222-2222-4222-8222-222222222203',
        'quantity', 1
      )
    )
  ));

  v_token := (r->>'orderToken')::uuid;
  a := public.start_payment_attempt(v_token, 'MTN_MOMO', 'flutterwave');

  UPDATE public.orders
  SET created_at = timezone('utc', now()) - INTERVAL '11 minutes'
  WHERE order_token = v_token;

  SELECT public.expire_pending_orders() INTO v_expired;
  IF v_expired < 1 THEN
    RAISE EXCEPTION 'FAIL: expiry cancelled no orders';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.orders
    WHERE order_token = v_token
      AND order_status = 'CANCELLED'
      AND payment_status = 'FAILED'
      AND cancellation_reason = 'PAYMENT_TIMEOUT'
  ) THEN
    RAISE EXCEPTION 'FAIL: expired order was not cancelled';
  END IF;
  IF (SELECT status FROM public.payment_transactions WHERE id = (a->>'transactionId')::uuid) <> 'FAILED' THEN
    RAISE EXCEPTION 'FAIL: expired attempt was not failed';
  END IF;

  SELECT public.expire_pending_orders() INTO v_expired;
  IF v_expired <> 0 THEN
    RAISE EXCEPTION 'FAIL: second expiry run cancelled % orders', v_expired;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Phase 7: tracker payload and one-time feedback.
-- The token RPC must expose the status timeline, hide destination coordinates
-- until the rider is en route, drop the PIN at terminal states, and never
-- return customer phone, notes, or payment references.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r jsonb;
  g jsonb;
  v_token UUID;
  v_dine UUID;
BEGIN
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '00000000-0000-4000-8000-0000000000f3',
    'requestHash', 'hash-tracker',
    'customerName', 'DB Tracker',
    'customerPhone', '0772900013',
    'orderType', 'DELIVERY',
    'deliveryAddressText', 'Nakasero Plot 12',
    'deliveryLatitude', 0.3245,
    'deliveryLongitude', 32.5782,
    'roadDistanceM', 1562,
    'estimatedTravelMinutes', 4,
    'paymentMethod', 'MTN_MOMO',
    'items', jsonb_build_array(
      jsonb_build_object(
        'menuItemId', '22222222-2222-4222-8222-222222222203',
        'quantity', 1
      )
    )
  ));
  v_token := (r->>'orderToken')::uuid;

  g := public.get_order_by_token(v_token);
  IF g IS NULL THEN
    RAISE EXCEPTION 'FAIL: tracker payload is null';
  END IF;
  IF jsonb_array_length(g->'timeline') <> 1
     OR (g->'timeline'->0->>'status') <> 'PENDING_PAYMENT' THEN
    RAISE EXCEPTION 'FAIL: initial timeline %', g->'timeline';
  END IF;
  IF (g->>'destinationLatitude') IS NOT NULL
     OR (g->>'destinationLongitude') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: destination coordinates exposed before dispatch';
  END IF;
  IF (g->>'handoverPin') IS NULL OR (g->>'handoverPin') !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'FAIL: active delivery PIN missing from token payload';
  END IF;
  IF (g->>'customerPhone') IS NOT NULL
     OR (g->>'customerNotes') IS NOT NULL
     OR (g->>'paymentReference') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: token payload leaked private fields';
  END IF;
  IF (g->>'canRate')::boolean
     OR coalesce(g->'feedback', 'null'::jsonb) <> 'null'::jsonb THEN
    RAISE EXCEPTION 'FAIL: feedback exposed before delivery';
  END IF;

  -- Out for delivery: destination coordinates appear, timeline records the hop.
  UPDATE public.orders SET order_status = 'PREPARING' WHERE order_token = v_token;
  UPDATE public.orders SET order_status = 'READY_FOR_PICKUP' WHERE order_token = v_token;
  UPDATE public.orders SET order_status = 'CLAIMED' WHERE order_token = v_token;
  UPDATE public.orders SET order_status = 'OUT_FOR_DELIVERY' WHERE order_token = v_token;

  g := public.get_order_by_token(v_token);
  IF abs((g->>'destinationLatitude')::numeric - 0.3245) > 0.000001
     OR abs((g->>'destinationLongitude')::numeric - 32.5782) > 0.000001 THEN
    RAISE EXCEPTION 'FAIL: destination coordinates wrong while dispatched: %, %',
      g->>'destinationLatitude', g->>'destinationLongitude';
  END IF;
  IF (g->'timeline'->(jsonb_array_length(g->'timeline') - 1)->>'status') <> 'OUT_FOR_DELIVERY' THEN
    RAISE EXCEPTION 'FAIL: dispatch missing from timeline %', g->'timeline';
  END IF;
  IF (g->>'handoverPin') IS NULL THEN
    RAISE EXCEPTION 'FAIL: PIN disappeared while the order is active';
  END IF;

  -- Feedback is rejected before delivery.
  BEGIN
    PERFORM public.submit_feedback(v_token, 'GREAT', 'too early');
    RAISE EXCEPTION 'FAIL: feedback accepted before delivery';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'ORDER_NOT_FOUND_OR_ALREADY_RATED%' THEN RAISE; END IF;
  END;

  -- Delivered: destination and PIN disappear, rating becomes available.
  UPDATE public.orders
  SET order_status = 'DELIVERED',
      delivered_at = timezone('utc', now())
  WHERE order_token = v_token;

  g := public.get_order_by_token(v_token);
  IF (g->>'destinationLatitude') IS NOT NULL
     OR (g->>'destinationLongitude') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: destination coordinates retained after delivery';
  END IF;
  IF (g->>'handoverPin') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: PIN retained on a delivered order';
  END IF;
  IF NOT (g->>'canRate')::boolean THEN
    RAISE EXCEPTION 'FAIL: delivered order is not rateable';
  END IF;
  IF (g->'timeline'->(jsonb_array_length(g->'timeline') - 1)->>'status') <> 'DELIVERED' THEN
    RAISE EXCEPTION 'FAIL: delivery missing from timeline %', g->'timeline';
  END IF;

  IF (public.submit_feedback(v_token, 'GREAT', 'Still warm'))->>'success' <> 'true' THEN
    RAISE EXCEPTION 'FAIL: feedback was not stored';
  END IF;

  g := public.get_order_by_token(v_token);
  IF (g->'feedback'->>'rating') <> 'GREAT'
     OR (g->'feedback'->>'notes') <> 'Still warm' THEN
    RAISE EXCEPTION 'FAIL: feedback payload wrong %', g->'feedback';
  END IF;
  IF (g->>'canRate')::boolean THEN
    RAISE EXCEPTION 'FAIL: rated order still reports canRate';
  END IF;

  BEGIN
    PERFORM public.submit_feedback(v_token, 'BAD', NULL);
    RAISE EXCEPTION 'FAIL: second feedback accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE 'ORDER_NOT_FOUND_OR_ALREADY_RATED%' THEN RAISE; END IF;
  END;

  -- Dine-in orders never carry a handover PIN.
  r := public.create_order(jsonb_build_object(
    'idempotencyKey', '00000000-0000-4000-8000-0000000000f2',
    'requestHash', 'hash-tracker-dine',
    'customerName', 'DB Tracker Dine',
    'customerPhone', '0772900014',
    'orderType', 'DINE_IN',
    'tableId', '77777777-7777-4777-8777-777777777704',
    'paymentMethod', 'CASH_ON_DELIVERY',
    'items', jsonb_build_array(
      jsonb_build_object(
        'menuItemId', '22222222-2222-4222-8222-222222222205',
        'quantity', 1
      )
    )
  ));
  v_dine := (r->>'orderToken')::uuid;

  g := public.get_order_by_token(v_dine);
  IF (g->>'handoverPin') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: dine-in order exposed a handover PIN';
  END IF;
END $$;

ROLLBACK;

SELECT 'Order pipeline tests passed.' AS result;
