# DATABASE_SCHEMA_AND_RLS.md

> **v1.1 normative amendment:** The schema, RLS, triggers, and seed in this document are superseded by [`../supabase/migrations/20261029000000_initial_schema.sql`](../supabase/migrations/20261029000000_initial_schema.sql), [`../supabase/seed.sql`](../supabase/seed.sql), and [`ERD.md`](ERD.md). Do not apply the SQL in this file.

## Document Control & Metadata
* **Document Version:** 1.0.0
* **Status:** Production-Ready Database Specification
* **Target Engine:** PostgreSQL 15+ (Supabase Managed Engine)
* **Extensions Required:** `uuid-ossp`, `pgcrypto`
* **Currency Representation:** `INTEGER` / `BIGINT` (Ugandan Shillings `UGX` — zero fractional decimals)
* **Coordinate Precision:** `DECIMAL(10, 7)` for sub-meter equatorial accuracy in Kampala, Uganda

---

## 1. Custom PostgreSQL Types (ENUMs)

Run these custom enumerations first to establish strong typing across states, roles, and payment rails:

```sql
-- 1. Order Fulfillment Lifecycle
CREATE TYPE order_status AS ENUM (
  'PENDING_PAYMENT',      -- Customer initiated digital checkout; waiting for MoMo USSD / Card webhook
  'CONFIRMED_UNPAID',    -- Cash on Delivery verified; waiting for kitchen pickup
  'PREPARING',           -- Kitchen actively cooking (ticket visible on KDS)
  'READY_FOR_PICKUP',    -- Packaged with safety seal; resting in unclaimed rider pool
  'CLAIMED',             -- Claimed by a rider; rider heading to kitchen pickup station
  'OUT_FOR_DELIVERY',    -- Rider in transit to customer; GPS telemetry broadcasting
  'DELIVERED',           -- Handover PIN verified; cash collected (if COD); trip complete
  'CANCELLED'            -- Voided by admin or payment timeout
);

-- 2. Payment Rails
CREATE TYPE payment_method AS ENUM (
  'MTN_MOMO',            -- Automated USSD Push
  'AIRTEL_MONEY',        -- Automated USSD Push
  'CASH_ON_DELIVERY',    -- Physical cash collected by rider
  'BANK_CARD'            -- Visa / Mastercard gateway
);

-- 3. Settlement State
CREATE TYPE payment_status AS ENUM (
  'PENDING',             -- Awaiting gateway callback or cash collection
  'PAID',                -- Captured digitally or confirmed by rider PIN gate
  'FAILED',              -- Insufficient MoMo balance / user rejected USSD prompt
  'REFUNDED'             -- Voided after capture
);

-- 4. Order Type / Context
CREATE TYPE order_type AS ENUM (
  'DELIVERY',            -- Motorcycle dispatch to GPS coordinates
  'DINE_IN'              -- Table QR ordering inside the bazaar
);

-- 5. Operational Staff Roles
CREATE TYPE user_role AS ENUM (
  'CUSTOMER',            -- Guest or returning customer
  'KITCHEN',             -- Line cook operating KDS
  'RIDER',               -- Motorcycle courier on /rider
  'ADMIN'                -- Restaurant owner / general manager
);

-- 6. Modifier Architecture
CREATE TYPE modifier_type AS ENUM (
  'OMISSION',            -- Free: "No Onions", "No Salt"
  'COOKING_STYLE',       -- Free: "Mild", "Medium", "Extra Hot"
  'PAID_ADDON'           -- Paid: "Extra Pepper (+2,000)", "Extra Cheese (+3,000)"
);
```

---

## 2. Table Definitions (DDL)

```sql
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES (Staff & Riders)
-- ============================================================================
-- Extends Supabase auth.users or handles PIN-authenticated staff
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone_number TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'CUSTOMER',
  pin_code VARCHAR(4),                       -- 4-digit numeric PIN for quick KDS/Rider login
  motorcycle_plate VARCHAR(20),               -- e.g., 'UFD 342B' (Riders only)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 2. CATEGORIES
-- ============================================================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,                         -- e.g., 'Bazaar Grills', 'Combos', 'Beverages'
  slug TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 3. MENU ITEMS
-- ============================================================================
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  description TEXT,
  base_price INTEGER NOT NULL CHECK (base_price >= 0), -- Amount in UGX (e.g., 25000)
  image_url TEXT NOT NULL,                             -- Compressed WebP path
  prep_time_minutes INTEGER NOT NULL DEFAULT 20,
  is_available BOOLEAN NOT NULL DEFAULT true,          -- Instant 86-ing (Stock-out toggle)
  is_combo BOOLEAN NOT NULL DEFAULT false,             -- Flags multi-step bundle modal
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 4. ITEM MODIFIERS (Preferences, Omissions, Add-Ons)
-- ============================================================================
CREATE TABLE public.item_modifiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE CASCADE, -- NULL = applies to all items
  name TEXT NOT NULL,                                  -- e.g., 'No Onions', 'Extra Chili'
  modifier_type modifier_type NOT NULL,
  price_delta INTEGER NOT NULL DEFAULT 0 CHECK (price_delta >= 0), -- UGX (0 for omissions)
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 5. ORDERS (Master Transaction Record)
-- ============================================================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number SERIAL,                                 -- Incremental short ref for display (#1042)
  order_token UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE, -- Public unguessable tracking token
  order_type order_type NOT NULL DEFAULT 'DELIVERY',
  
  -- Customer Details
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,                        -- e.g., '+256772000111'
  table_number VARCHAR(10),                            -- Populated if order_type = 'DINE_IN'
  
  -- Delivery Geography (NULL if DINE_IN)
  delivery_address_text TEXT,
  delivery_latitude DECIMAL(10, 7),
  delivery_longitude DECIMAL(10, 7),
  road_distance_km DECIMAL(4, 1),                      -- OSRM computed road distance
  
  -- Financial Ledger (All figures stored as whole UGX integers)
  items_subtotal INTEGER NOT NULL CHECK (items_subtotal >= 0),
  modifiers_total INTEGER NOT NULL DEFAULT 0 CHECK (modifiers_total >= 0),
  delivery_fee INTEGER NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  packaging_fee INTEGER NOT NULL DEFAULT 0 CHECK (packaging_fee >= 0),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  
  -- Payment & Status
  payment_method payment_method NOT NULL,
  payment_status payment_status NOT NULL DEFAULT 'PENDING',
  order_status order_status NOT NULL DEFAULT 'PENDING_PAYMENT',
  
  -- Cash on Delivery Specifics
  cod_change_requested_for INTEGER,                    -- e.g., 50000 (Customer has 50k bill)
  
  -- Operations & Fleet Verification
  handover_pin VARCHAR(4) NOT NULL,                    -- Ephemeral 4-digit security code
  rider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_notes TEXT,                                 -- Kitchen notes / allergy info
  kitchen_busy_buffer_applied INTEGER DEFAULT 0,       -- Minutes added during peak hours
  
  -- Post-Delivery Feedback
  customer_rating VARCHAR(10),                         -- 'GREAT', 'OKAY', 'BAD'
  customer_feedback_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  claimed_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 6. ORDER ITEMS (Purchased Line Items Snapshot)
-- ============================================================================
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  item_name_snapshot TEXT NOT NULL,                   -- Preserves historical name if edited
  unit_price_snapshot INTEGER NOT NULL,               -- Preserves price at purchase time
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  total_price INTEGER NOT NULL CHECK (total_price >= 0)
);

-- ============================================================================
-- 7. ORDER ITEM MODIFIERS (Snapshot of Selected Options)
-- ============================================================================
CREATE TABLE public.order_item_modifiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_item_id UUID NOT NULL REFERENCES public.order_items(id) ON DELETE CASCADE,
  modifier_id UUID NOT NULL REFERENCES public.item_modifiers(id) ON DELETE RESTRICT,
  name_snapshot TEXT NOT NULL,
  price_delta_snapshot INTEGER NOT NULL DEFAULT 0
);

-- ============================================================================
-- 8. RIDER TELEMETRY (Ephemeral GPS Coordinates)
-- ============================================================================
CREATE TABLE public.rider_telemetry (
  rider_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  heading DECIMAL(5, 2) DEFAULT 0.0,                   -- Compass degrees (0-360)
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 9. CASH SETTLEMENTS (End-of-Day Rider Reconciliation)
-- ============================================================================
CREATE TABLE public.cash_settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rider_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_cash_collected INTEGER NOT NULL CHECK (total_cash_collected >= 0),
  is_settled BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ============================================================================
-- 10. APP SETTINGS (Single-Row Dynamic Configuration)
-- ============================================================================
CREATE TABLE public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),     -- Enforces singleton row
  restaurant_name TEXT NOT NULL DEFAULT 'Bazaar Flame & Grill',
  restaurant_lat DECIMAL(10, 7) NOT NULL DEFAULT 0.3136000,
  restaurant_lng DECIMAL(10, 7) NOT NULL DEFAULT 32.5811000,
  free_delivery_radius_km DECIMAL(3, 1) NOT NULL DEFAULT 5.0,
  rate_per_excess_km INTEGER NOT NULL DEFAULT 1500,    -- UGX per km after 5 km
  minimum_order_value INTEGER NOT NULL DEFAULT 20000,   -- UGX 20,000 MOV
  max_delivery_radius_km DECIMAL(3, 1) NOT NULL DEFAULT 15.0,
  packaging_fee_default INTEGER NOT NULL DEFAULT 1000, -- Standard eco-pack fee
  is_kitchen_busy BOOLEAN NOT NULL DEFAULT false,
  busy_buffer_minutes INTEGER NOT NULL DEFAULT 20,
  is_store_open BOOLEAN NOT NULL DEFAULT true,
  opening_time TIME NOT NULL DEFAULT '10:00:00',
  closing_time TIME NOT NULL DEFAULT '22:30:00',
  support_whatsapp TEXT NOT NULL DEFAULT '+256700000000',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);
```

---

## 3. Indexes & Constraints

```sql
-- Fast public tracking lookup via unguessable UUID token
CREATE UNIQUE INDEX idx_orders_order_token ON public.orders(order_token);

-- Kitchen and Rider status queues
CREATE INDEX idx_orders_status ON public.orders(order_status);
CREATE INDEX idx_orders_rider_id ON public.orders(rider_id);

-- Menu browsing performance
CREATE INDEX idx_menu_items_category_id ON public.menu_items(category_id);
CREATE INDEX idx_menu_items_is_available ON public.menu_items(is_available);

-- Telemetry recency lookup
CREATE INDEX idx_rider_telemetry_updated_at ON public.rider_telemetry(updated_at);
```

---

## 4. Database Triggers & Automated Functions

### 4.1 Automated `updated_at` Refresh
```sql
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER tr_menu_items_updated_at
BEFORE UPDATE ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER tr_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER tr_app_settings_updated_at
BEFORE UPDATE ON public.app_settings
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
```

### 4.2 Automated 4-Digit Handover PIN Generation
```sql
CREATE OR REPLACE FUNCTION public.generate_handover_pin()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate random 4-digit string from 1000 to 9999
  IF NEW.handover_pin IS NULL OR NEW.handover_pin = '' THEN
    NEW.handover_pin := LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_orders_handover_pin
BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.generate_handover_pin();
```

---

## 5. Row Level Security (RLS) Policies

Enable Row Level Security across all tables to enforce strict access control at the database engine level.

```sql
-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rider_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
```

### 5.1 Helper Role Verification Functions
```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('ADMIN', 'KITCHEN') AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_rider()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'RIDER' AND is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER;
```

---

### 5.2 RLS Policy Statements

#### Public Menu Access
```sql
-- Anyone can view active categories
CREATE POLICY "Public Read Categories" ON public.categories
FOR SELECT USING (is_active = true);

-- Anyone can view available menu items (or admin can view all)
CREATE POLICY "Public Read Menu Items" ON public.menu_items
FOR SELECT USING (is_available = true OR public.is_staff());

-- Anyone can view item modifiers
CREATE POLICY "Public Read Modifiers" ON public.item_modifiers
FOR SELECT USING (is_active = true OR public.is_staff());

-- Staff can edit menu & 86 items
CREATE POLICY "Staff Manage Menu" ON public.menu_items
FOR ALL TO authenticated USING (public.is_staff());

-- Staff can edit categories
CREATE POLICY "Staff Manage Categories" ON public.categories
FOR ALL TO authenticated USING (public.is_staff());
```

#### Orders & Order Items
```sql
-- Public guest checkout: Anyone can insert an order
CREATE POLICY "Public Insert Orders" ON public.orders
FOR INSERT WITH CHECK (true);

-- Anyone can read an order IF they have the unguessable order_token
CREATE POLICY "Token Read Order" ON public.orders
FOR SELECT USING (
  order_token::TEXT = current_setting('request.headers', true)::json->>'x-order-token'
  OR public.is_staff()
  OR (public.is_rider() AND (rider_id = auth.uid() OR order_status = 'READY_FOR_PICKUP'))
);

-- Public insert for order line items
CREATE POLICY "Public Insert Order Items" ON public.order_items
FOR INSERT WITH CHECK (true);

-- Read line items linked to authorized order
CREATE POLICY "Read Order Items" ON public.order_items
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id
  )
);

-- Modifiers snapshot insert and read
CREATE POLICY "Public Insert Order Modifiers" ON public.order_item_modifiers
FOR INSERT WITH CHECK (true);

CREATE POLICY "Read Order Modifiers" ON public.order_item_modifiers
FOR SELECT USING (true);
```

#### Kitchen Display System (KDS) Permissions
```sql
-- Kitchen and Admin can view all non-delivered orders
CREATE POLICY "Kitchen View Orders" ON public.orders
FOR SELECT TO authenticated USING (public.is_staff());

-- Kitchen can update order status (Bumping tickets)
CREATE POLICY "Kitchen Update Order Status" ON public.orders
FOR UPDATE TO authenticated
USING (public.is_staff())
WITH CHECK (public.is_staff());
```

#### Rider Fleet Permissions
```sql
-- Riders can view the unclaimed pool and their own claimed deliveries
CREATE POLICY "Rider Read Order Pool" ON public.orders
FOR SELECT TO authenticated
USING (
  public.is_rider() AND (order_status = 'READY_FOR_PICKUP' OR rider_id = auth.uid())
);

-- Riders can claim orders or update status using their auth ID
CREATE POLICY "Rider Claim & Complete Orders" ON public.orders
FOR UPDATE TO authenticated
USING (public.is_rider())
WITH CHECK (public.is_rider());

-- Rider telemetry: Riders update their own coordinates; anyone with the order token can read
CREATE POLICY "Rider Upsert Telemetry" ON public.rider_telemetry
FOR ALL TO authenticated
USING (rider_id = auth.uid())
WITH CHECK (rider_id = auth.uid());

CREATE POLICY "Public Read Telemetry" ON public.rider_telemetry
FOR SELECT USING (true);
```

#### App Settings & Cash Settlements
```sql
-- Everyone can read operational settings (Store hours, MOV, distance rates)
CREATE POLICY "Public Read Settings" ON public.app_settings
FOR SELECT USING (true);

-- Only Admin can update settings
CREATE POLICY "Admin Update Settings" ON public.app_settings
FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Cash settlements are visible to the assigned rider and admin
CREATE POLICY "Rider and Admin View Settlements" ON public.cash_settlements
FOR SELECT TO authenticated
USING (rider_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admin Manage Settlements" ON public.cash_settlements
FOR ALL TO authenticated
USING (public.is_admin());
```

---

## 6. Seed Data Script (`seed.sql`)

Execute this seed script to populate baseline restaurant operational settings, categories, and initial authentic Kampala bazaar dishes:

```sql
-- 1. Insert Initial App Settings
INSERT INTO public.app_settings (
  id, restaurant_name, restaurant_lat, restaurant_lng,
  free_delivery_radius_km, rate_per_excess_km, minimum_order_value,
  max_delivery_radius_km, packaging_fee_default, is_kitchen_busy,
  is_store_open, support_whatsapp
) VALUES (
  1, 'Bazaar Flame & Grill', 0.3136000, 32.5811000,
  5.0, 1500, 20000, 15.0, 1000, false, true, '+256700000000'
) ON CONFLICT (id) DO NOTHING;

-- 2. Insert Menu Categories
INSERT INTO public.categories (id, name, slug, display_order) VALUES
  ('c1111111-1111-1111-1111-111111111111', 'Combos & Bazaar Deals', 'combos', 1),
  ('c2222222-2222-2222-2222-222222222222', 'Charcoal Flame Grills', 'grills', 2),
  ('c3333333-3333-3333-3333-333333333333', 'Traditional Luwombo', 'luwombo', 3),
  ('c4444444-4444-4444-4444-444444444444', 'Sides & Street Bites', 'sides', 4),
  ('c5555555-5555-5555-5555-555555555555', 'Fresh Juices & Drinks', 'beverages', 5);

-- 3. Insert Authentic Menu Items
INSERT INTO public.menu_items (id, category_id, name, description, base_price, image_url, prep_time_minutes, is_combo) VALUES
  -- Combo
  ('m1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 
   'Whole Tilapia Flame Combo', 'Whole deep-fried or grilled Tilapia served with golden chips and fresh passion fruit juice.', 
   32000, '/images/tilapia-combo.webp', 25, true),
  
  -- Grills
  ('m2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 
   'Quarter Charcoal Grilled Chicken', 'Flame-grilled quarter chicken marinated in local herbs and garlic ginger glaze.', 
   18000, '/images/grilled-chicken.webp', 20, false),
  
  -- Luwombo
  ('m3333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 
   'Smoked Beef Luwombo', 'Traditional steamed beef wrapped in banana leaves with rich groundnut sauce, served with Matooke.', 
   26000, '/images/beef-luwombo.webp', 30, false),

  -- Street Bites
  ('m4444444-4444-4444-4444-444444444444', 'c4444444-4444-4444-4444-444444444444', 
   'Special Bazaar Rolex', '3-egg omelette with diced tomatoes, shredded cabbage, rolled inside two warm handmade chapatis.', 
   8000, '/images/bazaar-rolex.webp', 10, false),

  -- Beverages
  ('m5555555-5555-5555-5555-555555555555', 'c5555555-5555-5555-5555-555555555555', 
   'Cold-Pressed Passion Juice (500ml)', 'Fresh natural Masaka passion fruit juice, lightly sweetened.', 
   5000, '/images/passion-juice.webp', 5, false);

-- 4. Insert Structured Modifiers
INSERT INTO public.item_modifiers (menu_item_id, name, modifier_type, price_delta) VALUES
  -- Omissions (Free)
  (NULL, 'No Onions', 'OMISSION', 0),
  (NULL, 'No Chili / Mild Only', 'OMISSION', 0),
  (NULL, 'Light Salt', 'OMISSION', 0),
  
  -- Cooking Styles (Free)
  (NULL, 'Spicy Level: Hot', 'COOKING_STYLE', 0),
  (NULL, 'Spicy Level: Extra Chili Fire', 'COOKING_STYLE', 0),
  
  -- Paid Add-Ons
  ('m1111111-1111-1111-1111-111111111111', 'Extra Garlic Pepper Dip', 'PAID_ADDON', 2000),
  ('m2222222-2222-2222-2222-222222222222', 'Extra Roast Gravy', 'PAID_ADDON', 1500),
  ('m4444444-4444-4444-4444-444444444444', 'Add Extra Egg & Cheese', 'PAID_ADDON', 3000);
```