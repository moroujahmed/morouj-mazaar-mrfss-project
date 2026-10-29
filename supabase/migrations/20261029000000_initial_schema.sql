-- ============================================================================
-- PROJECT-BAZAAR-D2C / MRFSS — Initial schema v1.1
-- Target: PostgreSQL 15+ / Supabase
-- Date: 2026-10-29
-- ============================================================================
-- This migration is the source of truth for the data model. It implements:
--   * Supabase Auth staff identity (no plaintext staff PINs)
--   * Deny-by-default RLS (no public order inserts, no rider-wide updates)
--   * Durable handover PIN attempts and lockout
--   * Cash settlement linkage to orders
--   * Payment/webhook idempotency
--   * Modifier groups and combo modeling
--   * Dine-in tables with unguessable QR tokens
--   * Audit/history/outbox tables
--   * Canonical UGX integer money and Africa/Kampala business dates
-- ============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. ENUMS
-- ============================================================================

CREATE TYPE public.order_status AS ENUM (
  'PENDING_PAYMENT',
  'CONFIRMED_UNPAID',
  'PREPARING',
  'READY_FOR_PICKUP',
  'CLAIMED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'DELIVERY_FAILED',
  'CANCELLED'
);

CREATE TYPE public.payment_method AS ENUM (
  'MTN_MOMO',
  'AIRTEL_MONEY',
  'CASH_ON_DELIVERY',
  'BANK_CARD'
);

CREATE TYPE public.payment_status AS ENUM (
  'PENDING',
  'PAID',
  'FAILED',
  'REFUNDED'
);

CREATE TYPE public.order_type AS ENUM ('DELIVERY', 'DINE_IN');

CREATE TYPE public.user_role AS ENUM ('CUSTOMER', 'KITCHEN', 'RIDER', 'ADMIN');

CREATE TYPE public.modifier_type AS ENUM ('OMISSION', 'COOKING_STYLE', 'PAID_ADDON');

CREATE TYPE public.modifier_selection_type AS ENUM ('SINGLE', 'MULTI');

CREATE TYPE public.feedback_rating AS ENUM ('GREAT', 'OKAY', 'BAD');

CREATE TYPE public.order_source AS ENUM ('WEB', 'TABLE_QR', 'ADMIN');

CREATE TYPE public.notification_channel AS ENUM ('SMS', 'WHATSAPP', 'PUSH');

CREATE TYPE public.notification_status AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

CREATE TYPE public.payment_tx_status AS ENUM (
  'INITIATED',
  'PENDING',
  'SUCCESSFUL',
  'FAILED',
  'ABANDONED'
);

CREATE TYPE public.refund_status AS ENUM ('REQUESTED', 'PROCESSING', 'COMPLETED', 'FAILED');

CREATE TYPE public.settlement_status AS ENUM ('OPEN', 'SETTLED', 'PARTIAL', 'DISPUTED');

CREATE TYPE public.delivery_outcome AS ENUM (
  'DELIVERED',
  'CUSTOMER_UNREACHABLE',
  'WRONG_ADDRESS',
  'REFUSED',
  'OTHER'
);

CREATE TYPE public.shift_status AS ENUM ('OPEN', 'CLOSED', 'SETTLED');

CREATE TYPE public.otp_purpose AS ENUM ('COD_VERIFICATION', 'STAFF_LOGIN');

-- ============================================================================
-- 2. SETTINGS
-- ============================================================================

CREATE TABLE public.app_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  restaurant_name TEXT NOT NULL DEFAULT 'Bazaar Flame & Grill',
  restaurant_lat NUMERIC(10, 7) NOT NULL DEFAULT 0.3136000
    CHECK (restaurant_lat BETWEEN -90 AND 90),
  restaurant_lng NUMERIC(10, 7) NOT NULL DEFAULT 32.5811000
    CHECK (restaurant_lng BETWEEN -180 AND 180),
  support_whatsapp TEXT NOT NULL DEFAULT '+256700000000',
  currency CHAR(3) NOT NULL DEFAULT 'UGX',
  timezone TEXT NOT NULL DEFAULT 'Africa/Kampala',

  free_delivery_radius_km NUMERIC(5, 2) NOT NULL DEFAULT 5.00
    CHECK (free_delivery_radius_km >= 0),
  rate_per_excess_km INTEGER NOT NULL DEFAULT 1500
    CHECK (rate_per_excess_km >= 0),
  max_delivery_radius_km NUMERIC(5, 2) NOT NULL DEFAULT 15.00
    CHECK (max_delivery_radius_km > 0),
  cod_max_radius_km NUMERIC(5, 2) NOT NULL DEFAULT 8.00
    CHECK (cod_max_radius_km > 0),

  minimum_order_value INTEGER NOT NULL DEFAULT 20000
    CHECK (minimum_order_value >= 0),
  minimum_order_value_dine_in INTEGER NOT NULL DEFAULT 0
    CHECK (minimum_order_value_dine_in >= 0),
  packaging_fee_default INTEGER NOT NULL DEFAULT 1000
    CHECK (packaging_fee_default >= 0),
  packaging_fee_dine_in INTEGER NOT NULL DEFAULT 0
    CHECK (packaging_fee_dine_in >= 0),
  max_cart_value INTEGER NOT NULL DEFAULT 200000
    CHECK (max_cart_value > 0),
  max_item_quantity INTEGER NOT NULL DEFAULT 20
    CHECK (max_item_quantity BETWEEN 1 AND 100),

  is_store_open BOOLEAN NOT NULL DEFAULT true,
  opening_time TIME NOT NULL DEFAULT '10:00:00',
  closing_time TIME NOT NULL DEFAULT '22:30:00',
  is_kitchen_busy BOOLEAN NOT NULL DEFAULT false,
  busy_buffer_minutes INTEGER NOT NULL DEFAULT 20
    CHECK (busy_buffer_minutes BETWEEN 0 AND 60),

  pin_max_attempts INTEGER NOT NULL DEFAULT 3
    CHECK (pin_max_attempts BETWEEN 1 AND 10),
  pin_lock_minutes INTEGER NOT NULL DEFAULT 15
    CHECK (pin_lock_minutes BETWEEN 1 AND 1440),
  pin_geofence_m INTEGER NOT NULL DEFAULT 300
    CHECK (pin_geofence_m BETWEEN 0 AND 5000),
  staff_session_hours INTEGER NOT NULL DEFAULT 12
    CHECK (staff_session_hours BETWEEN 1 AND 72),

  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT app_settings_radius_order
    CHECK (max_delivery_radius_km >= free_delivery_radius_km),
  CONSTRAINT app_settings_cod_within_max
    CHECK (cod_max_radius_km <= max_delivery_radius_km),
  CONSTRAINT app_settings_hours_order
    CHECK (opening_time < closing_time)
);

-- ============================================================================
-- 3. IDENTITY / STAFF
-- ============================================================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) BETWEEN 2 AND 120),
  phone_number TEXT NOT NULL UNIQUE CHECK (phone_number ~ '^\+256[0-9]{9}$'),
  role public.user_role NOT NULL DEFAULT 'CUSTOMER',
  motorcycle_plate TEXT CHECK (motorcycle_plate IS NULL OR length(trim(motorcycle_plate)) BETWEEN 3 AND 20),
  is_active BOOLEAN NOT NULL DEFAULT true,
  must_change_pin BOOLEAN NOT NULL DEFAULT true,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_login_attempts >= 0),
  locked_until TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================================================
-- 4. MENU
-- ============================================================================

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 120),
  slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
  description TEXT CHECK (description IS NULL OR length(description) <= 1000),
  base_price INTEGER NOT NULL CHECK (base_price >= 0),
  image_url TEXT,
  prep_time_minutes INTEGER NOT NULL DEFAULT 20
    CHECK (prep_time_minutes BETWEEN 0 AND 240),
  is_available BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_combo BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.menu_item_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  alt_text TEXT NOT NULL CHECK (length(trim(alt_text)) BETWEEN 3 AND 200),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (menu_item_id, sort_order)
);

CREATE TABLE public.modifier_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  selection_type public.modifier_selection_type NOT NULL DEFAULT 'SINGLE',
  min_selections INTEGER NOT NULL DEFAULT 0 CHECK (min_selections >= 0),
  max_selections INTEGER NOT NULL DEFAULT 1 CHECK (max_selections >= 1),
  is_required BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT modifier_group_selection_order CHECK (min_selections <= max_selections),
  CONSTRAINT modifier_group_required_min CHECK (NOT is_required OR min_selections >= 1),
  CONSTRAINT modifier_group_single_max CHECK (selection_type <> 'SINGLE' OR max_selections = 1)
);

CREATE TABLE public.item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  modifier_type public.modifier_type NOT NULL DEFAULT 'PAID_ADDON',
  price_delta INTEGER NOT NULL DEFAULT 0 CHECK (price_delta >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.menu_item_modifier_groups (
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.modifier_groups(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (menu_item_id, group_id)
);

CREATE TABLE public.combo_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 2 AND 80),
  step_order INTEGER NOT NULL DEFAULT 0,
  min_selections INTEGER NOT NULL DEFAULT 1 CHECK (min_selections >= 0),
  max_selections INTEGER NOT NULL DEFAULT 1 CHECK (max_selections >= 1),
  is_required BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (combo_item_id, step_order),
  CONSTRAINT combo_step_selection_order CHECK (min_selections <= max_selections),
  CONSTRAINT combo_step_required_min CHECK (NOT is_required OR min_selections >= 1)
);

CREATE TABLE public.combo_step_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES public.combo_steps(id) ON DELETE CASCADE,
  option_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  price_delta INTEGER NOT NULL DEFAULT 0 CHECK (price_delta >= 0),
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (step_id, option_item_id)
);

-- ============================================================================
-- 5. DINE-IN TABLES
-- ============================================================================

CREATE TABLE public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number TEXT NOT NULL UNIQUE CHECK (length(trim(table_number)) BETWEEN 1 AND 10),
  label TEXT,
  qr_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================================================
-- 6. CASH SETTLEMENTS (created before orders so orders can reference it)
-- ============================================================================

CREATE TABLE public.cash_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  business_date DATE NOT NULL DEFAULT ((now() AT TIME ZONE 'Africa/Kampala')::date),
  expected_cash INTEGER NOT NULL CHECK (expected_cash >= 0),
  counted_cash INTEGER NOT NULL CHECK (counted_cash >= 0),
  variance INTEGER GENERATED ALWAYS AS (counted_cash - expected_cash) STORED,
  status public.settlement_status NOT NULL DEFAULT 'OPEN',
  settled_by UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 1000),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (rider_id, business_date)
);

-- ============================================================================
-- 7. ORDERS
-- ============================================================================

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number BIGINT GENERATED BY DEFAULT AS IDENTITY (START WITH 1000) UNIQUE,
  order_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  order_type public.order_type NOT NULL DEFAULT 'DELIVERY',
  source public.order_source NOT NULL DEFAULT 'WEB',

  customer_name TEXT NOT NULL CHECK (length(trim(customer_name)) BETWEEN 2 AND 100),
  customer_phone TEXT NOT NULL,
  customer_phone_normalized TEXT NOT NULL CHECK (customer_phone_normalized ~ '^\+256[0-9]{9}$'),
  customer_notes TEXT CHECK (customer_notes IS NULL OR length(customer_notes) <= 500),

  table_id UUID REFERENCES public.tables(id) ON DELETE RESTRICT,
  table_number TEXT,
  delivery_address_text TEXT CHECK (delivery_address_text IS NULL OR length(delivery_address_text) <= 300),
  delivery_area TEXT CHECK (delivery_area IS NULL OR length(delivery_area) <= 100),
  delivery_latitude NUMERIC(10, 7) CHECK (delivery_latitude BETWEEN -90 AND 90),
  delivery_longitude NUMERIC(10, 7) CHECK (delivery_longitude BETWEEN -180 AND 180),
  road_distance_m INTEGER CHECK (road_distance_m IS NULL OR road_distance_m >= 0),
  estimated_travel_minutes INTEGER CHECK (estimated_travel_minutes IS NULL OR estimated_travel_minutes >= 0),
  eta_at TIMESTAMPTZ,

  items_subtotal INTEGER NOT NULL CHECK (items_subtotal >= 0),
  modifiers_total INTEGER NOT NULL DEFAULT 0 CHECK (modifiers_total >= 0),
  delivery_fee INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  packaging_fee INTEGER NOT NULL DEFAULT 0 CHECK (packaging_fee >= 0),
  total_amount INTEGER GENERATED ALWAYS AS
    (items_subtotal + modifiers_total + delivery_fee + packaging_fee) STORED,

  payment_method public.payment_method NOT NULL,
  payment_status public.payment_status NOT NULL DEFAULT 'PENDING',
  payment_reference TEXT,
  order_status public.order_status NOT NULL DEFAULT 'PENDING_PAYMENT',

  cod_change_requested_for INTEGER CHECK (cod_change_requested_for IS NULL OR cod_change_requested_for >= 0),
  cod_change_due INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN cod_change_requested_for IS NULL THEN NULL
      ELSE GREATEST(
        cod_change_requested_for - (items_subtotal + modifiers_total + delivery_fee + packaging_fee),
        0
      )
    END
  ) STORED,
  cod_collected_at TIMESTAMPTZ,

  handover_pin CHAR(4) NOT NULL CHECK (handover_pin ~ '^[0-9]{4}$'),
  failed_pin_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_pin_attempts >= 0),
  pin_locked_until TIMESTAMPTZ,
  security_flag TEXT,

  rider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  settlement_id UUID REFERENCES public.cash_settlements(id) ON DELETE SET NULL,
  settled_at TIMESTAMPTZ,

  kitchen_busy_buffer_applied INTEGER NOT NULL DEFAULT 0
    CHECK (kitchen_busy_buffer_applied BETWEEN 0 AND 60),
  acknowledged_at TIMESTAMPTZ,

  customer_rating public.feedback_rating,
  customer_feedback_notes TEXT CHECK (customer_feedback_notes IS NULL OR length(customer_feedback_notes) <= 1000),

  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_edited_at TIMESTAMPTZ,
  admin_edited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  version INTEGER NOT NULL DEFAULT 0 CHECK (version >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  claimed_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT orders_delivery_requires_coordinates CHECK (
    order_type <> 'DELIVERY'
    OR (delivery_latitude IS NOT NULL AND delivery_longitude IS NOT NULL AND table_id IS NULL)
  ),
  CONSTRAINT orders_dine_in_requires_table CHECK (
    order_type <> 'DINE_IN'
    OR (table_id IS NOT NULL AND delivery_latitude IS NULL AND delivery_longitude IS NULL)
  ),
  CONSTRAINT orders_cod_change_only_for_cod CHECK (
    cod_change_requested_for IS NULL OR payment_method = 'CASH_ON_DELIVERY'
  ),
  CONSTRAINT orders_cod_change_covers_total CHECK (
    cod_change_requested_for IS NULL
    OR cod_change_requested_for >= (items_subtotal + modifiers_total + delivery_fee + packaging_fee)
  ),
  CONSTRAINT orders_dine_in_zero_delivery CHECK (
    order_type <> 'DINE_IN' OR (delivery_fee = 0 AND packaging_fee = 0)
  )
);

CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  item_name_snapshot TEXT NOT NULL,
  unit_price_snapshot INTEGER NOT NULL CHECK (unit_price_snapshot >= 0),
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 100),
  line_total INTEGER GENERATED ALWAYS AS (unit_price_snapshot * quantity) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.order_item_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  modifier_id UUID REFERENCES public.item_modifiers(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  modifier_type_snapshot public.modifier_type NOT NULL DEFAULT 'PAID_ADDON',
  price_delta_snapshot INTEGER NOT NULL DEFAULT 0 CHECK (price_delta_snapshot >= 0),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.order_status_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_status public.order_status,
  to_status public.order_status NOT NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_role public.user_role,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.pin_verification_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  success BOOLEAN NOT NULL,
  ip_hash TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.delivery_attempts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  rider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  outcome public.delivery_outcome NOT NULL,
  reason TEXT CHECK (reason IS NULL OR length(reason) <= 1000),
  latitude NUMERIC(10, 7) CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(10, 7) CHECK (longitude BETWEEN -180 AND 180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.rider_telemetry (
  rider_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  latitude NUMERIC(10, 7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(10, 7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_m NUMERIC(7, 2) CHECK (accuracy_m IS NULL OR accuracy_m >= 0),
  heading NUMERIC(5, 2) CHECK (heading IS NULL OR (heading >= 0 AND heading < 360)),
  speed_mps NUMERIC(6, 2) CHECK (speed_mps IS NULL OR speed_mps >= 0),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.rider_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  ended_at TIMESTAMPTZ,
  opening_float INTEGER NOT NULL DEFAULT 0 CHECK (opening_float >= 0),
  expected_cash INTEGER CHECK (expected_cash IS NULL OR expected_cash >= 0),
  counted_cash INTEGER CHECK (counted_cash IS NULL OR counted_cash >= 0),
  status public.shift_status NOT NULL DEFAULT 'OPEN',
  settled_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  settled_at TIMESTAMPTZ,
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================================================
-- 8. PAYMENTS, WEBHOOKS, REFUNDS
-- ============================================================================

CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (length(trim(provider)) BETWEEN 2 AND 40),
  provider_transaction_id TEXT,
  tx_ref TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'UGX',
  method public.payment_method NOT NULL,
  status public.payment_tx_status NOT NULL DEFAULT 'INITIATED',
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.orders
  ADD COLUMN payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL;

CREATE TABLE public.webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  payment_transaction_id UUID REFERENCES public.payment_transactions(id) ON DELETE SET NULL,
  provider_refund_id TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 2 AND 500),
  status public.refund_status NOT NULL DEFAULT 'REQUESTED',
  initiated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  completed_at TIMESTAMPTZ
);

CREATE TABLE public.checkout_idempotency (
  idempotency_key UUID PRIMARY KEY,
  request_hash TEXT NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (timezone('utc', now()) + INTERVAL '24 hours')
);

-- ============================================================================
-- 9. OTP, BLACKLIST, NOTIFICATIONS
-- ============================================================================

CREATE TABLE public.otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  purpose public.otp_purpose NOT NULL DEFAULT 'COD_VERIFICATION',
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  consumed_at TIMESTAMPTZ,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.blacklisted_phones (
  phone TEXT PRIMARY KEY,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 2 AND 500),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  channel public.notification_channel NOT NULL DEFAULT 'SMS',
  recipient TEXT NOT NULL,
  template TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.notification_status NOT NULL DEFAULT 'PENDING',
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================================================
-- 10. AUDIT / SETTINGS HISTORY
-- ============================================================================

CREATE TABLE public.settings_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  before_state JSONB NOT NULL,
  after_state JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.admin_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_state JSONB,
  after_state JSONB,
  ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- ============================================================================
-- 11. INDEXES AND PARTIAL UNIQUENESS
-- ============================================================================

-- One active delivery per rider (ADR-011).
CREATE UNIQUE INDEX orders_one_active_per_rider
  ON public.orders (rider_id)
  WHERE rider_id IS NOT NULL
    AND order_status IN ('CLAIMED', 'OUT_FOR_DELIVERY');

CREATE INDEX orders_status_created_idx
  ON public.orders (order_status, created_at DESC);
CREATE INDEX orders_rider_status_idx
  ON public.orders (rider_id, order_status);
CREATE INDEX orders_phone_created_idx
  ON public.orders (customer_phone_normalized, created_at DESC);
CREATE INDEX orders_settlement_idx
  ON public.orders (settlement_id)
  WHERE settlement_id IS NOT NULL;
CREATE INDEX orders_payment_status_idx
  ON public.orders (payment_status, created_at DESC);
CREATE INDEX orders_created_idx
  ON public.orders (created_at DESC);

CREATE INDEX order_items_order_idx ON public.order_items (order_id);
CREATE INDEX order_item_modifiers_item_idx ON public.order_item_modifiers (order_item_id);
CREATE INDEX order_status_history_order_idx ON public.order_status_history (order_id, created_at DESC);
CREATE INDEX pin_attempts_order_idx ON public.pin_verification_attempts (order_id, created_at DESC);
CREATE INDEX delivery_attempts_order_idx ON public.delivery_attempts (order_id, created_at DESC);

CREATE INDEX menu_items_category_idx ON public.menu_items (category_id);
CREATE INDEX menu_items_public_idx ON public.menu_items (is_active, is_available, sort_order);
CREATE INDEX item_modifiers_group_idx ON public.item_modifiers (group_id);
CREATE INDEX menu_item_modifier_groups_group_idx ON public.menu_item_modifier_groups (group_id);
CREATE INDEX combo_steps_combo_idx ON public.combo_steps (combo_item_id, step_order);
CREATE INDEX combo_step_options_step_idx ON public.combo_step_options (step_id, sort_order);

CREATE INDEX cash_settlements_rider_date_idx
  ON public.cash_settlements (rider_id, business_date DESC);

CREATE UNIQUE INDEX rider_shifts_one_open
  ON public.rider_shifts (rider_id)
  WHERE ended_at IS NULL;

CREATE INDEX payment_transactions_order_idx
  ON public.payment_transactions (order_id, created_at DESC);
CREATE INDEX payment_transactions_txref_idx
  ON public.payment_transactions (tx_ref);
CREATE UNIQUE INDEX payment_transactions_provider_tx_uniq
  ON public.payment_transactions (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

CREATE INDEX refunds_order_idx ON public.refunds (order_id, created_at DESC);
CREATE INDEX checkout_idempotency_expires_idx ON public.checkout_idempotency (expires_at);
CREATE INDEX otp_phone_purpose_idx
  ON public.otp_verifications (phone, purpose, created_at DESC);
CREATE INDEX notifications_dispatch_idx
  ON public.notifications (status, next_attempt_at)
  WHERE status = 'PENDING';
CREATE INDEX admin_audit_entity_idx
  ON public.admin_audit_log (entity_type, entity_id, created_at DESC);
CREATE INDEX admin_audit_actor_idx
  ON public.admin_audit_log (actor_id, created_at DESC);
CREATE INDEX settings_history_created_idx
  ON public.settings_history (created_at DESC);

-- ============================================================================
-- 12. UTILITY FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.normalize_ug_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v TEXT;
BEGIN
  v := regexp_replace(coalesce(p_phone, ''), '[^0-9+]', '', 'g');

  IF v ~ '^\+256[0-9]{9}$' THEN
    RETURN v;
  ELSIF v ~ '^256[0-9]{9}$' THEN
    RETURN '+' || v;
  ELSIF v ~ '^0[0-9]{9}$' THEN
    RETURN '+256' || substr(v, 2);
  ELSE
    RETURN v;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'ADMIN'
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_kitchen()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('KITCHEN', 'ADMIN')
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('KITCHEN', 'ADMIN')
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_rider()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'RIDER'
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.current_actor_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_actor UUID;
BEGIN
  v_actor := nullif(current_setting('app.actor_id', true), '')::uuid;
  IF v_actor IS NULL THEN
    v_actor := auth.uid();
  END IF;
  RETURN v_actor;
END;
$$;

CREATE OR REPLACE FUNCTION public.haversine_m(
  p_lat1 NUMERIC,
  p_lng1 NUMERIC,
  p_lat2 NUMERIC,
  p_lng2 NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 6371000 * 2 * asin(
    sqrt(
      power(sin(radians((p_lat2 - p_lat1) / 2)), 2)
      + cos(radians(p_lat1)) * cos(radians(p_lat2))
        * power(sin(radians((p_lng2 - p_lng1) / 2)), 2)
    )
  );
$$;

-- ============================================================================
-- 13. TRIGGER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_order_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.version := OLD.version + 1;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_order_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.customer_phone_normalized := public.normalize_ug_phone(NEW.customer_phone);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_profile_phone()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.phone_number := public.normalize_ug_phone(NEW.phone_number);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_order_secrets()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_bytes BYTEA;
  v_num INTEGER;
BEGIN
  IF NEW.order_token IS NULL THEN
    NEW.order_token := gen_random_uuid();
  END IF;

  IF NEW.handover_pin IS NULL OR NEW.handover_pin = '' THEN
    v_bytes := gen_random_bytes(2);
    v_num := ((get_byte(v_bytes, 0) * 256) + get_byte(v_bytes, 1)) % 9000 + 1000;
    NEW.handover_pin := lpad(v_num::text, 4, '0');
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_order_token_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_token IS DISTINCT FROM OLD.order_token THEN
    RAISE EXCEPTION 'ORDER_TOKEN_IMMUTABLE'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

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

  IF v_pair IN (
    'PENDING_PAYMENT->PREPARING',
    'PENDING_PAYMENT->CANCELLED',
    'CONFIRMED_UNPAID->PREPARING',
    'CONFIRMED_UNPAID->CANCELLED',
    'PREPARING->READY_FOR_PICKUP',
    'PREPARING->DELIVERED',
    'PREPARING->CANCELLED',
    'READY_FOR_PICKUP->CLAIMED',
    'READY_FOR_PICKUP->CANCELLED',
    'CLAIMED->OUT_FOR_DELIVERY',
    'CLAIMED->READY_FOR_PICKUP',
    'CLAIMED->DELIVERED',
    'CLAIMED->CANCELLED',
    'OUT_FOR_DELIVERY->DELIVERED',
    'OUT_FOR_DELIVERY->DELIVERY_FAILED',
    'OUT_FOR_DELIVERY->CANCELLED'
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

  INSERT INTO public.order_status_history (
    order_id, from_status, to_status, actor_id, actor_role, reason, metadata
  ) VALUES (
    NEW.id,
    OLD.order_status,
    NEW.order_status,
    v_actor,
    v_role,
    nullif(current_setting('app.transition_reason', true), ''),
    jsonb_build_object(
      'version', NEW.version,
      'paymentStatus', NEW.payment_status
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.order_items_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ORDER_ITEMS_IMMUTABLE'
    USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_settings_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.settings_history (changed_by, before_state, after_state)
  VALUES (NEW.updated_by, to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$$;

-- ============================================================================
-- 14. TRIGGERS
-- ============================================================================

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE TRIGGER tr_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tr_profiles_normalize_phone
  BEFORE INSERT OR UPDATE OF phone_number ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.normalize_profile_phone();

CREATE TRIGGER tr_categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tr_menu_items_updated_at
  BEFORE UPDATE ON public.menu_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tr_tables_updated_at
  BEFORE UPDATE ON public.tables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tr_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tr_app_settings_audit
  AFTER UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.audit_settings_update();

CREATE TRIGGER tr_orders_normalize_phone
  BEFORE INSERT OR UPDATE OF customer_phone ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.normalize_order_phone();

CREATE TRIGGER tr_orders_generate_secrets
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_secrets();

CREATE TRIGGER tr_orders_token_immutable
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.prevent_order_token_change();

CREATE TRIGGER tr_orders_bump_version
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.bump_order_version();

CREATE TRIGGER tr_orders_enforce_transition
  BEFORE UPDATE OF order_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_order_transition();

CREATE TRIGGER tr_orders_record_status
  AFTER UPDATE OF order_status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.record_order_status_history();

CREATE TRIGGER tr_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tr_order_items_immutable
  BEFORE UPDATE OR DELETE ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_items_immutable();

CREATE TRIGGER tr_rider_telemetry_updated_at
  BEFORE UPDATE ON public.rider_telemetry
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 15. PUBLIC / CUSTOMER RPCs
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
    'isStoreOpen', is_store_open,
    'openingTime', opening_time,
    'closingTime', closing_time,
    'isKitchenBusy', is_kitchen_busy,
    'busyBufferMinutes', busy_buffer_minutes
  )
  FROM public.app_settings
  WHERE id = 1;
$$;

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
    'codChangeDue', o.cod_change_due,
    'handoverPin', o.handover_pin,
    'etaAt', o.eta_at,
    'createdAt', o.created_at,
    'deliveredAt', o.delivered_at,
    'canRate', (o.order_status = 'DELIVERED' AND o.customer_rating IS NULL),
    'feedback', CASE
      WHEN o.customer_rating IS NULL THEN NULL
      ELSE jsonb_build_object(
        'rating', o.customer_rating,
        'notes', o.customer_feedback_notes
      )
    END,
    'rider', CASE
      WHEN o.order_status = 'OUT_FOR_DELIVERY' THEN jsonb_build_object(
        'name', p.full_name,
        'phone', p.phone_number,
        'latitude', t.latitude,
        'longitude', t.longitude,
        'updatedAt', t.updated_at
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

CREATE OR REPLACE FUNCTION public.get_order_telemetry(p_token UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'latitude', t.latitude,
    'longitude', t.longitude,
    'updatedAt', t.updated_at
  )
  FROM public.orders o
  JOIN public.rider_telemetry t
    ON t.rider_id = o.rider_id
   AND t.order_id = o.id
  WHERE o.order_token = p_token
    AND o.order_status = 'OUT_FOR_DELIVERY';
$$;

CREATE OR REPLACE FUNCTION public.submit_feedback(
  p_token UUID,
  p_rating public.feedback_rating,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_notes IS NOT NULL AND length(p_notes) > 1000 THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: feedback notes too long'
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.orders
  SET customer_rating = p_rating,
      customer_feedback_notes = p_notes
  WHERE order_token = p_token
    AND order_status = 'DELIVERED'
    AND customer_rating IS NULL
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND_OR_ALREADY_RATED'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_table_token(p_token UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'tableId', id,
    'tableNumber', table_number,
    'label', label
  )
  FROM public.tables
  WHERE qr_token = p_token
    AND is_active = true;
$$;

-- ============================================================================
-- 16. RIDER RPCs
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
        'readyAt', o.updated_at
      )
      ORDER BY o.updated_at ASC
    )
    FROM public.orders o
    WHERE o.order_status = 'READY_FOR_PICKUP'
      AND o.order_type = 'DELIVERY'
      AND o.rider_id IS NULL
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_rider_active_order()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.is_rider() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_build_object(
    'orderId', o.id,
    'orderNumber', o.order_number,
    'status', o.order_status,
    'paymentMethod', o.payment_method,
    'paymentStatus', o.payment_status,
    'customerName', o.customer_name,
    'customerPhone', o.customer_phone_normalized,
    'deliveryAddressText', o.delivery_address_text,
    'deliveryArea', o.delivery_area,
    'deliveryLatitude', o.delivery_latitude,
    'deliveryLongitude', o.delivery_longitude,
    'roadDistanceM', o.road_distance_m,
    'estimatedTravelMinutes', o.estimated_travel_minutes,
    'etaAt', o.eta_at,
    'totalAmount', o.total_amount,
    'codChangeDue', o.cod_change_due,
    'customerNotes', o.customer_notes,
    'claimedAt', o.claimed_at,
    'dispatchedAt', o.dispatched_at,
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
  WHERE o.rider_id = auth.uid()
    AND o.order_status IN ('CLAIMED', 'OUT_FOR_DELIVERY')
  ORDER BY o.updated_at DESC
  LIMIT 1;

  RETURN v_result;
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

CREATE OR REPLACE FUNCTION public.release_order(
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
BEGIN
  IF NOT (public.is_rider() OR public.is_admin()) THEN
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

  IF v_order.order_status <> 'CLAIMED' THEN
    RAISE EXCEPTION 'ORDER_STATE_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  IF public.is_rider() AND v_order.rider_id <> auth.uid() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.transition_reason', coalesce(p_reason, 'RELEASED'), true);

  UPDATE public.orders
  SET order_status = 'READY_FOR_PICKUP',
      rider_id = NULL,
      claimed_at = NULL
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
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
    AND rider_id = auth.uid()
    AND order_status = 'OUT_FOR_DELIVERY'
  FOR UPDATE;

  IF NOT FOUND THEN
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

CREATE OR REPLACE FUNCTION public.update_rider_telemetry(
  p_order_id UUID,
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_accuracy_m NUMERIC DEFAULT NULL,
  p_heading NUMERIC DEFAULT NULL,
  p_speed_mps NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_now TIMESTAMPTZ := timezone('utc', now());
BEGIN
  IF NOT public.is_rider() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.orders
    WHERE id = p_order_id
      AND rider_id = auth.uid()
      AND order_status = 'OUT_FOR_DELIVERY'
  ) THEN
    RAISE EXCEPTION 'ORDER_STATE_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.rider_telemetry (
    rider_id, order_id, latitude, longitude, accuracy_m, heading, speed_mps, recorded_at
  ) VALUES (
    auth.uid(), p_order_id, p_lat, p_lng, p_accuracy_m, p_heading, p_speed_mps, v_now
  )
  ON CONFLICT (rider_id) DO UPDATE
  SET order_id = EXCLUDED.order_id,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      accuracy_m = EXCLUDED.accuracy_m,
      heading = EXCLUDED.heading,
      speed_mps = EXCLUDED.speed_mps,
      recorded_at = EXCLUDED.recorded_at;

  RETURN jsonb_build_object('success', true, 'recordedAt', v_now);
END;
$$;

CREATE OR REPLACE FUNCTION public.start_rider_shift(p_opening_float INTEGER DEFAULT 0)
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

  INSERT INTO public.rider_shifts (rider_id, opening_float)
  VALUES (auth.uid(), greatest(coalesce(p_opening_float, 0), 0))
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'shiftId', v_id);
EXCEPTION WHEN unique_violation THEN
  RAISE EXCEPTION 'SHIFT_ALREADY_OPEN'
    USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.end_rider_shift()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shift public.rider_shifts%ROWTYPE;
  v_expected INTEGER;
BEGIN
  IF NOT public.is_rider() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_shift
  FROM public.rider_shifts
  WHERE rider_id = auth.uid()
    AND ended_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHIFT_NOT_OPEN'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(sum(total_amount), 0)::integer INTO v_expected
  FROM public.orders
  WHERE rider_id = auth.uid()
    AND payment_method = 'CASH_ON_DELIVERY'
    AND payment_status = 'PAID'
    AND order_status = 'DELIVERED'
    AND settlement_id IS NULL;

  UPDATE public.rider_shifts
  SET ended_at = timezone('utc', now()),
      expected_cash = v_expected,
      status = 'CLOSED'
  WHERE id = v_shift.id;

  RETURN jsonb_build_object(
    'success', true,
    'shiftId', v_shift.id,
    'expectedCash', v_expected
  );
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
  v_expected INTEGER;
  v_settled INTEGER;
BEGIN
  v_rider := coalesce(p_rider_id, auth.uid());

  IF NOT (public.is_admin() OR v_rider = auth.uid()) THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(sum(total_amount), 0)::integer INTO v_expected
  FROM public.orders
  WHERE rider_id = v_rider
    AND payment_method = 'CASH_ON_DELIVERY'
    AND payment_status = 'PAID'
    AND order_status = 'DELIVERED'
    AND settlement_id IS NULL;

  SELECT coalesce(sum(counted_cash), 0)::integer INTO v_settled
  FROM public.cash_settlements
  WHERE rider_id = v_rider;

  RETURN jsonb_build_object(
    'riderId', v_rider,
    'outstandingCash', v_expected,
    'totalSettled', v_settled
  );
END;
$$;

-- ============================================================================
-- 17. KITCHEN RPCs
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
        'totalAmount', o.total_amount,
        'createdAt', o.created_at,
        'acknowledgedAt', o.acknowledged_at,
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

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, before_state, after_state)
  VALUES (auth.uid(), 'SET_KITCHEN_BUSY', 'app_settings', '1', v_before, v_after);

  RETURN jsonb_build_object(
    'success', true,
    'isKitchenBusy', p_busy,
    'busyBufferMinutes', (v_after->>'busy_buffer_minutes')::integer
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

  UPDATE public.menu_items
  SET is_available = p_available
  WHERE id = p_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND: menu item'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT to_jsonb(m) INTO v_after FROM public.menu_items m WHERE id = p_item_id;

  INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, before_state, after_state)
  VALUES (auth.uid(), 'SET_ITEM_AVAILABILITY', 'menu_items', p_item_id::text, v_before, v_after);

  RETURN jsonb_build_object('success', true, 'itemId', p_item_id, 'isAvailable', p_available);
END;
$$;

-- ============================================================================
-- 18. ADMIN RPCs
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
    'settlementId', o.settlement_id,
    'settledAt', o.settled_at,
    'version', o.version,
    'createdAt', o.created_at,
    'claimedAt', o.claimed_at,
    'dispatchedAt', o.dispatched_at,
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
    actor_id, action, entity_type, entity_id, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_COMPLETE_ORDER', 'orders', p_order_id::text,
    to_jsonb(v_order), jsonb_build_object('reason', p_reason)
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

  IF v_order.order_status IN ('DELIVERED', 'DELIVERY_FAILED', 'CANCELLED') THEN
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
    INSERT INTO public.refunds (
      order_id, payment_transaction_id, amount, reason, status, initiated_by
    ) VALUES (
      p_order_id, v_order.payment_transaction_id, v_order.total_amount, p_reason, 'REQUESTED', auth.uid()
    )
    RETURNING id INTO v_refund_id;
  END IF;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_CANCEL_ORDER', 'orders', p_order_id::text,
    to_jsonb(v_order), jsonb_build_object('reason', p_reason, 'refundId', v_refund_id)
  );

  RETURN jsonb_build_object('success', true, 'orderId', p_order_id, 'refundId', v_refund_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reassign_order(
  p_order_id UUID,
  p_rider_id UUID
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

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_rider_id AND role = 'RIDER' AND is_active = true
  ) THEN
    RAISE EXCEPTION 'VALIDATION_ERROR: invalid rider'
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

  UPDATE public.orders
  SET rider_id = p_rider_id,
      order_status = 'CLAIMED',
      claimed_at = timezone('utc', now()),
      dispatched_at = NULL
  WHERE id = p_order_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_REASSIGN_ORDER', 'orders', p_order_id::text,
    to_jsonb(v_order), jsonb_build_object('riderId', p_rider_id)
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

  v_bytes := gen_random_bytes(2);
  v_pin := lpad((((get_byte(v_bytes, 0) * 256) + get_byte(v_bytes, 1)) % 9000 + 1000)::text, 4, '0');

  UPDATE public.orders
  SET handover_pin = v_pin,
      failed_pin_attempts = 0,
      pin_locked_until = NULL,
      security_flag = 'PIN_RESET_BY_ADMIN'
  WHERE id = p_order_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, before_state, after_state
  ) VALUES (
    auth.uid(), 'ADMIN_RESET_HANDOVER_PIN', 'orders', p_order_id::text,
    jsonb_build_object('reason', p_reason), jsonb_build_object('pinReset', true)
  );

  RETURN jsonb_build_object('success', true, 'orderId', p_order_id, 'handoverPin', v_pin);
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
  v_settlement public.cash_settlements%ROWTYPE;
  v_status public.settlement_status;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
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

  v_status := CASE WHEN p_counted_cash >= v_expected THEN 'SETTLED'::public.settlement_status
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
    actor_id, action, entity_type, entity_id, before_state, after_state
  ) VALUES (
    auth.uid(), 'RECONCILE_RIDER_CASH', 'cash_settlements', v_settlement.id::text,
    NULL,
    jsonb_build_object(
      'riderId', p_rider_id,
      'businessDate', v_date,
      'expectedCash', v_expected,
      'countedCash', p_counted_cash,
      'variance', p_counted_cash - v_expected
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
        'status', coalesce(s.status, 'OPEN')
      )
      ORDER BY p.full_name
    )
    FROM public.profiles p
    LEFT JOIN (
      SELECT rider_id, sum(total_amount)::integer AS expected_cash
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

CREATE OR REPLACE FUNCTION public.get_admin_analytics(
  p_from DATE DEFAULT NULL,
  p_to DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from DATE := coalesce(p_from, (now() AT TIME ZONE 'Africa/Kampala')::date - 29);
  v_to DATE := coalesce(p_to, (now() AT TIME ZONE 'Africa/Kampala')::date);
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'AUTH_UNAUTHORIZED'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'from', v_from,
      'to', v_to,
      'orders', count(*),
      'deliveredOrders', count(*) FILTER (WHERE order_status = 'DELIVERED'),
      'cancelledOrders', count(*) FILTER (WHERE order_status = 'CANCELLED'),
      'grossRevenue', coalesce(sum(total_amount) FILTER (
        WHERE payment_status = 'PAID' AND order_status = 'DELIVERED'
      ), 0),
      'codCollected', coalesce(sum(total_amount) FILTER (
        WHERE payment_method = 'CASH_ON_DELIVERY'
          AND payment_status = 'PAID'
          AND order_status = 'DELIVERED'
      ), 0),
      'digitalCollected', coalesce(sum(total_amount) FILTER (
        WHERE payment_method <> 'CASH_ON_DELIVERY'
          AND payment_status = 'PAID'
          AND order_status = 'DELIVERED'
      ), 0),
      'averageOrderValue', coalesce(round(avg(total_amount) FILTER (
        WHERE payment_status = 'PAID' AND order_status = 'DELIVERED'
      ), 0), 0),
      'averagePrepMinutes', coalesce(round(avg(
        extract(epoch FROM (delivered_at - created_at)) / 60
      ) FILTER (WHERE order_status = 'DELIVERED'), 1), 0),
      'topItems', coalesce((
        SELECT jsonb_agg(jsonb_build_object('name', item_name, 'quantity', qty) ORDER BY qty DESC)
        FROM (
          SELECT oi.item_name_snapshot AS item_name, sum(oi.quantity)::integer AS qty
          FROM public.order_items oi
          JOIN public.orders o2 ON o2.id = oi.order_id
          WHERE (o2.created_at AT TIME ZONE 'Africa/Kampala')::date BETWEEN v_from AND v_to
            AND o2.order_status = 'DELIVERED'
          GROUP BY oi.item_name_snapshot
          ORDER BY qty DESC
          LIMIT 10
        ) top
      ), '[]'::jsonb)
    )
    FROM public.orders
    WHERE (created_at AT TIME ZONE 'Africa/Kampala')::date BETWEEN v_from AND v_to
  );
END;
$$;

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
        cancelled_at = timezone('utc', now()),
        cancellation_reason = 'PAYMENT_TIMEOUT'
    WHERE order_status = 'PENDING_PAYMENT'
      AND payment_status = 'PENDING'
      AND created_at < timezone('utc', now()) - INTERVAL '10 minutes'
    RETURNING id
  )
  SELECT count(*) INTO v_count FROM expired;

  RETURN v_count;
END;
$$;

-- ============================================================================
-- 17b. KITCHEN STATUS RPCs (accept / bump)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.accept_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
BEGIN
  IF NOT public.is_kitchen() THEN
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

  IF v_order.order_status <> 'CONFIRMED_UNPAID' THEN
    RAISE EXCEPTION 'ORDER_STATE_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('app.transition_reason', 'KITCHEN_ACCEPTED', true);

  UPDATE public.orders
  SET order_status = 'PREPARING',
      acknowledged_at = timezone('utc', now())
  WHERE id = p_order_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, before_state, after_state
  ) VALUES (
    auth.uid(), 'KITCHEN_ACCEPT_ORDER', 'orders', p_order_id::text,
    to_jsonb(v_order), jsonb_build_object('status', 'PREPARING')
  );

  RETURN jsonb_build_object('success', true, 'orderId', p_order_id, 'status', 'PREPARING');
END;
$$;

CREATE OR REPLACE FUNCTION public.bump_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_next public.order_status;
BEGIN
  IF NOT public.is_kitchen() THEN
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

  IF v_order.order_status <> 'PREPARING' THEN
    RAISE EXCEPTION 'ORDER_STATE_INVALID'
      USING ERRCODE = 'P0001';
  END IF;

  v_next := CASE
    WHEN v_order.order_type = 'DINE_IN' THEN 'DELIVERED'::public.order_status
    ELSE 'READY_FOR_PICKUP'::public.order_status
  END;

  PERFORM set_config('app.transition_reason', 'KITCHEN_BUMPED', true);

  UPDATE public.orders
  SET order_status = v_next,
      acknowledged_at = coalesce(acknowledged_at, timezone('utc', now())),
      delivered_at = CASE WHEN v_next = 'DELIVERED' THEN timezone('utc', now()) ELSE delivered_at END
  WHERE id = p_order_id;

  INSERT INTO public.admin_audit_log (
    actor_id, action, entity_type, entity_id, before_state, after_state
  ) VALUES (
    auth.uid(), 'KITCHEN_BUMP_ORDER', 'orders', p_order_id::text,
    to_jsonb(v_order), jsonb_build_object('status', v_next)
  );

  RETURN jsonb_build_object('success', true, 'orderId', p_order_id, 'status', v_next);
END;
$$;

-- ============================================================================
-- 19. ROW LEVEL SECURITY — DENY BY DEFAULT
-- ============================================================================
-- Design:
--   * anon/authenticated get NO direct access to orders, PINs, telemetry,
--     payments, settlements, staff profiles, or audit tables.
--   * All customer/staff reads and writes go through the RPCs above or through
--     server actions using the service role after application authorization.
--   * RLS is enabled on every table as defense-in-depth. A missing policy means
--     deny, not allow.
-- ============================================================================

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_modifier_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.combo_step_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pin_verification_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkout_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blacklisted_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Staff may read their own profile; admins may read all profiles.
CREATE POLICY profiles_select_self_or_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.is_admin());

-- Public menu: only active/available rows. Staff can see unavailable rows.
CREATE POLICY categories_public_read
  ON public.categories
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.is_kitchen());

CREATE POLICY menu_items_public_read
  ON public.menu_items
  FOR SELECT
  TO anon, authenticated
  USING ((is_active = true AND is_available = true) OR public.is_kitchen());

CREATE POLICY menu_item_images_public_read
  ON public.menu_item_images
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.menu_items m
      WHERE m.id = menu_item_images.menu_item_id
        AND ((m.is_active = true AND m.is_available = true) OR public.is_kitchen())
    )
  );

CREATE POLICY modifier_groups_public_read
  ON public.modifier_groups
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true OR public.is_kitchen());

CREATE POLICY item_modifiers_public_read
  ON public.item_modifiers
  FOR SELECT
  TO anon, authenticated
  USING (
    (is_active = true AND EXISTS (
      SELECT 1 FROM public.modifier_groups g
      WHERE g.id = item_modifiers.group_id AND g.is_active = true
    ))
    OR public.is_kitchen()
  );

CREATE POLICY menu_item_modifier_groups_public_read
  ON public.menu_item_modifier_groups
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.menu_items m
      WHERE m.id = menu_item_modifier_groups.menu_item_id
        AND ((m.is_active = true AND m.is_available = true) OR public.is_kitchen())
    )
  );

CREATE POLICY combo_steps_public_read
  ON public.combo_steps
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.menu_items m
      WHERE m.id = combo_steps.combo_item_id
        AND ((m.is_active = true AND m.is_available = true) OR public.is_kitchen())
    )
  );

CREATE POLICY combo_step_options_public_read
  ON public.combo_step_options
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.combo_steps s
      JOIN public.menu_items m ON m.id = s.combo_item_id
      WHERE s.id = combo_step_options.step_id
        AND ((m.is_active = true AND m.is_available = true) OR public.is_kitchen())
    )
  );

-- No policies are intentionally created for:
--   app_settings, tables, cash_settlements, orders, order_items,
--   order_item_modifiers, order_status_history, pin_verification_attempts,
--   delivery_attempts, rider_telemetry, rider_shifts, payment_transactions,
--   webhook_events, refunds, checkout_idempotency, otp_verifications,
--   blacklisted_phones, notifications, settings_history, admin_audit_log.
-- They are service-role/RPC only.

-- ============================================================================
-- 20. SAFE PUBLIC VIEW
-- ============================================================================

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
  busy_buffer_minutes
FROM public.app_settings
WHERE id = 1;

-- ============================================================================
-- 21. PRIVILEGES
-- ============================================================================

REVOKE ALL ON SCHEMA public FROM anon, authenticated;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- RLS helper functions must be executable by the roles whose policies call them.
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_kitchen() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_rider() TO anon, authenticated;

-- Public menu reads.
GRANT SELECT ON
  public.categories,
  public.menu_items,
  public.menu_item_images,
  public.modifier_groups,
  public.item_modifiers,
  public.menu_item_modifier_groups,
  public.combo_steps,
  public.combo_step_options
TO anon, authenticated;

-- Staff self-profile read.
GRANT SELECT ON public.profiles TO authenticated;

-- Safe settings view.
GRANT SELECT ON public.public_settings_view TO anon, authenticated;

-- Customer RPCs (token is the capability).
GRANT EXECUTE ON FUNCTION public.get_public_settings() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_by_token(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_order_telemetry(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_feedback(UUID, public.feedback_rating, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_table_token(UUID) TO anon, authenticated;

-- Rider RPCs.
GRANT EXECUTE ON FUNCTION public.get_rider_pool() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rider_active_order() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_order_atomic(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_delivery(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_order(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_delivery_pin(UUID, TEXT, NUMERIC, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.report_delivery_failed(UUID, public.delivery_outcome, TEXT, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_rider_telemetry(UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.start_rider_shift(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.end_rider_shift() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_rider_cash_summary(UUID) TO authenticated;

-- Kitchen RPCs.
GRANT EXECUTE ON FUNCTION public.get_kitchen_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bump_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_kitchen_busy(BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_menu_item_availability(UUID, BOOLEAN) TO authenticated;

-- Admin RPCs.
GRANT EXECUTE ON FUNCTION public.admin_get_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_complete_order(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cancel_order(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reassign_order(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_handover_pin(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_rider_cash(UUID, INTEGER, TEXT, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_ledger(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics(DATE, DATE) TO authenticated;

-- Service role: full server-side access (still bypasses RLS by design).
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT SELECT ON public.public_settings_view TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_pending_orders() TO service_role;

-- Future objects must be granted explicitly.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 22. DOCUMENTATION COMMENTS
-- ============================================================================

COMMENT ON TABLE public.orders IS
  'Master order record. Never expose handover_pin or customer PII via direct table access; use get_order_by_token() or get_rider_active_order().';
COMMENT ON COLUMN public.orders.handover_pin IS
  'Customer-only 4-digit handover PIN. Column is not granted to anon/authenticated; only token-scoped or admin RPCs may return it.';
COMMENT ON COLUMN public.orders.road_distance_m IS
  'OSRM road distance in metres. Fee is calculated from metres, never from a rounded kilometre display.';
COMMENT ON COLUMN public.orders.total_amount IS
  'Generated column: items_subtotal + modifiers_total + delivery_fee + packaging_fee.';
COMMENT ON TABLE public.payment_transactions IS
  'Gateway truth for every payment attempt. Webhook handlers must verify the transaction with the provider before marking an order paid.';
COMMENT ON TABLE public.webhook_events IS
  'Idempotency ledger for provider webhooks. UNIQUE(provider, provider_event_id).';
COMMENT ON TABLE public.cash_settlements IS
  'One settlement per rider per business date. Orders link through orders.settlement_id.';
COMMENT ON TABLE public.rider_telemetry IS
  'Latest rider location only. No history. Riders write through update_rider_telemetry(); customers read through get_order_telemetry(token).';
COMMENT ON TABLE public.profiles IS
  'Staff identity extends auth.users. Staff PINs are Supabase Auth passwords, never stored in this table.';

COMMIT;
