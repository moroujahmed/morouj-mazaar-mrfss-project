-- ============================================================================
-- PROJECT-BAZAAR-D2C / MRFSS - Phase 6 order pipeline
-- Target: PostgreSQL 15+ / Supabase (validated on PostgreSQL 18)
-- Date: 2026-11-16
-- ============================================================================
-- Additive migration for the Phase 6 order pipeline. It:
--   * creates orders, items, modifier snapshots, and idempotency records in a
--     single transaction through `create_order(jsonb)`;
--   * recomputes every financial value from the catalogue and app_settings, so
--     a caller cannot inject a price;
--   * records the opening status-history row;
--   * adds `finalize_payment_attempt` with per-attempt isolation, amount and
--     currency verification, terminal-order protection, and late-payment
--     refund tasks;
--   * adds bcrypt-backed COD OTP storage/verification and the returning
--     customer lookup;
--   * grants every new function to `service_role` only.
--
-- It never edits an already-applied migration.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CREATE ORDER
-- ============================================================================
-- Payload contract (all amounts are recomputed from the catalogue):
-- {
--   "idempotencyKey": uuid,
--   "requestHash": text,
--   "customerName": text,
--   "customerPhone": text,
--   "customerNotes": text | null,
--   "orderType": "DELIVERY" | "DINE_IN",
--   "tableId": uuid | null,
--   "deliveryAddressText": text | null,
--   "deliveryLatitude": number | null,
--   "deliveryLongitude": number | null,
--   "roadDistanceM": integer | null,
--   "estimatedTravelMinutes": integer | null,
--   "etaAt": timestamptz | null,
--   "paymentMethod": payment_method,
--   "codChangeRequestedFor": integer | null,
--   "items": [
--     {
--       "menuItemId": uuid,
--       "quantity": integer,
--       "modifiers": [
--         { "modifierId": uuid },
--         { "comboOptionId": uuid }
--       ]
--     }
--   ]
-- }

CREATE OR REPLACE FUNCTION public.create_order(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key UUID;
  v_hash TEXT;
  v_idem public.checkout_idempotency%ROWTYPE;
  v_settings public.app_settings%ROWTYPE;

  v_type public.order_type;
  v_method public.payment_method;
  v_status public.order_status;
  v_source public.order_source;

  v_name TEXT;
  v_phone TEXT;
  v_notes TEXT;
  v_table_id UUID;
  v_table public.tables%ROWTYPE;
  v_lat NUMERIC;
  v_lng NUMERIC;
  v_address TEXT;
  v_distance INTEGER;
  v_travel INTEGER;
  v_eta TIMESTAMPTZ;
  v_change_requested INTEGER;

  v_item JSONB;
  v_item_id UUID;
  v_item_qty INTEGER;
  v_menu_item public.menu_items%ROWTYPE;
  v_order_id UUID;
  v_order_token UUID;
  v_order_number BIGINT;
  v_order_status public.order_status;
  v_order_payment_status public.payment_status;
  v_line_id UUID;
  v_mod JSONB;
  v_modifier_id UUID;
  v_combo_option_id UUID;
  v_modifier public.item_modifiers%ROWTYPE;
  v_delta INTEGER;
  v_mod_name TEXT;
  v_mod_type public.modifier_type;
  v_step_name TEXT;
  v_option_name TEXT;

  v_items_subtotal INTEGER := 0;
  v_modifiers_total INTEGER := 0;
  v_delivery_fee INTEGER := 0;
  v_packaging_fee INTEGER := 0;
  v_total INTEGER;
  v_line_count INTEGER := 0;
  v_free_m INTEGER;
  v_max_m INTEGER;
  v_cod_m INTEGER;
  v_busy_buffer INTEGER := 0;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: payload required'
      USING ERRCODE = 'P0001';
  END IF;

  v_key := (p_payload->>'idempotencyKey')::uuid;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: idempotencyKey required'
      USING ERRCODE = 'P0001';
  END IF;

  v_hash := nullif(trim(p_payload->>'requestHash'), '');
  IF v_hash IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: requestHash required'
      USING ERRCODE = 'P0001';
  END IF;

  -- The insert serialises concurrent attempts that share an idempotency key.
  INSERT INTO public.checkout_idempotency (idempotency_key, request_hash)
  VALUES (v_key, v_hash)
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT * INTO v_idem
  FROM public.checkout_idempotency
  WHERE idempotency_key = v_key
  FOR UPDATE;

  IF v_idem.request_hash <> v_hash THEN
    RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT'
      USING ERRCODE = 'P0001';
  END IF;

  -- A retry with the same key and payload returns the original order.
  IF v_idem.order_id IS NOT NULL THEN
    SELECT o.id, o.order_token, o.order_number, o.total_amount,
           o.items_subtotal, o.modifiers_total, o.delivery_fee,
           o.packaging_fee, o.order_status, o.payment_status,
           o.payment_method
    INTO v_order_id, v_order_token, v_order_number, v_total,
         v_items_subtotal, v_modifiers_total, v_delivery_fee,
         v_packaging_fee, v_order_status, v_order_payment_status,
         v_method
    FROM public.orders o
    WHERE o.id = v_idem.order_id;

    RETURN jsonb_build_object(
      'orderId', v_order_id,
      'orderToken', v_order_token,
      'orderNumber', v_order_number,
      'totalAmount', v_total,
      'itemsSubtotal', v_items_subtotal,
      'modifiersTotal', v_modifiers_total,
      'deliveryFee', v_delivery_fee,
      'packagingFee', v_packaging_fee,
      'orderStatus', v_order_status,
      'paymentStatus', v_order_payment_status,
      'paymentMethod', v_method,
      'idempotent', true
    );
  END IF;

  SELECT * INTO v_settings FROM public.app_settings WHERE id = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'STORE_CLOSED: settings unavailable'
      USING ERRCODE = 'P0001';
  END IF;

  IF (p_payload->>'orderType') NOT IN ('DELIVERY', 'DINE_IN') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: invalid order type'
      USING ERRCODE = 'P0001';
  END IF;
  v_type := (p_payload->>'orderType')::public.order_type;
  v_source := CASE WHEN v_type = 'DINE_IN' THEN 'TABLE_QR'::public.order_source
                   ELSE 'WEB'::public.order_source END;

  IF (p_payload->>'paymentMethod') NOT IN
     ('MTN_MOMO', 'AIRTEL_MONEY', 'BANK_CARD', 'CASH_ON_DELIVERY') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: invalid payment method'
      USING ERRCODE = 'P0001';
  END IF;
  v_method := (p_payload->>'paymentMethod')::public.payment_method;

  v_name := trim(coalesce(p_payload->>'customerName', ''));
  IF length(v_name) < 2 OR length(v_name) > 100 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: customer name'
      USING ERRCODE = 'P0001';
  END IF;

  v_phone := public.normalize_ug_phone(p_payload->>'customerPhone');
  IF v_phone !~ '^\+256[0-9]{9}$' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: customer phone'
      USING ERRCODE = 'P0001';
  END IF;

  v_notes := nullif(trim(p_payload->>'customerNotes'), '');
  IF v_notes IS NOT NULL AND length(v_notes) > 500 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: customer notes'
      USING ERRCODE = 'P0001';
  END IF;

  IF jsonb_typeof(p_payload->'items') <> 'array'
     OR jsonb_array_length(p_payload->'items') = 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: items required'
      USING ERRCODE = 'P0001';
  END IF;

  v_line_count := jsonb_array_length(p_payload->'items');
  IF v_line_count > v_settings.max_cart_lines THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: too many cart lines'
      USING ERRCODE = 'P0001';
  END IF;

  v_status := CASE WHEN v_method = 'CASH_ON_DELIVERY'
                   THEN 'CONFIRMED_UNPAID'::public.order_status
                   ELSE 'PENDING_PAYMENT'::public.order_status END;
  v_order_payment_status := 'PENDING'::public.payment_status;

  v_free_m := round(v_settings.free_delivery_radius_km * 1000);
  v_max_m := round(v_settings.max_delivery_radius_km * 1000);
  v_cod_m := round(v_settings.cod_max_radius_km * 1000);

  IF v_type = 'DINE_IN' THEN
    v_table_id := (p_payload->>'tableId')::uuid;
    IF v_table_id IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: table required'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_table
    FROM public.tables
    WHERE id = v_table_id AND is_active;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: table is not active'
        USING ERRCODE = 'P0001';
    END IF;

    v_delivery_fee := 0;
    v_packaging_fee := v_settings.packaging_fee_dine_in;
    v_distance := NULL;
    v_travel := NULL;
    v_eta := NULL;
    v_address := NULL;
  ELSE
    v_lat := (p_payload->>'deliveryLatitude')::numeric;
    v_lng := (p_payload->>'deliveryLongitude')::numeric;
    v_address := nullif(trim(p_payload->>'deliveryAddressText'), '');

    IF v_lat IS NULL OR v_lng IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: delivery coordinates required'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_lat < -90 OR v_lat > 90 OR v_lng < -180 OR v_lng > 180 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: coordinates out of range'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_address IS NOT NULL AND length(v_address) > 300 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: delivery address too long'
        USING ERRCODE = 'P0001';
    END IF;

    v_distance := (p_payload->>'roadDistanceM')::integer;
    IF v_distance IS NULL OR v_distance < 0 THEN
      RAISE EXCEPTION 'DISTANCE_UNAVAILABLE: distance required'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_distance > v_max_m THEN
      RAISE EXCEPTION 'DISTANCE_OUT_OF_BOUNDS: outside delivery area'
        USING ERRCODE = 'P0001';
    END IF;

    IF v_distance <= v_free_m THEN
      v_delivery_fee := 0;
    ELSE
      v_delivery_fee := ceil((v_distance - v_free_m)::numeric / 1000)
                        * v_settings.rate_per_excess_km;
    END IF;

    v_packaging_fee := v_settings.packaging_fee_default;
    v_travel := nullif((p_payload->>'estimatedTravelMinutes')::integer, 0);
    v_eta := (p_payload->>'etaAt')::timestamptz;
  END IF;

  IF v_settings.is_kitchen_busy THEN
    v_busy_buffer := v_settings.busy_buffer_minutes;
  END IF;

  -- The order row exists before its lines so the item foreign keys are real.
  -- Totals are filled in after the line snapshots are resolved.
  INSERT INTO public.orders (
    order_number,
    order_type,
    source,
    customer_name,
    customer_phone,
    customer_notes,
    table_id,
    table_number,
    delivery_address_text,
    delivery_latitude,
    delivery_longitude,
    road_distance_m,
    estimated_travel_minutes,
    eta_at,
    items_subtotal,
    modifiers_total,
    delivery_fee,
    packaging_fee,
    payment_method,
    payment_status,
    order_status,
    cod_change_requested_for,
    kitchen_busy_buffer_applied
  ) VALUES (
    nextval('public.orders_order_number_seq'),
    v_type,
    v_source,
    v_name,
    v_phone,
    v_notes,
    v_table_id,
    CASE WHEN v_type = 'DINE_IN' THEN v_table.table_number END,
    v_address,
    v_lat,
    v_lng,
    v_distance,
    v_travel,
    v_eta,
    0,
    0,
    v_delivery_fee,
    v_packaging_fee,
    v_method,
    v_order_payment_status,
    v_status,
    NULL,
    v_busy_buffer
  ) RETURNING id, order_token, order_number, total_amount,
              order_status, payment_status
  INTO v_order_id, v_order_token, v_order_number, v_total,
       v_order_status, v_order_payment_status;

  UPDATE public.checkout_idempotency
  SET order_id = v_order_id
  WHERE idempotency_key = v_key;

  -- -------------------------------------------------------------------------
  -- Item and modifier snapshots. Prices come from the catalogue only.
  -- -------------------------------------------------------------------------
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'items')
  LOOP
    v_item_id := (v_item->>'menuItemId')::uuid;
    v_item_qty := coalesce((v_item->>'quantity')::integer, 1);

    IF v_item_id IS NULL THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: menu item required'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_item_qty < 1 OR v_item_qty > v_settings.max_item_quantity
       OR v_item_qty > 100 THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: item quantity'
        USING ERRCODE = 'P0001';
    END IF;

    SELECT * INTO v_menu_item
    FROM public.menu_items
    WHERE id = v_item_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: unknown menu item'
        USING ERRCODE = 'P0001';
    END IF;
    IF NOT v_menu_item.is_active OR NOT v_menu_item.is_available THEN
      RAISE EXCEPTION 'ITEM_OUT_OF_STOCK: %', v_menu_item.name
        USING ERRCODE = 'P0001';
    END IF;

    v_items_subtotal := v_items_subtotal
                        + (v_menu_item.base_price * v_item_qty);

    INSERT INTO public.order_items (
      order_id, menu_item_id, item_name_snapshot, unit_price_snapshot, quantity
    ) VALUES (
      v_order_id, v_item_id, v_menu_item.name, v_menu_item.base_price, v_item_qty
    ) RETURNING id INTO v_line_id;

    FOR v_mod IN
      SELECT value FROM jsonb_array_elements(
        coalesce(v_item->'modifiers', '[]'::jsonb)
      )
    LOOP
      v_modifier_id := (v_mod->>'modifierId')::uuid;
      v_combo_option_id := (v_mod->>'comboOptionId')::uuid;

      IF v_modifier_id IS NOT NULL THEN
        SELECT * INTO v_modifier
        FROM public.item_modifiers
        WHERE id = v_modifier_id AND is_active;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: unknown modifier'
            USING ERRCODE = 'P0001';
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM public.menu_item_modifier_groups l
          JOIN public.modifier_groups g ON g.id = l.group_id
          WHERE l.menu_item_id = v_item_id
            AND g.id = v_modifier.group_id
            AND g.is_active
        ) THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: modifier not available for item'
            USING ERRCODE = 'P0001';
        END IF;

        v_delta := v_modifier.price_delta;
        v_mod_name := v_modifier.name;
        v_mod_type := v_modifier.modifier_type;
      ELSIF v_combo_option_id IS NOT NULL THEN
        SELECT cso.price_delta, cs.name, mi.name
        INTO v_delta, v_step_name, v_option_name
        FROM public.combo_step_options cso
        JOIN public.combo_steps cs ON cs.id = cso.step_id
        JOIN public.menu_items mi ON mi.id = cso.option_item_id
        WHERE cso.id = v_combo_option_id
          AND cs.combo_item_id = v_item_id
          AND mi.is_active
          AND mi.is_available;

        IF NOT FOUND THEN
          RAISE EXCEPTION 'VALIDATION_ERROR: unknown combo option'
            USING ERRCODE = 'P0001';
        END IF;

        v_modifier_id := NULL;
        v_mod_name := v_step_name || ': ' || v_option_name;
        v_mod_type := 'PAID_ADDON'::public.modifier_type;
      ELSE
        RAISE EXCEPTION 'VALIDATION_ERROR: modifier reference required'
          USING ERRCODE = 'P0001';
      END IF;

      INSERT INTO public.order_item_modifiers (
        order_item_id, modifier_id, name_snapshot,
        modifier_type_snapshot, price_delta_snapshot, quantity
      ) VALUES (
        v_line_id, v_modifier_id, v_mod_name, v_mod_type, v_delta, 1
      );

      v_modifiers_total := v_modifiers_total + (v_delta * v_item_qty);
    END LOOP;
  END LOOP;

  IF v_items_subtotal + v_modifiers_total > v_settings.max_cart_value THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: cart value'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_type = 'DINE_IN' THEN
    IF v_items_subtotal + v_modifiers_total
       < v_settings.minimum_order_value_dine_in THEN
      RAISE EXCEPTION 'MOV_NOT_MET'
        USING ERRCODE = 'P0001';
    END IF;
  ELSIF v_items_subtotal + v_modifiers_total < v_settings.minimum_order_value THEN
    RAISE EXCEPTION 'MOV_NOT_MET'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_method = 'CASH_ON_DELIVERY' AND v_type = 'DELIVERY'
     AND v_distance > v_cod_m THEN
    RAISE EXCEPTION 'COD_NOT_AVAILABLE'
      USING ERRCODE = 'P0001';
  END IF;

  v_total := v_items_subtotal + v_modifiers_total
             + v_delivery_fee + v_packaging_fee;

  v_change_requested := nullif((p_payload->>'codChangeRequestedFor')::integer, 0);
  IF v_change_requested IS NOT NULL THEN
    IF v_method <> 'CASH_ON_DELIVERY' THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: change only for cash orders'
        USING ERRCODE = 'P0001';
    END IF;
    IF v_change_requested < v_total THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: change must cover the total'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_settings.is_kitchen_busy THEN
    v_busy_buffer := v_settings.busy_buffer_minutes;
  END IF;

  UPDATE public.orders
  SET items_subtotal = v_items_subtotal,
      modifiers_total = v_modifiers_total,
      cod_change_requested_for = v_change_requested,
      kitchen_busy_buffer_applied = v_busy_buffer
  WHERE id = v_order_id
  RETURNING total_amount INTO v_total;

  UPDATE public.checkout_idempotency
  SET order_id = v_order_id
  WHERE idempotency_key = v_key;

  INSERT INTO public.order_status_history (
    order_id, from_status, to_status, reason, metadata
  ) VALUES (
    v_order_id,
    NULL,
    v_order_status,
    'ORDER_CREATED',
    jsonb_build_object(
      'source', v_source,
      'orderType', v_type,
      'paymentMethod', v_method,
      'idempotencyKey', v_key
    )
  );

  RETURN jsonb_build_object(
    'orderId', v_order_id,
    'orderToken', v_order_token,
    'orderNumber', v_order_number,
    'totalAmount', v_total,
    'itemsSubtotal', v_items_subtotal,
    'modifiersTotal', v_modifiers_total,
    'deliveryFee', v_delivery_fee,
    'packagingFee', v_packaging_fee,
    'orderStatus', v_order_status,
    'paymentStatus', v_order_payment_status,
    'paymentMethod', v_method,
    'idempotent', false
  );
END;
$$;

-- ============================================================================
-- 2. FINALIZE PAYMENT ATTEMPT
-- ============================================================================
-- Called only after the webhook route has verified the provider transaction.
-- It re-checks amount and currency, isolates abandoned attempts, never
-- resurrects a terminal order, and records late payments for refund review.

CREATE OR REPLACE FUNCTION public.finalize_payment_attempt(
  p_tx_ref TEXT,
  p_success BOOLEAN,
  p_provider_transaction_id TEXT DEFAULT NULL,
  p_raw_payload JSONB DEFAULT '{}'::jsonb,
  p_error TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tx public.payment_transactions%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_currency TEXT;
  v_reason TEXT;
BEGIN
  IF p_tx_ref IS NULL OR length(trim(p_tx_ref)) = 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: tx_ref required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_tx
  FROM public.payment_transactions
  WHERE tx_ref = p_tx_ref
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'TX_REF_NOT_FOUND');
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = v_tx.order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('applied', false, 'reason', 'ORDER_NOT_FOUND');
  END IF;

  SELECT trim(currency) INTO v_currency
  FROM public.app_settings
  WHERE id = 1;

  -- A repeated success for the same attempt is a no-op.
  IF v_tx.status = 'SUCCESSFUL' THEN
    RETURN jsonb_build_object(
      'applied', false,
      'reason', 'ALREADY_PROCESSED',
      'orderToken', v_order.order_token,
      'orderNumber', v_order.order_number,
      'orderStatus', v_order.order_status,
      'paymentStatus', v_order.payment_status
    );
  END IF;

  IF p_success THEN
    IF v_tx.amount <> v_order.total_amount
       OR trim(v_tx.currency) <> coalesce(v_currency, 'UGX') THEN
      UPDATE public.payment_transactions
      SET status = 'FAILED',
          verified_at = timezone('utc', now()),
          raw_payload = coalesce(p_raw_payload, '{}'::jsonb)
                        || jsonb_build_object('finalizeError', 'PAYMENT_MISMATCH')
      WHERE id = v_tx.id;

      RETURN jsonb_build_object(
        'applied', false,
        'reason', 'PAYMENT_MISMATCH',
        'orderToken', v_order.order_token,
        'orderNumber', v_order.order_number,
        'orderStatus', v_order.order_status,
        'paymentStatus', v_order.payment_status
      );
    END IF;

    -- The attempt was abandoned by a retry: record the late payment but do
    -- not satisfy the current attempt. A refund task is opened for review.
    IF v_tx.status = 'ABANDONED' THEN
      UPDATE public.payment_transactions
      SET status = 'SUCCESSFUL',
          provider_transaction_id = p_provider_transaction_id,
          verified_at = timezone('utc', now()),
          raw_payload = coalesce(p_raw_payload, '{}'::jsonb)
      WHERE id = v_tx.id;

      INSERT INTO public.refunds (
        order_id, payment_transaction_id, amount, reason, status
      ) VALUES (
        v_order.id, v_tx.id, v_tx.amount,
        'LATE_PAYMENT_ON_ABANDONED_ATTEMPT', 'REQUESTED'
      );

      RETURN jsonb_build_object(
        'applied', false,
        'reason', 'ATTEMPT_ABANDONED',
        'orderToken', v_order.order_token,
        'orderNumber', v_order.order_number,
        'orderStatus', v_order.order_status,
        'paymentStatus', v_order.payment_status
      );
    END IF;

    -- Terminal orders never come back to life. A real late payment opens a
    -- refund task so the money is returned.
    IF v_order.order_status IN ('CANCELLED', 'DELIVERED', 'DELIVERY_FAILED') THEN
      UPDATE public.payment_transactions
      SET status = 'SUCCESSFUL',
          provider_transaction_id = p_provider_transaction_id,
          verified_at = timezone('utc', now()),
          raw_payload = coalesce(p_raw_payload, '{}'::jsonb)
      WHERE id = v_tx.id;

      INSERT INTO public.refunds (
        order_id, payment_transaction_id, amount, reason, status
      ) VALUES (
        v_order.id, v_tx.id, v_tx.amount,
        'LATE_PAYMENT_AFTER_TERMINAL', 'REQUESTED'
      );

      RETURN jsonb_build_object(
        'applied', false,
        'reason', 'ORDER_TERMINAL',
        'orderToken', v_order.order_token,
        'orderNumber', v_order.order_number,
        'orderStatus', v_order.order_status,
        'paymentStatus', v_order.payment_status
      );
    END IF;

    -- An already-paid order keeps its first successful attempt.
    IF v_order.payment_status = 'PAID' THEN
      RETURN jsonb_build_object(
        'applied', false,
        'reason', 'ORDER_ALREADY_PAID',
        'orderToken', v_order.order_token,
        'orderNumber', v_order.order_number,
        'orderStatus', v_order.order_status,
        'paymentStatus', v_order.payment_status
      );
    END IF;

    IF v_order.order_status <> 'PENDING_PAYMENT' THEN
      RETURN jsonb_build_object(
        'applied', false,
        'reason', 'ORDER_STATE_INVALID',
        'orderToken', v_order.order_token,
        'orderNumber', v_order.order_number,
        'orderStatus', v_order.order_status,
        'paymentStatus', v_order.payment_status
      );
    END IF;

    UPDATE public.payment_transactions
    SET status = 'SUCCESSFUL',
        provider_transaction_id = p_provider_transaction_id,
        verified_at = timezone('utc', now()),
        raw_payload = coalesce(p_raw_payload, '{}'::jsonb)
    WHERE id = v_tx.id;

    UPDATE public.orders
    SET payment_status = 'PAID',
        order_status = 'PREPARING',
        payment_reference = p_provider_transaction_id,
        payment_transaction_id = v_tx.id,
        acknowledged_at = coalesce(acknowledged_at, timezone('utc', now()))
    WHERE id = v_order.id
    RETURNING * INTO v_order;

    RETURN jsonb_build_object(
      'applied', true,
      'reason', NULL,
      'orderToken', v_order.order_token,
      'orderNumber', v_order.order_number,
      'orderStatus', v_order.order_status,
      'paymentStatus', v_order.payment_status
    );
  END IF;

  -- Failure path.
  IF v_tx.status = 'ABANDONED' THEN
    RETURN jsonb_build_object(
      'applied', false,
      'reason', 'ATTEMPT_ABANDONED',
      'orderToken', v_order.order_token,
      'orderNumber', v_order.order_number,
      'orderStatus', v_order.order_status,
      'paymentStatus', v_order.payment_status
    );
  END IF;

  IF v_order.payment_status = 'PAID' THEN
    RETURN jsonb_build_object(
      'applied', false,
      'reason', 'ORDER_ALREADY_PAID',
      'orderToken', v_order.order_token,
      'orderNumber', v_order.order_number,
      'orderStatus', v_order.order_status,
      'paymentStatus', v_order.payment_status
    );
  END IF;

  UPDATE public.payment_transactions
  SET status = 'FAILED',
      provider_transaction_id = coalesce(
        p_provider_transaction_id, provider_transaction_id
      ),
      verified_at = timezone('utc', now()),
      raw_payload = coalesce(p_raw_payload, '{}'::jsonb)
                    || jsonb_build_object('finalizeError', p_error)
  WHERE id = v_tx.id;

  v_reason := coalesce(p_error, 'PAYMENT_FAILED');

  RETURN jsonb_build_object(
    'applied', false,
    'reason', v_reason,
    'orderToken', v_order.order_token,
    'orderNumber', v_order.order_number,
    'orderStatus', v_order.order_status,
    'paymentStatus', v_order.payment_status
  );
END;
$$;

-- ============================================================================
-- 3. COD OTP
-- ============================================================================

CREATE OR REPLACE FUNCTION public.store_cod_otp(
  p_phone TEXT,
  p_code TEXT,
  p_expires_at TIMESTAMPTZ,
  p_ip_hash TEXT DEFAULT NULL,
  p_max_attempts INTEGER DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_phone TEXT;
  v_id UUID;
  v_hash TEXT;
BEGIN
  v_phone := public.normalize_ug_phone(p_phone);
  IF v_phone !~ '^\+256[0-9]{9}$' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: phone'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_code IS NULL OR p_code !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: code'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_expires_at IS NULL OR p_expires_at <= timezone('utc', now()) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: expiry'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_max_attempts < 1 OR p_max_attempts > 10 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: max attempts'
      USING ERRCODE = 'P0001';
  END IF;

  v_hash := crypt(p_code, gen_salt('bf'));

  -- Only the newest code for a phone may be used.
  UPDATE public.otp_verifications
  SET consumed_at = timezone('utc', now())
  WHERE phone = v_phone
    AND purpose = 'COD_VERIFICATION'
    AND consumed_at IS NULL;

  INSERT INTO public.otp_verifications (
    phone, purpose, code_hash, expires_at, max_attempts, ip_hash
  ) VALUES (
    v_phone, 'COD_VERIFICATION', v_hash, p_expires_at,
    p_max_attempts, p_ip_hash
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('otpId', v_id, 'expiresAt', p_expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_cod_otp(
  p_phone TEXT,
  p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_phone TEXT;
  v_otp public.otp_verifications%ROWTYPE;
  v_next_attempts INTEGER;
BEGIN
  IF p_code IS NULL OR p_code !~ '^[0-9]{6}$' THEN
    RETURN jsonb_build_object(
      'valid', false, 'reason', 'OTP_INVALID', 'remainingAttempts', 0
    );
  END IF;

  v_phone := public.normalize_ug_phone(p_phone);

  SELECT * INTO v_otp
  FROM public.otp_verifications
  WHERE phone = v_phone
    AND purpose = 'COD_VERIFICATION'
    AND consumed_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'valid', false, 'reason', 'OTP_REQUIRED', 'remainingAttempts', 0
    );
  END IF;

  IF v_otp.expires_at <= timezone('utc', now())
     OR v_otp.attempts >= v_otp.max_attempts THEN
    UPDATE public.otp_verifications
    SET consumed_at = timezone('utc', now())
    WHERE id = v_otp.id;

    RETURN jsonb_build_object(
      'valid', false,
      'reason', CASE WHEN v_otp.attempts >= v_otp.max_attempts
                     THEN 'OTP_LOCKED' ELSE 'OTP_EXPIRED' END,
      'remainingAttempts', 0
    );
  END IF;

  IF crypt(p_code, v_otp.code_hash) = v_otp.code_hash THEN
    UPDATE public.otp_verifications
    SET consumed_at = timezone('utc', now())
    WHERE id = v_otp.id;

    RETURN jsonb_build_object(
      'valid', true,
      'reason', NULL,
      'remainingAttempts', v_otp.max_attempts - v_otp.attempts
    );
  END IF;

  v_next_attempts := v_otp.attempts + 1;

  UPDATE public.otp_verifications
  SET attempts = v_next_attempts,
      consumed_at = CASE WHEN v_next_attempts >= v_otp.max_attempts
                         THEN timezone('utc', now()) ELSE NULL END
  WHERE id = v_otp.id;

  RETURN jsonb_build_object(
    'valid', false,
    'reason', CASE WHEN v_next_attempts >= v_otp.max_attempts
                   THEN 'OTP_LOCKED' ELSE 'OTP_INVALID' END,
    'remainingAttempts', greatest(0, v_otp.max_attempts - v_next_attempts)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.has_delivered_order(p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders
    WHERE customer_phone_normalized = public.normalize_ug_phone(p_phone)
      AND order_status = 'DELIVERED'
  );
$$;

-- ============================================================================
-- 4. GRANTS
-- ============================================================================

REVOKE ALL ON FUNCTION public.create_order(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.finalize_payment_attempt(
  TEXT, BOOLEAN, TEXT, JSONB, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.store_cod_otp(
  TEXT, TEXT, TIMESTAMPTZ, TEXT, INTEGER
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_cod_otp(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_delivered_order(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_order(JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_payment_attempt(
  TEXT, BOOLEAN, TEXT, JSONB, TEXT
) TO service_role;
GRANT EXECUTE ON FUNCTION public.store_cod_otp(
  TEXT, TEXT, TIMESTAMPTZ, TEXT, INTEGER
) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_cod_otp(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_delivered_order(TEXT) TO service_role;

COMMIT;
