-- ============================================================================
-- PROJECT-BAZAAR-D2C / MRFSS — Canonical seed data v1.1
-- Run after the initial migration. Staff auth users are created separately by
-- scripts/seed-staff.mjs because they require Supabase Auth Admin API access.
-- All UUIDs below are valid hex UUIDs.
-- ============================================================================

BEGIN;

INSERT INTO public.app_settings (
  id, restaurant_name, restaurant_lat, restaurant_lng, support_whatsapp,
  currency, timezone,
  free_delivery_radius_km, rate_per_excess_km, max_delivery_radius_km, cod_max_radius_km,
  minimum_order_value, minimum_order_value_dine_in,
  packaging_fee_default, packaging_fee_dine_in,
  max_cart_value, max_item_quantity,
  is_store_open, opening_time, closing_time,
  is_kitchen_busy, busy_buffer_minutes,
  pin_max_attempts, pin_lock_minutes, pin_geofence_m, staff_session_hours
) VALUES (
  1, 'Bazaar Flame & Grill', 0.3136000, 32.5811000, '+256700000000',
  'UGX', 'Africa/Kampala',
  5.00, 1500, 15.00, 8.00,
  20000, 0,
  1000, 0,
  200000, 20,
  true, '10:00:00', '22:30:00',
  false, 20,
  3, 15, 300, 12
)
ON CONFLICT (id) DO UPDATE SET
  restaurant_name = EXCLUDED.restaurant_name,
  restaurant_lat = EXCLUDED.restaurant_lat,
  restaurant_lng = EXCLUDED.restaurant_lng,
  support_whatsapp = EXCLUDED.support_whatsapp,
  currency = EXCLUDED.currency,
  timezone = EXCLUDED.timezone,
  free_delivery_radius_km = EXCLUDED.free_delivery_radius_km,
  rate_per_excess_km = EXCLUDED.rate_per_excess_km,
  max_delivery_radius_km = EXCLUDED.max_delivery_radius_km,
  cod_max_radius_km = EXCLUDED.cod_max_radius_km,
  minimum_order_value = EXCLUDED.minimum_order_value,
  minimum_order_value_dine_in = EXCLUDED.minimum_order_value_dine_in,
  packaging_fee_default = EXCLUDED.packaging_fee_default,
  packaging_fee_dine_in = EXCLUDED.packaging_fee_dine_in,
  max_cart_value = EXCLUDED.max_cart_value,
  max_item_quantity = EXCLUDED.max_item_quantity,
  is_store_open = EXCLUDED.is_store_open,
  opening_time = EXCLUDED.opening_time,
  closing_time = EXCLUDED.closing_time,
  is_kitchen_busy = EXCLUDED.is_kitchen_busy,
  busy_buffer_minutes = EXCLUDED.busy_buffer_minutes,
  pin_max_attempts = EXCLUDED.pin_max_attempts,
  pin_lock_minutes = EXCLUDED.pin_lock_minutes,
  pin_geofence_m = EXCLUDED.pin_geofence_m,
  staff_session_hours = EXCLUDED.staff_session_hours;

INSERT INTO public.categories (id, name, slug, display_order, is_active) VALUES
  ('11111111-1111-4111-8111-111111111101', 'Combos & Bazaar Deals', 'combos', 1, true),
  ('11111111-1111-4111-8111-111111111102', 'Charcoal Flame Grills', 'grills', 2, true),
  ('11111111-1111-4111-8111-111111111103', 'Traditional Luwombo', 'luwombo', 3, true),
  ('11111111-1111-4111-8111-111111111104', 'Sides & Street Bites', 'sides', 4, true),
  ('11111111-1111-4111-8111-111111111105', 'Fresh Juices & Drinks', 'beverages', 5, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  display_order = EXCLUDED.display_order,
  is_active = EXCLUDED.is_active;

INSERT INTO public.menu_items (
  id, category_id, name, slug, description, base_price, image_url,
  prep_time_minutes, is_available, is_active, is_combo, sort_order
) VALUES
  ('22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111101',
   'Whole Tilapia Flame Combo', 'whole-tilapia-flame-combo',
   'Whole grilled tilapia served with a side and a drink. Choose your side and drink in the combo builder.',
   32000, '/images/placeholder-dish.svg', 25, true, true, true, 1),
  ('22222222-2222-4222-8222-222222222202', '11111111-1111-4111-8111-111111111102',
   'Quarter Charcoal Grilled Chicken', 'quarter-charcoal-grilled-chicken',
   'Flame-grilled quarter chicken marinated in local herbs and garlic ginger glaze.',
   18000, '/images/placeholder-dish.svg', 20, true, true, false, 1),
  ('22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111103',
   'Smoked Beef Luwombo', 'smoked-beef-luwombo',
   'Traditional steamed beef wrapped in banana leaves with rich groundnut sauce, served with matoke.',
   26000, '/images/placeholder-dish.svg', 30, true, true, false, 1),
  ('22222222-2222-4222-8222-222222222204', '11111111-1111-4111-8111-111111111103',
   'Chicken Luwombo', 'chicken-luwombo',
   'Steamed chicken in groundnut sauce, wrapped in banana leaves and served with matoke.',
   24000, '/images/placeholder-dish.svg', 30, true, true, false, 2),
  ('22222222-2222-4222-8222-222222222205', '11111111-1111-4111-8111-111111111104',
   'Special Bazaar Rolex', 'special-bazaar-rolex',
   'Three-egg omelette with diced tomatoes and shredded cabbage, rolled inside two warm handmade chapatis.',
   8000, '/images/placeholder-dish.svg', 10, true, true, false, 1),
  ('22222222-2222-4222-8222-222222222206', '11111111-1111-4111-8111-111111111104',
   'Golden Chips', 'golden-chips',
   'Crispy hand-cut potato chips with a light sprinkle of salt.',
   6000, '/images/placeholder-dish.svg', 12, true, true, false, 2),
  ('22222222-2222-4222-8222-222222222207', '11111111-1111-4111-8111-111111111104',
   'Matoke & Groundnut', 'matoke-groundnut',
   'Steamed green banana in a rich groundnut sauce.',
   15000, '/images/placeholder-dish.svg', 20, true, true, false, 3),
  ('22222222-2222-4222-8222-222222222208', '11111111-1111-4111-8111-111111111105',
   'Mineral Water (500 ml)', 'mineral-water-500ml',
   'Chilled bottled mineral water.',
   2000, '/images/placeholder-dish.svg', 1, true, true, false, 1),
  ('22222222-2222-4222-8222-222222222209', '11111111-1111-4111-8111-111111111105',
   'Soda (300 ml)', 'soda-300ml',
   'Chilled bottled soda. Ask for available flavours.',
   3000, '/images/placeholder-dish.svg', 1, true, true, false, 2),
  ('22222222-2222-4222-8222-222222222210', '11111111-1111-4111-8111-111111111105',
   'Cold-Pressed Passion Juice (500 ml)', 'cold-pressed-passion-juice-500ml',
   'Fresh natural Masaka passion fruit juice, lightly sweetened.',
   5000, '/images/placeholder-dish.svg', 5, true, true, false, 3),
  ('22222222-2222-4222-8222-222222222211', '11111111-1111-4111-8111-111111111105',
   'African Coffee', 'african-coffee',
   'Freshly brewed Ugandan coffee.',
   4000, '/images/placeholder-dish.svg', 5, true, true, false, 4),
  ('22222222-2222-4222-8222-222222222212', '11111111-1111-4111-8111-111111111104',
   'Chapati', 'chapati',
   'Soft handmade chapati.',
   1500, '/images/placeholder-dish.svg', 5, true, true, false, 4)
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  base_price = EXCLUDED.base_price,
  image_url = EXCLUDED.image_url,
  prep_time_minutes = EXCLUDED.prep_time_minutes,
  is_available = EXCLUDED.is_available,
  is_active = EXCLUDED.is_active,
  is_combo = EXCLUDED.is_combo,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.modifier_groups (
  id, name, selection_type, min_selections, max_selections, is_required, is_active, sort_order
) VALUES
  ('33333333-3333-4333-8333-333333333301', 'Extra Dips & Sauces', 'MULTI', 0, 3, false, true, 1),
  ('33333333-3333-4333-8333-333333333302', 'Spice Level', 'SINGLE', 0, 1, false, true, 2),
  ('33333333-3333-4333-8333-333333333303', 'Omissions', 'MULTI', 0, 5, false, true, 3),
  ('33333333-3333-4333-8333-333333333304', 'Protein Add-On', 'SINGLE', 0, 1, false, true, 4)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  selection_type = EXCLUDED.selection_type,
  min_selections = EXCLUDED.min_selections,
  max_selections = EXCLUDED.max_selections,
  is_required = EXCLUDED.is_required,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.item_modifiers (
  id, group_id, name, modifier_type, price_delta, is_active, sort_order
) VALUES
  ('44444444-4444-4444-8444-444444444401', '33333333-3333-4333-8333-333333333301', 'Extra Garlic Pepper Dip', 'PAID_ADDON', 2000, true, 1),
  ('44444444-4444-4444-8444-444444444402', '33333333-3333-4333-8333-333333333301', 'Extra Chili Sauce', 'PAID_ADDON', 1000, true, 2),
  ('44444444-4444-4444-8444-444444444403', '33333333-3333-4333-8333-333333333301', 'Extra Groundnut Sauce', 'PAID_ADDON', 1500, true, 3),
  ('44444444-4444-4444-8444-444444444404', '33333333-3333-4333-8333-333333333302', 'Mild', 'COOKING_STYLE', 0, true, 1),
  ('44444444-4444-4444-8444-444444444405', '33333333-3333-4333-8333-333333333302', 'Medium', 'COOKING_STYLE', 0, true, 2),
  ('44444444-4444-4444-8444-444444444406', '33333333-3333-4333-8333-333333333302', 'Hot', 'COOKING_STYLE', 0, true, 3),
  ('44444444-4444-4444-8444-444444444407', '33333333-3333-4333-8333-333333333303', 'No Onions', 'OMISSION', 0, true, 1),
  ('44444444-4444-4444-8444-444444444408', '33333333-3333-4333-8333-333333333303', 'Light Salt', 'OMISSION', 0, true, 2),
  ('44444444-4444-4444-8444-444444444409', '33333333-3333-4333-8333-333333333304', 'Add Chicken', 'PAID_ADDON', 5000, true, 1),
  ('44444444-4444-4444-8444-444444444410', '33333333-3333-4333-8333-333333333304', 'Add Beef', 'PAID_ADDON', 4000, true, 2),
  ('44444444-4444-4444-8444-444444444411', '33333333-3333-4333-8333-333333333304', 'Add Fish', 'PAID_ADDON', 6000, true, 3)
ON CONFLICT (id) DO UPDATE SET
  group_id = EXCLUDED.group_id,
  name = EXCLUDED.name,
  modifier_type = EXCLUDED.modifier_type,
  price_delta = EXCLUDED.price_delta,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.menu_item_modifier_groups (menu_item_id, group_id, sort_order) VALUES
  ('22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333301', 1),
  ('22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333302', 2),
  ('22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333303', 3),
  ('22222222-2222-4222-8222-222222222202', '33333333-3333-4333-8333-333333333301', 1),
  ('22222222-2222-4222-8222-222222222202', '33333333-3333-4333-8333-333333333302', 2),
  ('22222222-2222-4222-8222-222222222202', '33333333-3333-4333-8333-333333333303', 3),
  ('22222222-2222-4222-8222-222222222203', '33333333-3333-4333-8333-333333333301', 1),
  ('22222222-2222-4222-8222-222222222203', '33333333-3333-4333-8333-333333333302', 2),
  ('22222222-2222-4222-8222-222222222203', '33333333-3333-4333-8333-333333333303', 3),
  ('22222222-2222-4222-8222-222222222204', '33333333-3333-4333-8333-333333333301', 1),
  ('22222222-2222-4222-8222-222222222204', '33333333-3333-4333-8333-333333333302', 2),
  ('22222222-2222-4222-8222-222222222204', '33333333-3333-4333-8333-333333333303', 3),
  ('22222222-2222-4222-8222-222222222205', '33333333-3333-4333-8333-333333333301', 1),
  ('22222222-2222-4222-8222-222222222205', '33333333-3333-4333-8333-333333333302', 2),
  ('22222222-2222-4222-8222-222222222205', '33333333-3333-4333-8333-333333333303', 3),
  ('22222222-2222-4222-8222-222222222206', '33333333-3333-4333-8333-333333333303', 1),
  ('22222222-2222-4222-8222-222222222207', '33333333-3333-4333-8333-333333333303', 1)
ON CONFLICT (menu_item_id, group_id) DO UPDATE SET
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.combo_steps (
  id, combo_item_id, name, step_order, min_selections, max_selections, is_required
) VALUES
  ('55555555-5555-4555-8555-555555555501', '22222222-2222-4222-8222-222222222201', 'Choose a side', 1, 1, 1, true),
  ('55555555-5555-4555-8555-555555555502', '22222222-2222-4222-8222-222222222201', 'Choose a drink', 2, 1, 1, true)
ON CONFLICT (id) DO UPDATE SET
  combo_item_id = EXCLUDED.combo_item_id,
  name = EXCLUDED.name,
  step_order = EXCLUDED.step_order,
  min_selections = EXCLUDED.min_selections,
  max_selections = EXCLUDED.max_selections,
  is_required = EXCLUDED.is_required;

INSERT INTO public.combo_step_options (
  id, step_id, option_item_id, price_delta, is_default, sort_order
) VALUES
  ('66666666-6666-4666-8666-666666666601', '55555555-5555-4555-8555-555555555501', '22222222-2222-4222-8222-222222222206', 0, true, 1),
  ('66666666-6666-4666-8666-666666666602', '55555555-5555-4555-8555-555555555501', '22222222-2222-4222-8222-222222222207', 0, false, 2),
  ('66666666-6666-4666-8666-666666666603', '55555555-5555-4555-8555-555555555502', '22222222-2222-4222-8222-222222222208', 0, true, 1),
  ('66666666-6666-4666-8666-666666666604', '55555555-5555-4555-8555-555555555502', '22222222-2222-4222-8222-222222222209', 0, false, 2)
ON CONFLICT (id) DO UPDATE SET
  step_id = EXCLUDED.step_id,
  option_item_id = EXCLUDED.option_item_id,
  price_delta = EXCLUDED.price_delta,
  is_default = EXCLUDED.is_default,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.tables (id, table_number, label, qr_token, is_active) VALUES
  ('77777777-7777-4777-8777-777777777701', 'T1', 'Window 1', '88888888-8888-4888-8888-888888888801', true),
  ('77777777-7777-4777-8777-777777777702', 'T2', 'Window 2', '88888888-8888-4888-8888-888888888802', true),
  ('77777777-7777-4777-8777-777777777703', 'T3', 'Garden 1', '88888888-8888-4888-8888-888888888803', true),
  ('77777777-7777-4777-8777-777777777704', 'T4', 'Garden 2', '88888888-8888-4888-8888-888888888804', true),
  ('77777777-7777-4777-8777-777777777705', 'T5', 'Garden 3', '88888888-8888-4888-8888-888888888805', true),
  ('77777777-7777-4777-8777-777777777706', 'T6', 'Counter 1', '88888888-8888-4888-8888-888888888806', true),
  ('77777777-7777-4777-8777-777777777707', 'T7', 'Counter 2', '88888888-8888-4888-8888-888888888807', true),
  ('77777777-7777-4777-8777-777777777708', 'T8', 'Counter 3', '88888888-8888-4888-8888-888888888808', true)
ON CONFLICT (id) DO UPDATE SET
  table_number = EXCLUDED.table_number,
  label = EXCLUDED.label,
  qr_token = EXCLUDED.qr_token,
  is_active = EXCLUDED.is_active;

COMMIT;
