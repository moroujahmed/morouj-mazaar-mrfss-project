-- ============================================================================
-- PROJECT-BAZAAR-D2C / MRFSS — v1.4 remediation
-- Target: PostgreSQL 15+ / Supabase (validated on PostgreSQL 18)
-- Date: 2026-11-12
-- ============================================================================
-- Additive remediation for the v1.4 end-to-end audit. This migration:
--   * completes settings, webhook, refund, audit, and blacklist fields;
--   * protects the last active admin;
--   * closes FSM gaps used by admin completion/reassignment;
--   * makes acknowledged/ready timestamps deterministic;
--   * fixes rider, customer, kitchen, admin, ledger, and settlement RPCs;
--   * adds the missing admin list/audit and shift-closing RPCs;
--   * restores explicit grants for every new/replaced function.
--
-- It never edits the already-applied initial migration.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. SCHEMA ADDITIONS
-- ============================================================================

ALTER TABLE public.app_settings
  ADD COLUMN max_cart_lines INTEGER NOT NULL DEFAULT 30
    CHECK (max_cart_lines BETWEEN 1 AND 100);

ALTER TABLE public.webhook_events
  ADD COLUMN error TEXT CHECK (error IS NULL OR length(error) <= 2000);

ALTER TABLE public.refunds
  ADD COLUMN approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN approved_at TIMESTAMPTZ,
  ADD COLUMN approval_notes TEXT
    CHECK (approval_notes IS NULL OR length(approval_notes) <= 500);

ALTER TABLE public.admin_audit_log
  ADD COLUMN reason TEXT CHECK (reason IS NULL OR length(reason) <= 1000);

-- Normalize any legacy rows before enforcing E.164.
UPDATE public.blacklisted_phones
SET phone = public.normalize_ug_phone(phone)
WHERE phone !~ '^\+256[0-9]{9}$';

CREATE OR REPLACE FUNCTION public.normalize_blacklisted_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.phone := public.normalize_ug_phone(NEW.phone);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_blacklisted_phones_normalize ON public.blacklisted_phones;
CREATE TRIGGER tr_blacklisted_phones_normalize
  BEFORE INSERT OR UPDATE OF phone ON public.blacklisted_phones
  FOR EACH ROW EXECUTE FUNCTION public.normalize_blacklisted_phone();

ALTER TABLE public.blacklisted_phones
  ADD CONSTRAINT blacklisted_phones_e164
  CHECK (phone ~ '^\+256[0-9]{9}$');

-- ============================================================================
-- 2. LAST-ACTIVE-ADMIN PROTECTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_last_active_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_other_admins INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'ADMIN' AND OLD.is_active = true THEN
      SELECT count(*) INTO v_other_admins
      FROM public.profiles
      WHERE id <> OLD.id AND role = 'ADMIN' AND is_active = true;

      IF v_other_admins = 0 THEN
        RAISE EXCEPTION 'LAST_ADMIN_PROTECTED'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF OLD.role = 'ADMIN' AND OLD.is_active = true
     AND (NEW.role <> 'ADMIN' OR NEW.is_active = false) THEN
    SELECT count(*) INTO v_other_admins
    FROM public.profiles
    WHERE id <> OLD.id AND role = 'ADMIN' AND is_active = true;

    IF v_other_admins = 0 THEN
      RAISE EXCEPTION 'LAST_ADMIN_PROTECTED'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_profiles_protect_last_admin ON public.profiles;
CREATE TRIGGER tr_profiles_protect_last_admin
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_active_admin();

-- ============================================================================
-- 3. ORDER STATE MACHINE AND HISTORY
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_order_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_pair TEXT;
BEGIN
  IF NEW.order_status IS NOT DISTINCT FROM OLD.order_status THEN
    RETURN NEW;
  END IF;

  v_pair := OLD.order_status::text || '->' || NEW.order_status::text;

  -- Every path into PREPARING is acknowledged, including verified prepaid
  -- webhooks that bypass the kitchen accept action.
  IF NEW.order_status = 'PREPARING' THEN
    NEW.acknowledged_at := coalesce(NEW.acknowledged_at, now());
  END IF;

  -- First transition into a ready/served state is the kitchen prep boundary.
  IF NEW.order_status = 'READY_FOR_PICKUP'
     OR (OLD.order_status = 'PREPARING' AND NEW.order_status = 'DELIVERED') THEN
    NEW.ready_at := coalesce(NEW.ready_at, now());
  END IF;

  IF v_pair IN (
    'PENDING_PAYMENT->PREPARING',
    'PENDING_PAYMENT->CANCELLED',
    'CONFIRMED_UNPAID->PREPARING',
    'CONFIRMED_UNPAID->CANCELLED',
    'PREPARING->READY_FOR_PICKUP',
    'PREPARING->DELIVERED',
    'PREPARING->CANCELLED',
    'READY_FOR_PICKUP->CLAIMED',
    'READY_FOR_PICKUP->DELIVERED',
    'READY_FOR_PICKUP->CANCELLED',
    'CLAIMED->OUT_FOR_DELIVERY',
    'CLAIMED->READY_FOR_PICKUP',
    'CLAIMED->DELIVERED',
    'CLAIMED->CANCELLED',
    'OUT_FOR_DELIVERY->CLAIMED',
    'OUT_FOR_DELIVERY->DELIVERED',
    'OUT_FOR_DELIVERY->DELIVERY_FAILED',
    'OUT_FOR_DELIVERY->CANCELLED',
    'DELIVERY_FAILED->READY_FOR_PICKUP',
    'DELIVERY_FAILED->CANCELLED'
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'ORDER_STATE_INVALID: % -> %', OLD.order_status, NEW.order_status
    USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.record_order_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor UUID;
  v_role public.user_role;
  v_reason TEXT;
BEGIN
  IF NEW.order_status IS NOT DISTINCT FROM OLD.order_status THEN
    RETURN NEW;
  END IF;

  v_actor := public.current_actor_id();

  IF v_actor IS NOT NULL THEN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = v_actor;
  END IF;

  v_reason := nullif(current_setting('app.transition_reason', true), '');

  INSERT INTO public.order_status_history (
    order_id, from_status, to_status, actor_id, actor_role, reason, metadata
  ) VALUES (
    NEW.id,
    OLD.order_status,
    NEW.order_status,
    v_actor,
    v_role,
    coalesce(v_reason, 'STATUS_CHANGED'),
    jsonb_build_object(
      'version', NEW.version,
      'paymentStatus', NEW.payment_status
    )
  );

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 4. PUBLIC SETTINGS AND CUSTOMER TRACKER
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_public_settings()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'restaurantName', restaurant_name,
    'restaurantLat', restaurant_lat,
    'restaurantLng', restaurant_lng,
    'supportWhatsapp', support_whatsapp,
    'currency', currency,
    'timezone', timezone,
    'freeDeliveryRadiusKm', free_delivery_radius_km,
    'ratePerExcessKm', rate_per_excess_km,
    'maxDeliveryRadiusKm', max_delivery_radius_km,
    'codMaxRadiusKm', cod_max_radius_km,
    'minimumOrderValue', minimum_order_value,
    'minimumOrderValueDineIn', minimum_order_value_dine_in,
    'packagingFeeDefault', packaging_fee_default,
    'packagingFeeDineIn', packaging_fee_dine_in,
    'maxCartValue', max_cart_value,
    'maxItemQuantity', max_item_quantity,
    'maxCartLines', max_cart_lines,
    'isStoreOpen', is_store_open,
    'openingTime', opening_time,
    'closingTime', closing_time,
    'isKitchenBusy', is_kitchen_busy,
    'busyBufferMinutes', busy_buffer_minutes,
    'isKitchenPaused', is_kitchen_paused
  )
  FROM public.app_settings
  WHERE id = 1;
$$;

CREATE OR REPLACE VIEW public.public_settings_view
WITH (security_invoker = false)
AS
SELECT
  id,
  restaurant_name,
  restaurant_lat,
  restaurant_lng,
  support_whatsapp,
  currency,
  timezone,
  free_delivery_radius_km,
  rate_per_excess_km,
  max_delivery_radius_km,
  cod_max_radius_km,
  minimum_order_value,
  minimum_order_value_dine_in,
  packaging_fee_default,
  packaging_fee_dine_in,
  is_store_open,
  opening_time,
  closing_time,
  is_kitchen_busy,
  busy_buffer_minutes,
  is_kitchen_paused,
  max_cart_value,
  max_item_quantity,
  max_cart_lines
FROM public.app_settings
WHERE id = 1;

CREATE OR REPLACE FUNCTION public.get_order_by_token(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_token IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'orderToken', o.order_token,
    'orderNumber', o.order_number,
    'orderType', o.order_type,
    'source', o.source,
    'status', o.order_status,
    'paymentStatus', o.payment_status,
    'paymentMethod', o.payment_method,
    'customerName', o.customer_name,
    'tableNumber', o.table_number,
    'deliveryArea', o.delivery_area,
    'itemsSubtotal', o.items_subtotal,
    'modifiersTotal', o.modifiers_total,
    'deliveryFee', o.delivery_fee,
    'packagingFee', o.packaging_fee,
    'totalAmount', o.total_amount,
    'codChangeRequestedFor', o.cod_change_requested_for,
    'codChangeDue', o.cod_change_due,
    -- Dine-in orders never use a handover PIN; terminal orders no longer need it.
    'handoverPin', CASE
      WHEN o.order_type = 'DELIVERY'
       AND o.order_status NOT IN ('DELIVERED', 'DELIVERY_FAILED', 'CANCELLED')
      THEN o.handover_pin
      ELSE NULL
    END,
    'etaAt', o.eta_at,
    'acknowledgedAt', o.acknowledged_at,
    'roadDistanceM', o.road_distance_m,
    'estimatedTravelMinutes', o.estimated_travel_minutes,
    'createdAt', o.created_at,
    'readyAt', o.ready_at,
    'deliveredAt', o.delivered_at,
    'cancelledAt', o.cancelled_at,
    'cancellationReason', o.cancellation_reason,
    'canRate', (o.order_status = 'DELIVERED' AND o.customer_rating IS NULL),
    'feedback', CASE
      WHEN o.customer_rating IS NULL THEN NULL
      ELSE jsonb_build_object(
        'rating', o.customer_rating,
        'notes', o.customer_feedback_notes
      )
    END,
    'refund', (
      SELECT jsonb_build_object(
        'status', r.status,
        'amount', r.amount,
        'reason', r.reason,
        'requestedAt', r.created_at,
        'completedAt', r.completed_at
      )
      FROM public.refunds r
      WHERE r.order_id = o.id
      ORDER BY r.created_at DESC
      LIMIT 1
    ),
    'deliveryFailure', (
      SELECT jsonb_build_object(
        'outcome', d.outcome,
        'reason', d.reason,
        'createdAt', d.created_at
      )
      FROM public.delivery_attempts d
      WHERE d.order_id = o.id
      ORDER BY d.created_at DESC
      LIMIT 1
    ),
    'rider', CASE
      WHEN o.order_status IN ('CLAIMED', 'OUT_FOR_DELIVERY') THEN jsonb_build_object(
        'name', p.full_name,
        'phone', p.phone_number,
        'latitude', CASE WHEN o.order_status = 'OUT_FOR_DELIVERY' THEN t.latitude END,
        'longitude', CASE WHEN o.order_status = 'OUT_FOR_DELIVERY' THEN t.longitude END,
        'updatedAt', CASE WHEN o.order_status = 'OUT_FOR_DELIVERY' THEN t.updated_at END
      )
      ELSE NULL
    END,
    'items', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', oi.item_name_snapshot,
          'quantity', oi.quantity,
          'unitPrice', oi.unit_price_snapshot,
          'lineTotal', oi.line_total,
          'modifiers', coalesce((
            SELECT jsonb_agg(
              jsonb_build_object(
                'name', m.name_snapshot,
                'priceDelta', m.price_delta_snapshot
              )
              ORDER BY m.id
            )
            FROM public.order_item_modifiers m
            WHERE m.order_item_id = oi.id
          ), '[]'::jsonb)
        )
        ORDER BY oi.created_at, oi.id
      )
      FROM public.order_items oi
      WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.orders o
  LEFT JOIN public.profiles p ON p.id = o.rider_id
  LEFT JOIN public.rider_telemetry t ON t.rider_id = o.rider_id AND t.order_id = o.id
  WHERE o.order_token = p_token;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- 5. RIDER RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_rider_pool()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_rider() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(
      jsonb_build_object(
        'orderId', o.id,
        'orderNumber', o.order_number,
        'area', o.delivery_area,
        'distanceKm', round(o.road_distance_m::numeric / 1000, 2),
        'totalAmount', o.total_amount,
        'paymentMethod', o.payment_method,
        'itemCount', coalesce((
          SELECT sum(oi.quantity)::integer
          FROM public.order_items oi
          WHERE oi.order_id = o.id
        ), 0),
        'readyAt', coalesce(o.ready_at, o.updated_at)
      )
      ORDER BY coalesce(o.ready_at, o.updated_at) ASC
    )
    FROM public.orders o
    WHERE o.order_status = 'READY_FOR_PICKUP'
      AND o.order_type = 'DELIVERY'
      AND o.rider_id IS NULL
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_order_atomic(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_rider() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.orders
    WHERE rider_id = auth.uid()
      AND order_status IN ('CLAIMED', 'OUT_FOR_DELIVERY')
  ) THEN
    RAISE EXCEPTION 'RIDER_HAS_ACTIVE_ORDER'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.transition_reason', 'RIDER_CLAIMED', true);

  BEGIN
    UPDATE public.orders
    SET rider_id = auth.uid(),
        order_status = 'CLAIMED',
        claimed_at = timezone('utc', now())
    WHERE id = p_order_id
      AND order_status = 'READY_FOR_PICKUP'
      AND rider_id IS NULL
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'RIDER_HAS_ACTIVE_ORDER'
      USING ERRCODE = 'P0001';
  END;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_ALREADY_CLAIMED'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN public.get_rider_active_order();
END;
$$;

CREATE OR REPLACE FUNCTION public.start_delivery(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_rider() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.transition_reason', 'RIDER_STARTED_DELIVERY', true);

  UPDATE public.orders
  SET order_status = 'OUT_FOR_DELIVERY',
      dispatched_at = timezone('utc', now())
  WHERE id = p_order_id
    AND rider_id = auth.uid()
    AND order_status = 'CLAIMED'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_STATE_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN public.get_rider_active_order();
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_delivery_pin(
  p_order_id UUID,
  p_pin TEXT,
  p_lat NUMERIC DEFAULT NULL,
  p_lng NUMERIC DEFAULT NULL,
  p_ip_hash TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_max_attempts INTEGER;
  v_lock_minutes INTEGER;
  v_geofence_m INTEGER;
  v_attempts INTEGER;
  v_locked_until TIMESTAMPTZ;
  v_distance_m NUMERIC;
  v_now TIMESTAMPTZ := timezone('utc', now());
BEGIN
  IF NOT public.is_rider() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
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

  -- A rider may never probe or complete another rider's order.
  IF v_order.rider_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_order.order_status <> 'OUT_FOR_DELIVERY' THEN
    RAISE EXCEPTION 'ORDER_STATE_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_order.pin_locked_until IS NOT NULL AND v_order.pin_locked_until > v_now THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'PIN_LOCKED',
      'lockedUntil', v_order.pin_locked_until
    );
  END IF;

  SELECT pin_max_attempts, pin_lock_minutes, pin_geofence_m
  INTO v_max_attempts, v_lock_minutes, v_geofence_m
  FROM public.app_settings
  WHERE id = 1;

  IF v_geofence_m > 0
     AND p_lat IS NOT NULL
     AND p_lng IS NOT NULL
     AND v_order.delivery_latitude IS NOT NULL
     AND v_order.delivery_longitude IS NOT NULL THEN
    v_distance_m := public.haversine_m(
      p_lat, p_lng,
      v_order.delivery_latitude, v_order.delivery_longitude
    );

    IF v_distance_m > v_geofence_m THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'TOO_FAR_FROM_DESTINATION',
        'distanceM', round(v_distance_m, 0),
        'allowedM', v_geofence_m
      );
    END IF;
  END IF;

  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' OR p_pin <> v_order.handover_pin THEN
    v_attempts := v_order.failed_pin_attempts + 1;
    v_locked_until := CASE
      WHEN v_attempts >= v_max_attempts
        THEN v_now + (v_lock_minutes || ' minutes')::interval
      ELSE NULL
    END;

    UPDATE public.orders
    SET failed_pin_attempts = v_attempts,
        pin_locked_until = v_locked_until,
        security_flag = CASE WHEN v_locked_until IS NOT NULL THEN 'PIN_LOCKED' ELSE security_flag END
    WHERE id = v_order.id;

    INSERT INTO public.pin_verification_attempts (
      order_id, rider_id, success, ip_hash, user_agent
    ) VALUES (
      v_order.id, auth.uid(), false, p_ip_hash, p_user_agent
    );

    RETURN jsonb_build_object(
      'ok', false,
      'code', CASE WHEN v_locked_until IS NOT NULL THEN 'PIN_LOCKED' ELSE 'INVALID_HANDOVER_PIN' END,
      'remainingAttempts', greatest(v_max_attempts - v_attempts, 0),
      'lockedUntil', v_locked_until
    );
  END IF;

  PERFORM set_config('app.transition_reason', 'PIN_VERIFIED', true);

  UPDATE public.orders
  SET order_status = 'DELIVERED',
      delivered_at = v_now,
      failed_pin_attempts = 0,
      pin_locked_until = NULL,
      security_flag = NULL,
      payment_status = CASE
        WHEN payment_method = 'CASH_ON_DELIVERY' THEN 'PAID'::public.payment_status
        ELSE payment_status
      END,
      cod_collected_at = CASE
        WHEN payment_method = 'CASH_ON_DELIVERY' THEN v_now
        ELSE cod_collected_at
      END
  WHERE id = v_order.id;

  INSERT INTO public.pin_verification_attempts (
    order_id, rider_id, success, ip_hash, user_agent
  ) VALUES (
    v_order.id, auth.uid(), true, p_ip_hash, p_user_agent
  );

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'DELIVERED',
    'changeDue', v_order.cod_change_due,
    'deliveredAt', v_now
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.report_delivery_failed(
  p_order_id UUID,
  p_outcome public.delivery_outcome,
  p_reason TEXT,
  p_lat NUMERIC DEFAULT NULL,
  p_lng NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.is_rider() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_outcome = 'DELIVERED' THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: use verify_delivery_pin for a successful delivery'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config(
    'app.transition_reason',
    coalesce(nullif(trim(p_reason), ''), 'DELIVERY_FAILED:' || p_outcome::text),
    true
  );

  UPDATE public.orders
  SET order_status = 'DELIVERY_FAILED',
      security_flag = 'DELIVERY_FAILED'
  WHERE id = p_order_id
    AND rider_id = auth.uid()
    AND order_status = 'OUT_FOR_DELIVERY'
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_STATE_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.delivery_attempts (
    order_id, rider_id, outcome, reason, latitude, longitude
  ) VALUES (
    p_order_id, auth.uid(), p_outcome, p_reason, p_lat, p_lng
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_rider_cash_summary(p_rider_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_rider UUID;
  v_unsettled INTEGER;
  v_shortfall INTEGER;
  v_settled INTEGER;
BEGIN
  v_rider := coalesce(p_rider_id, auth.uid());

  IF NOT (public.is_admin() OR v_rider = auth.uid()) THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(sum(total_amount), 0)::integer INTO v_unsettled
  FROM public.orders
  WHERE rider_id = v_rider
    AND payment_method = 'CASH_ON_DELIVERY'
    AND payment_status = 'PAID'
    AND order_status = 'DELIVERED'
    AND settlement_id IS NULL;

  -- A partial/disputed settlement leaves an outstanding shortfall even though
  -- its orders are linked to the settlement row.
  SELECT coalesce(sum(greatest(expected_cash - counted_cash, 0)), 0)::integer
  INTO v_shortfall
  FROM public.cash_settlements
  WHERE rider_id = v_rider
    AND status IN ('PARTIAL', 'DISPUTED');

  SELECT coalesce(sum(counted_cash), 0)::integer INTO v_settled
  FROM public.cash_settlements
  WHERE rider_id = v_rider;

  RETURN jsonb_build_object(
    'riderId', v_rider,
    'outstandingCash', v_unsettled + v_shortfall,
    'unsettledOrderCash', v_unsettled,
    'settlementShortfall', v_shortfall,
    'totalSettled', v_settled
  );
END;
$$;

-- ============================================================================
-- 6. KITCHEN RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_kitchen_orders()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_kitchen() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(
      jsonb_build_object(
        'orderId', o.id,
        'orderNumber', o.order_number,
        'status', o.order_status,
        'orderType', o.order_type,
        'tableNumber', o.table_number,
        'customerName', o.customer_name,
        'customerNotes', o.customer_notes,
        'paymentMethod', o.payment_method,
        'paymentStatus', o.payment_status,
        'totalAmount', o.total_amount,
        'codChangeRequestedFor', o.cod_change_requested_for,
        'codChangeDue', o.cod_change_due,
        'createdAt', o.created_at,
        'acknowledgedAt', o.acknowledged_at,
        'readyAt', o.ready_at,
        'kitchenBusyBufferApplied', o.kitchen_busy_buffer_applied,
        'items', coalesce((
          SELECT jsonb_agg(
            jsonb_build_object(
              'name', oi.item_name_snapshot,
              'quantity', oi.quantity,
              'modifiers', coalesce((
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'name', m.name_snapshot,
                    'priceDelta', m.price_delta_snapshot
                  )
                  ORDER BY m.id
                )
                FROM public.order_item_modifiers m
                WHERE m.order_item_id = oi.id
              ), '[]'::jsonb)
            )
            ORDER BY oi.created_at, oi.id
          )
          FROM public.order_items oi
          WHERE oi.order_id = o.id
        ), '[]'::jsonb)
      )
      ORDER BY o.created_at ASC
    )
    FROM public.orders o
    WHERE o.order_status IN ('CONFIRMED_UNPAID', 'PREPARING', 'READY_FOR_PICKUP')
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_kitchen_busy(
  p_busy BOOLEAN,
  p_buffer_minutes INTEGER DEFAULT NULL
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
  IF NOT public.is_kitchen() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT to_jsonb(s) INTO v_before FROM public.app_settings s WHERE id = 1;

  UPDATE public.app_settings
  SET is_kitchen_busy = p_busy,
      busy_buffer_minutes = coalesce(p_buffer_minutes, busy_buffer_minutes),
      updated_by = auth.uid()
  WHERE id = 1;

  SELECT to_jsonb(s) INTO v_after FROM public.app_settings s WHERE id = 1;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'SET_KITCHEN_BUSY', 'app_settings', '1',
    CASE WHEN p_busy THEN 'KITCHEN_BUSY_ENABLED' ELSE 'KITCHEN_BUSY_DISABLED' END,
    v_before, v_after
  );

  RETURN jsonb_build_object(
    'success', true,
    'isKitchenBusy', p_busy,
    'busyBufferMinutes', (v_after->>'busy_buffer_minutes')::integer
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_kitchen_paused(
  p_paused BOOLEAN
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
  IF NOT public.is_kitchen() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT to_jsonb(s) INTO v_before FROM public.app_settings s WHERE id = 1;

  UPDATE public.app_settings
  SET is_kitchen_paused = p_paused,
      updated_by = auth.uid()
  WHERE id = 1;

  SELECT to_jsonb(s) INTO v_after FROM public.app_settings s WHERE id = 1;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'SET_KITCHEN_PAUSED', 'app_settings', '1',
    CASE WHEN p_paused THEN 'KITCHEN_INTAKE_PAUSED' ELSE 'KITCHEN_INTAKE_RESUMED' END,
    v_before, v_after
  );

  RETURN jsonb_build_object(
    'success', true,
    'isKitchenPaused', p_paused
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_menu_item_availability(
  p_item_id UUID,
  p_available BOOLEAN
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
  IF NOT public.is_kitchen() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT to_jsonb(m) INTO v_before FROM public.menu_items m WHERE id = p_item_id;

  IF v_before IS NULL THEN
    RAISE EXCEPTION 'ITEM_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.menu_items
  SET is_available = p_available
  WHERE id = p_item_id;

  SELECT to_jsonb(m) INTO v_after FROM public.menu_items m WHERE id = p_item_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'SET_ITEM_AVAILABILITY', 'menu_items', p_item_id::text,
    CASE WHEN p_available THEN 'ITEM_AVAILABLE' ELSE 'ITEM_UNAVAILABLE' END,
    v_before, v_after
  );

  RETURN jsonb_build_object('success', true, 'itemId', p_item_id, 'isAvailable', p_available);
END;
$$;

-- ============================================================================
-- 7. ADMIN RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'orderId', o.id,
    'orderNumber', o.order_number,
    'orderToken', o.order_token,
    'status', o.order_status,
    'paymentStatus', o.payment_status,
    'paymentMethod', o.payment_method,
    'paymentReference', o.payment_reference,
    'customerName', o.customer_name,
    'customerPhone', o.customer_phone_normalized,
    'customerNotes', o.customer_notes,
    'orderType', o.order_type,
    'source', o.source,
    'tableNumber', o.table_number,
    'deliveryAddressText', o.delivery_address_text,
    'deliveryArea', o.delivery_area,
    'deliveryLatitude', o.delivery_latitude,
    'deliveryLongitude', o.delivery_longitude,
    'roadDistanceM', o.road_distance_m,
    'estimatedTravelMinutes', o.estimated_travel_minutes,
    'etaAt', o.eta_at,
    'itemsSubtotal', o.items_subtotal,
    'modifiersTotal', o.modifiers_total,
    'deliveryFee', o.delivery_fee,
    'packagingFee', o.packaging_fee,
    'totalAmount', o.total_amount,
    'codChangeRequestedFor', o.cod_change_requested_for,
    'codChangeDue', o.cod_change_due,
    'handoverPin', o.handover_pin,
    'failedPinAttempts', o.failed_pin_attempts,
    'pinLockedUntil', o.pin_locked_until,
    'securityFlag', o.security_flag,
    'riderId', o.rider_id,
    'rider', CASE
      WHEN o.rider_id IS NULL THEN NULL
      ELSE (
        SELECT jsonb_build_object(
          'id', rp.id,
          'name', rp.full_name,
          'phone', rp.phone_number,
          'motorcyclePlate', rp.motorcycle_plate
        )
        FROM public.profiles rp
        WHERE rp.id = o.rider_id
      )
    END,
    'settlementId', o.settlement_id,
    'settledAt', o.settled_at,
    'version', o.version,
    'createdAt', o.created_at,
    'acknowledgedAt', o.acknowledged_at,
    'claimedAt', o.claimed_at,
    'dispatchedAt', o.dispatched_at,
    'readyAt', o.ready_at,
    'deliveredAt', o.delivered_at,
    'cancelledAt', o.cancelled_at,
    'cancellationReason', o.cancellation_reason,
    'items', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'name', oi.item_name_snapshot,
          'quantity', oi.quantity,
          'unitPrice', oi.unit_price_snapshot,
          'lineTotal', oi.line_total,
          'modifiers', coalesce((
            SELECT jsonb_agg(
              jsonb_build_object(
                'name', m.name_snapshot,
                'priceDelta', m.price_delta_snapshot
              )
              ORDER BY m.id
            )
            FROM public.order_item_modifiers m
            WHERE m.order_item_id = oi.id
          ), '[]'::jsonb)
        )
        ORDER BY oi.created_at, oi.id
      )
      FROM public.order_items oi
      WHERE oi.order_id = o.id
    ), '[]'::jsonb),
    'statusHistory', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'fromStatus', h.from_status,
          'toStatus', h.to_status,
          'actorId', h.actor_id,
          'actorRole', h.actor_role,
          'reason', h.reason,
          'metadata', h.metadata,
          'createdAt', h.created_at
        )
        ORDER BY h.created_at ASC, h.id ASC
      )
      FROM public.order_status_history h
      WHERE h.order_id = o.id
    ), '[]'::jsonb),
    'pinAttempts', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'riderId', pa.rider_id,
          'success', pa.success,
          'createdAt', pa.created_at
        )
        ORDER BY pa.created_at DESC
      )
      FROM public.pin_verification_attempts pa
      WHERE pa.order_id = o.id
    ), '[]'::jsonb),
    'deliveryAttempts', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'riderId', da.rider_id,
          'outcome', da.outcome,
          'reason', da.reason,
          'latitude', da.latitude,
          'longitude', da.longitude,
          'createdAt', da.created_at
        )
        ORDER BY da.created_at DESC
      )
      FROM public.delivery_attempts da
      WHERE da.order_id = o.id
    ), '[]'::jsonb),
    'paymentTransactions', coalesce((
      SELECT jsonb_agg(to_jsonb(pt) ORDER BY pt.created_at DESC)
      FROM public.payment_transactions pt
      WHERE pt.order_id = o.id
    ), '[]'::jsonb),
    'refunds', coalesce((
      SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at DESC)
      FROM public.refunds r
      WHERE r.order_id = o.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM public.orders o
  WHERE o.id = p_order_id;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_complete_order(
  p_order_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
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

  IF v_order.order_status NOT IN ('CLAIMED', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP') THEN
    RAISE EXCEPTION 'ORDER_STATE_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.transition_reason', p_reason, true);

  UPDATE public.orders
  SET order_status = 'DELIVERED',
      delivered_at = v_now,
      security_flag = 'ADMIN_PIN_OVERRIDE',
      payment_status = CASE
        WHEN payment_method = 'CASH_ON_DELIVERY' THEN 'PAID'::public.payment_status
        ELSE payment_status
      END,
      cod_collected_at = CASE
        WHEN payment_method = 'CASH_ON_DELIVERY' THEN v_now
        ELSE cod_collected_at
      END
  WHERE id = p_order_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_COMPLETE_ORDER', 'orders', p_order_id::text,
    p_reason, to_jsonb(v_order), jsonb_build_object('reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'orderId', p_order_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_order(
  p_order_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_refund_id UUID;
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

  IF v_order.order_status IN ('DELIVERED', 'CANCELLED') THEN
    RAISE EXCEPTION 'ORDER_STATE_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.transition_reason', p_reason, true);

  UPDATE public.orders
  SET order_status = 'CANCELLED',
      cancelled_at = timezone('utc', now()),
      cancelled_by = auth.uid(),
      cancellation_reason = p_reason
  WHERE id = p_order_id;

  IF v_order.payment_status = 'PAID' THEN
    SELECT r.id INTO v_refund_id
    FROM public.refunds r
    WHERE r.order_id = p_order_id
      AND r.status IN ('REQUESTED', 'PROCESSING', 'COMPLETED')
    ORDER BY r.created_at DESC
    LIMIT 1;

    IF v_refund_id IS NULL THEN
      INSERT INTO public.refunds (
        order_id, payment_transaction_id, amount, reason, status, initiated_by
      ) VALUES (
        p_order_id, v_order.payment_transaction_id, v_order.total_amount, p_reason, 'REQUESTED', auth.uid()
      )
      RETURNING id INTO v_refund_id;
    END IF;
  END IF;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_CANCEL_ORDER', 'orders', p_order_id::text,
    p_reason, to_jsonb(v_order),
    jsonb_build_object('reason', p_reason, 'refundId', v_refund_id)
  );

  RETURN jsonb_build_object('success', true, 'orderId', p_order_id, 'refundId', v_refund_id);
END;
$$;

DROP FUNCTION IF EXISTS public.admin_reassign_order(UUID, UUID);

CREATE OR REPLACE FUNCTION public.admin_reassign_order(
  p_order_id UUID,
  p_rider_id UUID,
  p_reason TEXT
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

  SELECT * INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_order.order_status NOT IN ('CLAIMED', 'OUT_FOR_DELIVERY') THEN
    RAISE EXCEPTION 'ORDER_STATE_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.transition_reason', p_reason, true);

  BEGIN
    UPDATE public.orders
    SET rider_id = p_rider_id,
        order_status = 'CLAIMED',
        claimed_at = timezone('utc', now()),
        dispatched_at = NULL
    WHERE id = p_order_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'RIDER_HAS_ACTIVE_ORDER'
      USING ERRCODE = 'P0001';
  END;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_REASSIGN_ORDER', 'orders', p_order_id::text,
    p_reason, to_jsonb(v_order),
    jsonb_build_object('riderId', p_rider_id, 'reason', p_reason)
  );

  RETURN jsonb_build_object('success', true, 'orderId', p_order_id, 'riderId', p_rider_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_handover_pin(
  p_order_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_bytes BYTEA;
  v_pin TEXT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: reason required'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_order.order_type <> 'DELIVERY'
     OR v_order.order_status IN ('DELIVERED', 'DELIVERY_FAILED', 'CANCELLED') THEN
    RAISE EXCEPTION 'ORDER_STATE_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  v_bytes := gen_random_bytes(2);
  v_pin := lpad((((get_byte(v_bytes, 0) * 256) + get_byte(v_bytes, 1)) % 9000 + 1000)::text, 4, '0');

  UPDATE public.orders
  SET handover_pin = v_pin,
      failed_pin_attempts = 0,
      pin_locked_until = NULL,
      security_flag = 'PIN_RESET_BY_ADMIN'
  WHERE id = p_order_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_RESET_HANDOVER_PIN', 'orders', p_order_id::text,
    p_reason, jsonb_build_object('reason', p_reason),
    jsonb_build_object('pinReset', true)
  );

  RETURN jsonb_build_object('success', true, 'orderId', p_order_id, 'handoverPin', v_pin);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_orders(
  p_status TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit INTEGER := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset INTEGER := greatest(0, coalesce(p_offset, 0));
  v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_status IS NOT NULL
     AND p_status NOT IN (SELECT unnest(enum_range(NULL::public.order_status)::text[])) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: invalid status'
      USING ERRCODE = 'P0001';
  END IF;

  WITH filtered AS (
    SELECT o.*, rp.full_name AS rider_name
    FROM public.orders o
    LEFT JOIN public.profiles rp ON rp.id = o.rider_id
    WHERE (p_status IS NULL OR o.order_status::text = p_status)
      AND (
        p_search IS NULL OR trim(p_search) = ''
        OR o.order_number::text ILIKE '%' || trim(p_search) || '%'
        OR o.customer_name ILIKE '%' || trim(p_search) || '%'
        OR o.customer_phone_normalized ILIKE '%' || trim(p_search) || '%'
      )
  ), page AS (
    SELECT * FROM filtered
    ORDER BY created_at DESC
    LIMIT v_limit OFFSET v_offset
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtered),
    'limit', v_limit,
    'offset', v_offset,
    'orders', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'orderId', p.id,
          'orderNumber', p.order_number,
          'customerName', p.customer_name,
          'customerPhone', p.customer_phone_normalized,
          'status', p.order_status,
          'paymentStatus', p.payment_status,
          'paymentMethod', p.payment_method,
          'orderType', p.order_type,
          'deliveryArea', p.delivery_area,
          'tableNumber', p.table_number,
          'riderId', p.rider_id,
          'riderName', p.rider_name,
          'totalAmount', p.total_amount,
          'createdAt', p.created_at,
          'acknowledgedAt', p.acknowledged_at,
          'readyAt', p.ready_at,
          'etaAt', p.eta_at
        )
        ORDER BY p.created_at DESC
      )
      FROM page p
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_audit_feed(
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_entity_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit INTEGER := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset INTEGER := greatest(0, coalesce(p_offset, 0));
  v_result JSONB;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  WITH filtered AS (
    SELECT a.*, p.full_name AS actor_name, p.role AS actor_role
    FROM public.admin_audit_log a
    LEFT JOIN public.profiles p ON p.id = a.actor_id
    WHERE p_entity_type IS NULL OR a.entity_type = p_entity_type
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM filtered),
    'limit', v_limit,
    'offset', v_offset,
    'events', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'actorId', f.actor_id,
          'actorName', f.actor_name,
          'actorRole', f.actor_role,
          'action', f.action,
          'entityType', f.entity_type,
          'entityId', f.entity_id,
          'reason', f.reason,
          'before', f.before_state,
          'after', f.after_state,
          'createdAt', f.created_at
        )
        ORDER BY f.created_at DESC, f.id DESC
      )
      FROM filtered f
      LIMIT v_limit OFFSET v_offset
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_rider_cash(
  p_rider_id UUID,
  p_counted_cash INTEGER,
  p_notes TEXT DEFAULT NULL,
  p_business_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_date DATE := coalesce(p_business_date, (now() AT TIME ZONE 'Africa/Kampala')::date);
  v_expected INTEGER;
  v_shortfall INTEGER;
  v_settlement public.cash_settlements%ROWTYPE;
  v_status public.settlement_status;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_rider_id AND role = 'RIDER' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: invalid rider'
      USING ERRCODE = 'P0001';
  END IF;

  IF p_counted_cash IS NULL OR p_counted_cash < 0 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: counted cash must be >= 0'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(sum(total_amount), 0)::integer INTO v_expected
  FROM public.orders
  WHERE rider_id = p_rider_id
    AND payment_method = 'CASH_ON_DELIVERY'
    AND payment_status = 'PAID'
    AND order_status = 'DELIVERED'
    AND (delivered_at AT TIME ZONE 'Africa/Kampala')::date = v_date;

  v_shortfall := greatest(v_expected - p_counted_cash, 0);
  v_status := CASE WHEN v_shortfall = 0 THEN 'SETTLED'::public.settlement_status
                   ELSE 'PARTIAL'::public.settlement_status END;

  INSERT INTO public.cash_settlements (
    rider_id, business_date, expected_cash, counted_cash, status, settled_by, notes, settled_at
  ) VALUES (
    p_rider_id, v_date, v_expected, p_counted_cash, v_status, auth.uid(), p_notes,
    timezone('utc', now())
  )
  ON CONFLICT (rider_id, business_date) DO UPDATE
  SET expected_cash = EXCLUDED.expected_cash,
      counted_cash = EXCLUDED.counted_cash,
      status = EXCLUDED.status,
      settled_by = EXCLUDED.settled_by,
      notes = EXCLUDED.notes,
      settled_at = EXCLUDED.settled_at
  RETURNING * INTO v_settlement;

  UPDATE public.orders
  SET settlement_id = v_settlement.id,
      settled_at = timezone('utc', now())
  WHERE rider_id = p_rider_id
    AND payment_method = 'CASH_ON_DELIVERY'
    AND payment_status = 'PAID'
    AND order_status = 'DELIVERED'
    AND settlement_id IS NULL
    AND (delivered_at AT TIME ZONE 'Africa/Kampala')::date = v_date;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, reason, before_state, after_state
  ) VALUES (
    auth.uid(), 'RECONCILE_RIDER_CASH', 'cash_settlements', v_settlement.id::text,
    coalesce(p_notes, 'END_OF_DAY_RECONCILIATION'),
    NULL,
    jsonb_build_object(
      'riderId', p_rider_id,
      'businessDate', v_date,
      'expectedCash', v_expected,
      'countedCash', p_counted_cash,
      'variance', p_counted_cash - v_expected,
      'shortfall', v_shortfall
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'settlementId', v_settlement.id,
    'riderId', p_rider_id,
    'businessDate', v_date,
    'expectedCash', v_expected,
    'countedCash', p_counted_cash,
    'variance', p_counted_cash - v_expected,
    'shortfall', v_shortfall,
    'status', v_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_ledger(p_business_date DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_date DATE := coalesce(p_business_date, (now() AT TIME ZONE 'Africa/Kampala')::date);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN coalesce((
    SELECT jsonb_agg(
      jsonb_build_object(
        'riderId', p.id,
        'riderName', p.full_name,
        'motorcyclePlate', p.motorcycle_plate,
        'expectedCash', coalesce(agg.expected_cash, 0),
        'settledCash', coalesce(s.counted_cash, 0),
        'variance', coalesce(s.variance, 0),
        'status', coalesce(s.status, 'OPEN'),
        'linkedOrders', coalesce(agg.linked_orders, '[]'::jsonb)
      )
      ORDER BY p.full_name
    )
    FROM public.profiles p
    LEFT JOIN (
      SELECT
        rider_id,
        sum(total_amount)::integer AS expected_cash,
        jsonb_agg(
          jsonb_build_object(
            'orderId', id,
            'orderNumber', order_number,
            'amount', total_amount
          )
          ORDER BY delivered_at, order_number
        ) AS linked_orders
      FROM public.orders
      WHERE payment_method = 'CASH_ON_DELIVERY'
        AND payment_status = 'PAID'
        AND order_status = 'DELIVERED'
        AND (delivered_at AT TIME ZONE 'Africa/Kampala')::date = v_date
      GROUP BY rider_id
    ) agg ON agg.rider_id = p.id
    LEFT JOIN public.cash_settlements s
      ON s.rider_id = p.id
     AND s.business_date = v_date
    WHERE p.role = 'RIDER'
      AND p.is_active = true
  ), '[]'::jsonb);
END;
$$;

-- ============================================================================
-- 8. SYSTEM / CRON RPCs
-- ============================================================================

CREATE OR REPLACE FUNCTION public.expire_pending_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  PERFORM set_config('app.transition_reason', 'PAYMENT_TIMEOUT', true);

  WITH expired AS (
    UPDATE public.orders
    SET order_status = 'CANCELLED',
        payment_status = 'FAILED',
        cancelled_at = timezone('utc', now()),
        cancellation_reason = 'PAYMENT_TIMEOUT'
    WHERE order_status = 'PENDING_PAYMENT'
      AND payment_status = 'PENDING'
      AND created_at < timezone('utc', now()) - INTERVAL '10 minutes'
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM expired;

  UPDATE public.payment_transactions pt
  SET status = 'FAILED'
  WHERE pt.status IN ('INITIATED', 'PENDING')
    AND pt.order_id IN (
      SELECT o.id
      FROM public.orders o
      WHERE o.order_status = 'CANCELLED'
        AND o.cancellation_reason = 'PAYMENT_TIMEOUT'
        AND o.cancelled_at >= timezone('utc', now()) - INTERVAL '1 minute'
    );

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.close_open_rider_shifts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  WITH closed AS (
    UPDATE public.rider_shifts rs
    SET ended_at = timezone('utc', now()),
        status = 'CLOSED',
        expected_cash = (
          SELECT coalesce(sum(o.total_amount), 0)::integer
          FROM public.orders o
          WHERE o.rider_id = rs.rider_id
            AND o.payment_method = 'CASH_ON_DELIVERY'
            AND o.payment_status = 'PAID'
            AND o.order_status = 'DELIVERED'
            AND o.settlement_id IS NULL
        )
    WHERE rs.ended_at IS NULL
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM closed;

  RETURN v_count;
END;
$$;

-- ============================================================================
-- 9. GRANTS
-- ============================================================================

REVOKE ALL ON FUNCTION public.admin_reassign_order(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_orders(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_get_audit_feed(INTEGER, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.close_open_rider_shifts() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_reassign_order(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_orders(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_audit_feed(INTEGER, INTEGER, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_open_rider_shifts() TO service_role;

-- The public settings view gained columns; keep its grants explicit.
REVOKE ALL ON public.public_settings_view FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_settings_view TO anon, authenticated, service_role;

COMMIT;
