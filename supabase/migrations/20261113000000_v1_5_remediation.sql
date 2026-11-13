-- ============================================================================
-- PROJECT-BAZAAR-D2C / MRFSS — v1.5 remediation
-- Target: PostgreSQL 15+ / Supabase (validated on PostgreSQL 18)
-- Date: 2026-11-13
-- ============================================================================
-- Additive remediation for the v1.5 end-to-end audit. This migration:
--   * makes every payment attempt addressable by a unique tx_ref;
--   * adds an audited admin redelivery path;
--   * adds the missing rider_telemetry(order_id) index;
--   * adds audited admin RPCs for settings, order contact, catalogue,
--     tables, staff, and refund approval mutations;
--   * adds a token-scoped payment-attempt RPC and a webhook lookup RPC;
--   * restores explicit grants for every new/replaced function.
--
-- It never edits an already-applied migration.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. PAYMENT ATTEMPTS
-- ============================================================================
-- v1.4 used tx_ref = order_token. A retry therefore reused the same reference,
-- making reconciliation and duplicate-webhook handling ambiguous. Each attempt
-- now gets tx_ref = '<order_token>-<attempt_number>' and a unique attempt
-- number per order.

ALTER TABLE public.payment_transactions
  ADD COLUMN attempt_number INTEGER;

-- Backfill existing rows before the NOT NULL/unique constraints are added.
WITH numbered AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY order_id
           ORDER BY created_at ASC, id ASC
         )::integer AS rn
  FROM public.payment_transactions
)
UPDATE public.payment_transactions pt
SET attempt_number = n.rn
FROM numbered n
WHERE pt.id = n.id;

-- Preserve the first historical tx_ref and disambiguate duplicates from the
-- order_token era. Fresh databases have no rows, so this is a no-op there.
WITH duplicates AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY tx_ref
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM public.payment_transactions
)
UPDATE public.payment_transactions pt
SET tx_ref = pt.tx_ref || '-legacy-' || pt.attempt_number::text
FROM duplicates d
WHERE pt.id = d.id
  AND d.rn > 1;

ALTER TABLE public.payment_transactions
  ALTER COLUMN attempt_number SET DEFAULT 1,
  ALTER COLUMN attempt_number SET NOT NULL,
  ADD CONSTRAINT payment_transactions_attempt_positive
    CHECK (attempt_number > 0);

CREATE UNIQUE INDEX payment_transactions_order_attempt_uniq
  ON public.payment_transactions (order_id, attempt_number);

CREATE UNIQUE INDEX payment_transactions_txref_uniq
  ON public.payment_transactions (tx_ref);

COMMENT ON COLUMN public.payment_transactions.attempt_number IS
  'Monotonic per-order payment attempt. tx_ref is <order_token>-<attempt_number>.';
COMMENT ON COLUMN public.payment_transactions.tx_ref IS
  'Provider reference. Unique per attempt, never reused after a failure.';

-- ----------------------------------------------------------------------------
-- 1.1 start_payment_attempt()
-- ----------------------------------------------------------------------------
-- The customer checkout action calls this with the order token. The token is
-- the capability; the function locks the order, abandons any open attempt, and
-- allocates the next attempt number atomically.

CREATE OR REPLACE FUNCTION public.start_payment_attempt(
  p_order_token UUID,
  p_method public.payment_method,
  p_provider TEXT DEFAULT 'flutterwave'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_attempt INTEGER;
  v_tx_ref TEXT;
  v_tx_id UUID;
  v_currency CHAR(3);
BEGIN
  IF p_order_token IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: order token required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_provider IS NULL OR length(trim(p_provider)) < 2 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: provider required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE order_token = p_order_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_order.payment_method = 'CASH_ON_DELIVERY' THEN
    RAISE EXCEPTION 'PAYMENT_METHOD_UNAVAILABLE: cash orders do not initiate payment'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_order.payment_method <> p_method THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: method does not match the order'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_order.order_status <> 'PENDING_PAYMENT'
     OR v_order.payment_status <> 'PENDING' THEN
    RAISE EXCEPTION 'ORDER_STATE_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  -- Only one attempt may be open at a time. The previous attempt stays in the
  -- ledger as ABANDONED so a late webhook can still be reconciled.
  UPDATE public.payment_transactions
  SET status = 'ABANDONED'
  WHERE order_id = v_order.id
    AND status IN ('INITIATED', 'PENDING');

  SELECT coalesce(max(attempt_number), 0) + 1
  INTO v_attempt
  FROM public.payment_transactions
  WHERE order_id = v_order.id;

  v_tx_ref := v_order.order_token::text || '-' || v_attempt::text;

  SELECT currency INTO v_currency
  FROM public.app_settings
  WHERE id = 1;

  INSERT INTO public.payment_transactions (
    order_id, provider, tx_ref, amount, currency, method, status,
    attempt_number, raw_payload
  ) VALUES (
    v_order.id, trim(p_provider), v_tx_ref, v_order.total_amount,
    coalesce(v_currency, 'UGX'), p_method, 'INITIATED',
    v_attempt, jsonb_build_object('attemptNumber', v_attempt)
  )
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'transactionId', v_tx_id,
    'txRef', v_tx_ref,
    'attemptNumber', v_attempt,
    'amount', v_order.total_amount,
    'currency', coalesce(v_currency, 'UGX')
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 1.2 resolve_payment_tx_ref()
-- ----------------------------------------------------------------------------
-- Webhook handlers run with the service role. This read-only lookup returns
-- the order and attempt bound to a tx_ref without exposing table access.

CREATE OR REPLACE FUNCTION public.resolve_payment_tx_ref(p_tx_ref TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'transactionId', pt.id,
    'orderId', o.id,
    'orderToken', o.order_token,
    'orderNumber', o.order_number,
    'attemptNumber', pt.attempt_number,
    'txRef', pt.tx_ref,
    'amount', pt.amount,
    'currency', pt.currency,
    'transactionStatus', pt.status,
    'paymentMethod', o.payment_method,
    'paymentStatus', o.payment_status,
    'orderStatus', o.order_status
  )
  FROM public.payment_transactions pt
  JOIN public.orders o ON o.id = pt.order_id
  WHERE pt.tx_ref = p_tx_ref
  LIMIT 1;
$$;

-- ============================================================================
-- 2. ADMIN REDELIVERY
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_redeliver_order(
  p_order_id UUID,
  p_reason TEXT,
  p_rider_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_status public.order_status := 'READY_FOR_PICKUP';
  v_now TIMESTAMPTZ := timezone('utc', now());
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: reason required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_order.order_status <> 'DELIVERY_FAILED' THEN
    RAISE EXCEPTION 'ORDER_STATE_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_rider_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = p_rider_id AND role = 'RIDER' AND is_active = true
    ) THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: invalid rider'
        USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.orders
      WHERE rider_id = p_rider_id
        AND order_status IN ('CLAIMED', 'OUT_FOR_DELIVERY')
        AND id <> p_order_id
    ) THEN
      RAISE EXCEPTION 'RIDER_HAS_ACTIVE_ORDER'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM set_config('app.transition_reason', p_reason, true);

  UPDATE public.orders
  SET order_status = 'READY_FOR_PICKUP',
      rider_id = NULL,
      claimed_at = NULL,
      dispatched_at = NULL,
      delivered_at = NULL,
      security_flag = NULL,
      failed_pin_attempts = 0,
      pin_locked_until = NULL,
      ready_at = coalesce(ready_at, v_now)
  WHERE id = p_order_id;

  IF p_rider_id IS NOT NULL THEN
    UPDATE public.orders
    SET order_status = 'CLAIMED',
        rider_id = p_rider_id,
        claimed_at = v_now
    WHERE id = p_order_id;

    v_status := 'CLAIMED';
  END IF;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_REDELIVER_ORDER', 'orders', p_order_id::text,
    p_reason, to_jsonb(v_order),
    jsonb_build_object(
      'status', v_status,
      'riderId', p_rider_id,
      'reason', p_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'status', v_status,
    'riderId', p_rider_id
  );
END;
$$;

-- ============================================================================
-- 3. TELEMETRY INDEX
-- ============================================================================

CREATE INDEX rider_telemetry_order_idx
  ON public.rider_telemetry (order_id)
  WHERE order_id IS NOT NULL;

-- ============================================================================
-- 4. ADMIN SETTINGS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_settings(
  p_payload JSONB,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allowed TEXT[] := ARRAY[
    'restaurantName', 'restaurantLat', 'restaurantLng', 'supportWhatsapp',
    'freeDeliveryRadiusKm', 'ratePerExcessKm', 'maxDeliveryRadiusKm',
    'codMaxRadiusKm', 'minimumOrderValue', 'minimumOrderValueDineIn',
    'packagingFeeDefault', 'packagingFeeDineIn', 'maxCartValue',
    'maxItemQuantity', 'maxCartLines', 'isStoreOpen', 'openingTime',
    'closingTime', 'isKitchenBusy', 'busyBufferMinutes', 'isKitchenPaused',
    'pinMaxAttempts', 'pinLockMinutes', 'pinGeofenceM', 'staffSessionHours'
  ];
  v_key TEXT;
  v_before JSONB;
  v_after JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: reason required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_payload IS NULL OR p_payload = '{}'::jsonb THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: settings payload required'
      USING ERRCODE = 'P0001';
  END IF;

  FOR v_key IN SELECT jsonb_object_keys(p_payload)
  LOOP
    IF NOT (v_key = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'VALIDATION_ERROR: unknown setting %', v_key
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  SELECT to_jsonb(s) INTO v_before FROM public.app_settings s WHERE id = 1;

  UPDATE public.app_settings
  SET restaurant_name = CASE
        WHEN p_payload ? 'restaurantName' THEN p_payload->>'restaurantName'
        ELSE restaurant_name END,
      restaurant_lat = CASE
        WHEN p_payload ? 'restaurantLat' THEN (p_payload->>'restaurantLat')::numeric
        ELSE restaurant_lat END,
      restaurant_lng = CASE
        WHEN p_payload ? 'restaurantLng' THEN (p_payload->>'restaurantLng')::numeric
        ELSE restaurant_lng END,
      support_whatsapp = CASE
        WHEN p_payload ? 'supportWhatsapp' THEN p_payload->>'supportWhatsapp'
        ELSE support_whatsapp END,
      free_delivery_radius_km = CASE
        WHEN p_payload ? 'freeDeliveryRadiusKm' THEN (p_payload->>'freeDeliveryRadiusKm')::numeric
        ELSE free_delivery_radius_km END,
      rate_per_excess_km = CASE
        WHEN p_payload ? 'ratePerExcessKm' THEN (p_payload->>'ratePerExcessKm')::integer
        ELSE rate_per_excess_km END,
      max_delivery_radius_km = CASE
        WHEN p_payload ? 'maxDeliveryRadiusKm' THEN (p_payload->>'maxDeliveryRadiusKm')::numeric
        ELSE max_delivery_radius_km END,
      cod_max_radius_km = CASE
        WHEN p_payload ? 'codMaxRadiusKm' THEN (p_payload->>'codMaxRadiusKm')::numeric
        ELSE cod_max_radius_km END,
      minimum_order_value = CASE
        WHEN p_payload ? 'minimumOrderValue' THEN (p_payload->>'minimumOrderValue')::integer
        ELSE minimum_order_value END,
      minimum_order_value_dine_in = CASE
        WHEN p_payload ? 'minimumOrderValueDineIn' THEN (p_payload->>'minimumOrderValueDineIn')::integer
        ELSE minimum_order_value_dine_in END,
      packaging_fee_default = CASE
        WHEN p_payload ? 'packagingFeeDefault' THEN (p_payload->>'packagingFeeDefault')::integer
        ELSE packaging_fee_default END,
      packaging_fee_dine_in = CASE
        WHEN p_payload ? 'packagingFeeDineIn' THEN (p_payload->>'packagingFeeDineIn')::integer
        ELSE packaging_fee_dine_in END,
      max_cart_value = CASE
        WHEN p_payload ? 'maxCartValue' THEN (p_payload->>'maxCartValue')::integer
        ELSE max_cart_value END,
      max_item_quantity = CASE
        WHEN p_payload ? 'maxItemQuantity' THEN (p_payload->>'maxItemQuantity')::integer
        ELSE max_item_quantity END,
      max_cart_lines = CASE
        WHEN p_payload ? 'maxCartLines' THEN (p_payload->>'maxCartLines')::integer
        ELSE max_cart_lines END,
      is_store_open = CASE
        WHEN p_payload ? 'isStoreOpen' THEN (p_payload->>'isStoreOpen')::boolean
        ELSE is_store_open END,
      opening_time = CASE
        WHEN p_payload ? 'openingTime' THEN (p_payload->>'openingTime')::time
        ELSE opening_time END,
      closing_time = CASE
        WHEN p_payload ? 'closingTime' THEN (p_payload->>'closingTime')::time
        ELSE closing_time END,
      is_kitchen_busy = CASE
        WHEN p_payload ? 'isKitchenBusy' THEN (p_payload->>'isKitchenBusy')::boolean
        ELSE is_kitchen_busy END,
      busy_buffer_minutes = CASE
        WHEN p_payload ? 'busyBufferMinutes' THEN (p_payload->>'busyBufferMinutes')::integer
        ELSE busy_buffer_minutes END,
      is_kitchen_paused = CASE
        WHEN p_payload ? 'isKitchenPaused' THEN (p_payload->>'isKitchenPaused')::boolean
        ELSE is_kitchen_paused END,
      pin_max_attempts = CASE
        WHEN p_payload ? 'pinMaxAttempts' THEN (p_payload->>'pinMaxAttempts')::integer
        ELSE pin_max_attempts END,
      pin_lock_minutes = CASE
        WHEN p_payload ? 'pinLockMinutes' THEN (p_payload->>'pinLockMinutes')::integer
        ELSE pin_lock_minutes END,
      pin_geofence_m = CASE
        WHEN p_payload ? 'pinGeofenceM' THEN (p_payload->>'pinGeofenceM')::integer
        ELSE pin_geofence_m END,
      staff_session_hours = CASE
        WHEN p_payload ? 'staffSessionHours' THEN (p_payload->>'staffSessionHours')::integer
        ELSE staff_session_hours END,
      updated_by = auth.uid()
  WHERE id = 1;

  SELECT to_jsonb(s) INTO v_after FROM public.app_settings s WHERE id = 1;

  -- settings_history is written by tr_app_settings_audit.
  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_UPDATE_SETTINGS', 'app_settings', '1',
    p_reason, v_before, v_after
  );

  RETURN jsonb_build_object('success', true, 'settings', v_after);
END;
$$;

-- ============================================================================
-- 5. ADMIN ORDER CONTACT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_order_contact(
  p_order_id UUID,
  p_customer_name TEXT DEFAULT NULL,
  p_customer_phone TEXT DEFAULT NULL,
  p_customer_notes TEXT DEFAULT NULL,
  p_delivery_address_text TEXT DEFAULT NULL,
  p_delivery_area TEXT DEFAULT NULL,
  p_delivery_latitude NUMERIC DEFAULT NULL,
  p_delivery_longitude NUMERIC DEFAULT NULL,
  p_road_distance_m INTEGER DEFAULT NULL,
  p_delivery_fee INTEGER DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: reason required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_order.order_status IN ('OUT_FOR_DELIVERY', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED') THEN
    RAISE EXCEPTION 'ORDER_STATE_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  IF (p_delivery_latitude IS NULL) <> (p_delivery_longitude IS NULL) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: latitude and longitude are required together'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_delivery_latitude IS NOT NULL
     AND (p_road_distance_m IS NULL OR p_delivery_fee IS NULL) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: distance and fee are required when coordinates change'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_order.order_type = 'DINE_IN'
     AND (p_delivery_latitude IS NOT NULL OR p_road_distance_m IS NOT NULL OR p_delivery_fee IS NOT NULL) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: dine-in orders have no delivery data'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders
  SET customer_name = coalesce(p_customer_name, customer_name),
      customer_phone = coalesce(p_customer_phone, customer_phone),
      customer_notes = coalesce(p_customer_notes, customer_notes),
      delivery_address_text = coalesce(p_delivery_address_text, delivery_address_text),
      delivery_area = coalesce(p_delivery_area, delivery_area),
      delivery_latitude = coalesce(p_delivery_latitude, delivery_latitude),
      delivery_longitude = coalesce(p_delivery_longitude, delivery_longitude),
      road_distance_m = coalesce(p_road_distance_m, road_distance_m),
      delivery_fee = coalesce(p_delivery_fee, delivery_fee),
      admin_edited_at = timezone('utc', now()),
      admin_edited_by = auth.uid()
  WHERE id = p_order_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_UPDATE_ORDER_CONTACT', 'orders', p_order_id::text,
    p_reason, to_jsonb(v_order),
    jsonb_build_object(
      'customerName', coalesce(p_customer_name, v_order.customer_name),
      'customerPhone', coalesce(p_customer_phone, v_order.customer_phone),
      'roadDistanceM', coalesce(p_road_distance_m, v_order.road_distance_m),
      'deliveryFee', coalesce(p_delivery_fee, v_order.delivery_fee)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'totalAmount', (
      SELECT total_amount FROM public.orders WHERE id = p_order_id
    )
  );
END;
$$;

-- ============================================================================
-- 6. ADMIN CATALOGUE
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_upsert_category(
  p_payload JSONB,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_before JSONB;
  v_after JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: reason required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_payload->>'name' IS NULL OR p_payload->>'slug' IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: category name and slug are required'
      USING ERRCODE = 'P0001';
  END IF;

  v_id := coalesce((p_payload->>'id')::uuid, gen_random_uuid());

  SELECT to_jsonb(c) INTO v_before FROM public.categories c WHERE id = v_id;

  IF v_before IS NULL THEN
    INSERT INTO public.categories (id, name, slug, display_order, is_active)
    VALUES (
      v_id,
      p_payload->>'name',
      p_payload->>'slug',
      coalesce((p_payload->>'displayOrder')::integer, 0),
      coalesce((p_payload->>'isActive')::boolean, true)
    );
  ELSE
    UPDATE public.categories
    SET name = p_payload->>'name',
        slug = p_payload->>'slug',
        display_order = coalesce((p_payload->>'displayOrder')::integer, display_order),
        is_active = coalesce((p_payload->>'isActive')::boolean, is_active)
    WHERE id = v_id;
  END IF;

  SELECT to_jsonb(c) INTO v_after FROM public.categories c WHERE id = v_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_UPSERT_CATEGORY', 'categories', v_id::text,
    p_reason, v_before, v_after
  );

  RETURN jsonb_build_object('success', true, 'categoryId', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_menu_item(
  p_payload JSONB,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_category_id UUID;
  v_before JSONB;
  v_after JSONB;
  v_group_id UUID;
  v_sort INTEGER := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: reason required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_payload->>'name' IS NULL
     OR p_payload->>'slug' IS NULL
     OR p_payload->>'categoryId' IS NULL
     OR p_payload->>'basePrice' IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: name, slug, categoryId, and basePrice are required'
      USING ERRCODE = 'P0001';
  END IF;

  v_category_id := (p_payload->>'categoryId')::uuid;

  IF NOT EXISTS (SELECT 1 FROM public.categories WHERE id = v_category_id) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: unknown category'
      USING ERRCODE = 'P0001';
  END IF;

  v_id := coalesce((p_payload->>'id')::uuid, gen_random_uuid());

  SELECT to_jsonb(m) INTO v_before FROM public.menu_items m WHERE id = v_id;

  IF v_before IS NULL THEN
    INSERT INTO public.menu_items (
      id, category_id, name, slug, description, base_price, image_url,
      prep_time_minutes, is_available, is_active, is_combo, sort_order
    ) VALUES (
      v_id,
      v_category_id,
      p_payload->>'name',
      p_payload->>'slug',
      p_payload->>'description',
      (p_payload->>'basePrice')::integer,
      p_payload->>'imageUrl',
      coalesce((p_payload->>'prepTimeMinutes')::integer, 20),
      coalesce((p_payload->>'isAvailable')::boolean, true),
      coalesce((p_payload->>'isActive')::boolean, true),
      coalesce((p_payload->>'isCombo')::boolean, false),
      coalesce((p_payload->>'sortOrder')::integer, 0)
    );
  ELSE
    UPDATE public.menu_items
    SET category_id = v_category_id,
        name = p_payload->>'name',
        slug = p_payload->>'slug',
        description = p_payload->>'description',
        base_price = (p_payload->>'basePrice')::integer,
        image_url = p_payload->>'imageUrl',
        prep_time_minutes = coalesce((p_payload->>'prepTimeMinutes')::integer, prep_time_minutes),
        is_available = coalesce((p_payload->>'isAvailable')::boolean, is_available),
        is_active = coalesce((p_payload->>'isActive')::boolean, is_active),
        is_combo = coalesce((p_payload->>'isCombo')::boolean, is_combo),
        sort_order = coalesce((p_payload->>'sortOrder')::integer, sort_order)
    WHERE id = v_id;
  END IF;

  IF p_payload ? 'modifierGroupIds' THEN
    DELETE FROM public.menu_item_modifier_groups WHERE menu_item_id = v_id;

    FOR v_group_id IN
      SELECT value::uuid FROM jsonb_array_elements_text(p_payload->'modifierGroupIds')
    LOOP
      IF NOT EXISTS (SELECT 1 FROM public.modifier_groups WHERE id = v_group_id) THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: unknown modifier group %', v_group_id
          USING ERRCODE = 'P0001';
      END IF;

      INSERT INTO public.menu_item_modifier_groups (menu_item_id, group_id, sort_order)
      VALUES (v_id, v_group_id, v_sort);

      v_sort := v_sort + 1;
    END LOOP;
  END IF;

  SELECT to_jsonb(m) INTO v_after FROM public.menu_items m WHERE id = v_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_UPSERT_MENU_ITEM', 'menu_items', v_id::text,
    p_reason, v_before, v_after
  );

  RETURN jsonb_build_object('success', true, 'itemId', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_modifier_group(
  p_payload JSONB,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_before JSONB;
  v_after JSONB;
  v_option JSONB;
  v_option_id UUID;
  v_existing_group UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: reason required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_payload->>'name' IS NULL
     OR p_payload->>'selectionType' IS NULL
     OR p_payload->>'minSelections' IS NULL
     OR p_payload->>'maxSelections' IS NULL
     OR p_payload->>'isRequired' IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: group name, selection type, and selection bounds are required'
      USING ERRCODE = 'P0001';
  END IF;

  v_id := coalesce((p_payload->>'id')::uuid, gen_random_uuid());

  SELECT to_jsonb(g) INTO v_before FROM public.modifier_groups g WHERE id = v_id;

  IF v_before IS NULL THEN
    INSERT INTO public.modifier_groups (
      id, name, selection_type, min_selections, max_selections,
      is_required, is_active, sort_order
    ) VALUES (
      v_id,
      p_payload->>'name',
      (p_payload->>'selectionType')::public.modifier_selection_type,
      (p_payload->>'minSelections')::integer,
      (p_payload->>'maxSelections')::integer,
      (p_payload->>'isRequired')::boolean,
      coalesce((p_payload->>'isActive')::boolean, true),
      coalesce((p_payload->>'sortOrder')::integer, 0)
    );
  ELSE
    UPDATE public.modifier_groups
    SET name = p_payload->>'name',
        selection_type = (p_payload->>'selectionType')::public.modifier_selection_type,
        min_selections = (p_payload->>'minSelections')::integer,
        max_selections = (p_payload->>'maxSelections')::integer,
        is_required = (p_payload->>'isRequired')::boolean,
        is_active = coalesce((p_payload->>'isActive')::boolean, is_active),
        sort_order = coalesce((p_payload->>'sortOrder')::integer, sort_order)
    WHERE id = v_id;
  END IF;

  IF p_payload ? 'options' THEN
    FOR v_option IN SELECT value FROM jsonb_array_elements(p_payload->'options')
    LOOP
      IF v_option->>'name' IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: modifier option name is required'
          USING ERRCODE = 'P0001';
      END IF;

      v_option_id := coalesce((v_option->>'id')::uuid, gen_random_uuid());

      SELECT group_id INTO v_existing_group
      FROM public.item_modifiers
      WHERE id = v_option_id;

      IF v_existing_group IS NOT NULL AND v_existing_group <> v_id THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: option % belongs to another group', v_option_id
          USING ERRCODE = 'P0001';
      END IF;

      IF v_existing_group IS NULL THEN
        INSERT INTO public.item_modifiers (
          id, group_id, name, modifier_type, price_delta, is_active, sort_order
        ) VALUES (
          v_option_id,
          v_id,
          v_option->>'name',
          coalesce((v_option->>'modifierType')::public.modifier_type, 'PAID_ADDON'),
          coalesce((v_option->>'priceDelta')::integer, 0),
          coalesce((v_option->>'isActive')::boolean, true),
          coalesce((v_option->>'sortOrder')::integer, 0)
        );
      ELSE
        UPDATE public.item_modifiers
        SET name = v_option->>'name',
            modifier_type = coalesce((v_option->>'modifierType')::public.modifier_type, modifier_type),
            price_delta = coalesce((v_option->>'priceDelta')::integer, price_delta),
            is_active = coalesce((v_option->>'isActive')::boolean, is_active),
            sort_order = coalesce((v_option->>'sortOrder')::integer, sort_order)
        WHERE id = v_option_id;
      END IF;
    END LOOP;
  END IF;

  SELECT to_jsonb(g) INTO v_after FROM public.modifier_groups g WHERE id = v_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_UPSERT_MODIFIER_GROUP', 'modifier_groups', v_id::text,
    p_reason, v_before, v_after
  );

  RETURN jsonb_build_object('success', true, 'groupId', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_combo(
  p_payload JSONB,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_combo_item_id UUID;
  v_before JSONB;
  v_after JSONB;
  v_step JSONB;
  v_step_id UUID;
  v_option JSONB;
  v_option_id UUID;
  v_option_item_id UUID;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: reason required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_payload->>'comboItemId' IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: comboItemId is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_combo_item_id := (p_payload->>'comboItemId')::uuid;

  IF NOT EXISTS (SELECT 1 FROM public.menu_items WHERE id = v_combo_item_id) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: unknown combo item'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_agg(to_jsonb(s) ORDER BY s.step_order)
  INTO v_before
  FROM public.combo_steps s
  WHERE s.combo_item_id = v_combo_item_id;

  UPDATE public.menu_items
  SET is_combo = true
  WHERE id = v_combo_item_id;

  IF p_payload ? 'steps' THEN
    FOR v_step IN SELECT value FROM jsonb_array_elements(p_payload->'steps')
    LOOP
      IF v_step->>'name' IS NULL
         OR v_step->>'stepOrder' IS NULL
         OR v_step->>'minSelections' IS NULL
         OR v_step->>'maxSelections' IS NULL THEN
        RAISE EXCEPTION 'VALIDATION_ERROR: step name, order, and selection bounds are required'
          USING ERRCODE = 'P0001';
      END IF;

      v_step_id := coalesce((v_step->>'id')::uuid, gen_random_uuid());

      INSERT INTO public.combo_steps (
        id, combo_item_id, name, step_order, min_selections, max_selections, is_required
      ) VALUES (
        v_step_id,
        v_combo_item_id,
        v_step->>'name',
        (v_step->>'stepOrder')::integer,
        (v_step->>'minSelections')::integer,
        (v_step->>'maxSelections')::integer,
        coalesce((v_step->>'isRequired')::boolean, true)
      )
      ON CONFLICT (id) DO UPDATE
      SET combo_item_id = EXCLUDED.combo_item_id,
          name = EXCLUDED.name,
          step_order = EXCLUDED.step_order,
          min_selections = EXCLUDED.min_selections,
          max_selections = EXCLUDED.max_selections,
          is_required = EXCLUDED.is_required;

      IF v_step ? 'options' THEN
        FOR v_option IN SELECT value FROM jsonb_array_elements(v_step->'options')
        LOOP
          IF v_option->>'optionItemId' IS NULL THEN
            RAISE EXCEPTION 'VALIDATION_ERROR: combo option item is required'
              USING ERRCODE = 'P0001';
          END IF;

          v_option_item_id := (v_option->>'optionItemId')::uuid;

          IF NOT EXISTS (SELECT 1 FROM public.menu_items WHERE id = v_option_item_id) THEN
            RAISE EXCEPTION 'VALIDATION_ERROR: unknown combo option item %', v_option_item_id
              USING ERRCODE = 'P0001';
          END IF;

          v_option_id := coalesce((v_option->>'id')::uuid, gen_random_uuid());

          INSERT INTO public.combo_step_options (
            id, step_id, option_item_id, price_delta, is_default, sort_order
          ) VALUES (
            v_option_id,
            v_step_id,
            v_option_item_id,
            coalesce((v_option->>'priceDelta')::integer, 0),
            coalesce((v_option->>'isDefault')::boolean, false),
            coalesce((v_option->>'sortOrder')::integer, 0)
          )
          ON CONFLICT (id) DO UPDATE
          SET step_id = EXCLUDED.step_id,
              option_item_id = EXCLUDED.option_item_id,
              price_delta = EXCLUDED.price_delta,
              is_default = EXCLUDED.is_default,
              sort_order = EXCLUDED.sort_order;
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  SELECT jsonb_agg(to_jsonb(s) ORDER BY s.step_order)
  INTO v_after
  FROM public.combo_steps s
  WHERE s.combo_item_id = v_combo_item_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_UPSERT_COMBO', 'menu_items', v_combo_item_id::text,
    p_reason, v_before, v_after
  );

  RETURN jsonb_build_object('success', true, 'comboItemId', v_combo_item_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_table(
  p_payload JSONB,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_before JSONB;
  v_after JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: reason required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_payload->>'tableNumber' IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: tableNumber is required'
      USING ERRCODE = 'P0001';
  END IF;

  v_id := coalesce((p_payload->>'id')::uuid, gen_random_uuid());

  SELECT to_jsonb(t) INTO v_before FROM public.tables t WHERE id = v_id;

  IF v_before IS NULL THEN
    INSERT INTO public.tables (id, table_number, label, is_active)
    VALUES (
      v_id,
      p_payload->>'tableNumber',
      p_payload->>'label',
      coalesce((p_payload->>'isActive')::boolean, true)
    );
  ELSE
    UPDATE public.tables
    SET table_number = p_payload->>'tableNumber',
        label = p_payload->>'label',
        is_active = coalesce((p_payload->>'isActive')::boolean, is_active)
    WHERE id = v_id;
  END IF;

  SELECT to_jsonb(t) INTO v_after FROM public.tables t WHERE id = v_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_UPSERT_TABLE', 'tables', v_id::text,
    p_reason, v_before, v_after
  );

  RETURN jsonb_build_object(
    'success', true,
    'tableId', v_id,
    'qrToken', v_after->>'qr_token'
  );
END;
$$;

-- ============================================================================
-- 7. ADMIN STAFF AND REFUNDS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_update_staff(
  p_profile_id UUID,
  p_role public.user_role,
  p_is_active BOOLEAN,
  p_motorcycle_plate TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before JSONB;
  v_after JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: reason required'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_profile_id IS NULL OR p_role IS NULL OR p_is_active IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: profile, role, and active state are required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT to_jsonb(p) INTO v_before FROM public.profiles p WHERE id = p_profile_id;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: profile not found'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles
  SET role = p_role,
      is_active = p_is_active,
      motorcycle_plate = CASE WHEN p_role = 'RIDER' THEN p_motorcycle_plate ELSE NULL END
  WHERE id = p_profile_id;

  SELECT to_jsonb(p) INTO v_after FROM public.profiles p WHERE id = p_profile_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_UPDATE_STAFF', 'profiles', p_profile_id::text,
    p_reason, v_before, v_after
  );

  RETURN jsonb_build_object('success', true, 'profileId', p_profile_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_approve_refund(
  p_refund_id UUID,
  p_decision TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_refund public.refunds%ROWTYPE;
  v_new_status public.refund_status;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_decision IS NULL OR p_decision NOT IN ('APPROVE', 'REJECT') THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: decision must be APPROVE or REJECT'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_refund
  FROM public.refunds
  WHERE id = p_refund_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: refund not found'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_decision = 'APPROVE' THEN
    IF v_refund.status = 'REQUESTED' THEN
      v_new_status := 'PROCESSING';
    ELSIF v_refund.status IN ('PROCESSING', 'COMPLETED') THEN
      v_new_status := v_refund.status;
    ELSE
      RAISE EXCEPTION 'ORDER_STATE_INVALID: refund cannot be approved from %', v_refund.status
        USING ERRCODE = 'P0001';
    END IF;
  ELSE
    IF v_refund.status = 'REQUESTED' THEN
      v_new_status := 'FAILED';
    ELSIF v_refund.status = 'FAILED' THEN
      v_new_status := 'FAILED';
    ELSE
      RAISE EXCEPTION 'ORDER_STATE_INVALID: refund cannot be rejected from %', v_refund.status
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  UPDATE public.refunds
  SET status = v_new_status,
      approved_by = auth.uid(),
      approved_at = timezone('utc', now()),
      approval_notes = p_notes
  WHERE id = p_refund_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(),
    CASE WHEN p_decision = 'APPROVE' THEN 'ADMIN_APPROVE_REFUND' ELSE 'ADMIN_REJECT_REFUND' END,
    'refunds', p_refund_id::text,
    coalesce(nullif(trim(p_notes), ''), p_decision),
    to_jsonb(v_refund),
    jsonb_build_object('status', v_new_status, 'decision', p_decision)
  );

  RETURN jsonb_build_object(
    'success', true,
    'refundId', p_refund_id,
    'status', v_new_status
  );
END;
$$;

-- ============================================================================
-- 8. GRANTS
-- ============================================================================

REVOKE ALL ON FUNCTION public.start_payment_attempt(UUID, public.payment_method, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.resolve_payment_tx_ref(TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_redeliver_order(UUID, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_settings(JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_order_contact(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, TEXT
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_upsert_category(JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_upsert_menu_item(JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_upsert_modifier_group(JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_upsert_combo(JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_upsert_table(JSONB, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_update_staff(UUID, public.user_role, BOOLEAN, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_approve_refund(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;

-- The order token is the capability for payment initiation.
GRANT EXECUTE ON FUNCTION public.start_payment_attempt(UUID, public.payment_method, TEXT)
  TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.resolve_payment_tx_ref(TEXT) TO service_role;

GRANT EXECUTE ON FUNCTION public.admin_redeliver_order(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_settings(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_order_contact(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER, TEXT
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_category(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_menu_item(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_modifier_group(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_combo(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_table(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_staff(UUID, public.user_role, BOOLEAN, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_refund(UUID, TEXT, TEXT) TO authenticated;

COMMIT;
