-- Seed / demo kitchen aligned with production schema (serving sizes + kitchen geo).
-- Run after 20260710120000_production_schema.sql

insert into public.maker_profiles (
  id,
  owner_phone,
  display_name,
  kitchen_name,
  bio,
  photo_url,
  cover_url,
  kitchen_address,
  lat,
  lng,
  tier,
  cuisine_tags,
  rating_avg,
  rating_count,
  is_active,
  is_open
)
values (
  '11111111-1111-4111-8111-111111111111',
  null,
  'Nani Geeta',
  'Nani Geeta''s Kitchen',
  'Home-style Gujarati thalis cooked fresh every day.',
  null,
  null,
  'Satellite, Ahmedabad, Gujarat',
  23.0225,
  72.5714,
  'featured',
  array['Gujarati', 'Home-style', 'Jain-friendly'],
  4.80,
  128,
  true,
  true
)
on conflict (id) do update set
  display_name = excluded.display_name,
  kitchen_name = excluded.kitchen_name,
  bio = excluded.bio,
  kitchen_address = excluded.kitchen_address,
  lat = excluded.lat,
  lng = excluded.lng,
  tier = excluded.tier,
  cuisine_tags = excluded.cuisine_tags,
  rating_avg = excluded.rating_avg,
  rating_count = excluded.rating_count,
  is_active = excluded.is_active,
  is_open = excluded.is_open,
  updated_at = now();

insert into public.menu_items (
  id, maker_id, name, description, image_url, base_price, meal_slot, is_available, has_jain_variant
)
values
  (
    '22222222-2222-4222-8222-222222222222',
    '11111111-1111-4111-8111-111111111111',
    'Gujarati Thali (Lunch)',
    'Roti, rice, dal, sabzi, papad & sweet — customize portions.',
    null,
    149.00,
    'lunch',
    true,
    true
  ),
  (
    '22222222-2222-4222-8222-222222222223',
    '11111111-1111-4111-8111-111111111111',
    'Gujarati Thali (Dinner)',
    'Evening thali with the same customizable components.',
    null,
    159.00,
    'dinner',
    true,
    true
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  base_price = excluded.base_price,
  meal_slot = excluded.meal_slot,
  is_available = excluded.is_available,
  has_jain_variant = excluded.has_jain_variant,
  updated_at = now();

-- Lunch components
insert into public.thali_components (
  id, menu_item_id, name, serving_amount, serving_unit, component_type,
  included_qty, min_qty, max_qty, unit_price_delta, has_jain_variant, jain_substitute, sort_order
)
values
  -- Plate items must be `included` so default builder qty = included_qty and
  -- Discover base_price matches the live default total (no phantom negative deltas).
  ('33333333-3333-4333-8333-333333333301', '22222222-2222-4222-8222-222222222222', 'Roti',  1, 'piece', 'included', 3, 1, 6, 8.00,  false, null, 1),
  ('33333333-3333-4333-8333-333333333302', '22222222-2222-4222-8222-222222222222', 'Rice',  150, 'gm', 'included', 1, 0, 2, 15.00, false, null, 2),
  ('33333333-3333-4333-8333-333333333303', '22222222-2222-4222-8222-222222222222', 'Dal',   150, 'ml', 'included', 1, 0, 2, 20.00, true,  'Moong dal (no onion/garlic)', 3),
  ('33333333-3333-4333-8333-333333333304', '22222222-2222-4222-8222-222222222222', 'Sabzi', 120, 'gm', 'included', 1, 0, 2, 25.00, true,  'Mixed veg (no root vegetables)', 4),
  ('33333333-3333-4333-8333-333333333305', '22222222-2222-4222-8222-222222222222', 'Papad', 1, 'piece', 'included', 1, 0, 3, 5.00,  false, null, 5),
  ('33333333-3333-4333-8333-333333333306', '22222222-2222-4222-8222-222222222222', 'Sweet', 1, 'bowl', 'included', 1, 0, 2, 20.00, true,  'Jain shrikhand', 6)
on conflict (id) do update set
  name = excluded.name,
  serving_amount = excluded.serving_amount,
  serving_unit = excluded.serving_unit,
  component_type = excluded.component_type,
  included_qty = excluded.included_qty,
  min_qty = excluded.min_qty,
  max_qty = excluded.max_qty,
  unit_price_delta = excluded.unit_price_delta,
  has_jain_variant = excluded.has_jain_variant,
  jain_substitute = excluded.jain_substitute,
  sort_order = excluded.sort_order;

-- Dinner components
insert into public.thali_components (
  id, menu_item_id, name, serving_amount, serving_unit, component_type,
  included_qty, min_qty, max_qty, unit_price_delta, has_jain_variant, jain_substitute, sort_order
)
values
  ('33333333-3333-4333-8333-333333333311', '22222222-2222-4222-8222-222222222223', 'Roti',  1, 'piece', 'included', 3, 1, 6, 8.00,  false, null, 1),
  ('33333333-3333-4333-8333-333333333312', '22222222-2222-4222-8222-222222222223', 'Rice',  150, 'gm', 'included', 1, 0, 2, 15.00, false, null, 2),
  ('33333333-3333-4333-8333-333333333313', '22222222-2222-4222-8222-222222222223', 'Dal',   150, 'ml', 'included', 1, 0, 2, 20.00, true,  'Moong dal (no onion/garlic)', 3),
  ('33333333-3333-4333-8333-333333333314', '22222222-2222-4222-8222-222222222223', 'Sabzi', 120, 'gm', 'included', 1, 0, 2, 25.00, true,  'Mixed veg (no root vegetables)', 4),
  ('33333333-3333-4333-8333-333333333315', '22222222-2222-4222-8222-222222222223', 'Papad', 1, 'piece', 'included', 1, 0, 3, 5.00,  false, null, 5),
  ('33333333-3333-4333-8333-333333333316', '22222222-2222-4222-8222-222222222223', 'Sweet', 1, 'bowl', 'included', 1, 0, 2, 20.00, true,  'Jain shrikhand', 6)
on conflict (id) do update set
  name = excluded.name,
  serving_amount = excluded.serving_amount,
  serving_unit = excluded.serving_unit,
  component_type = excluded.component_type,
  included_qty = excluded.included_qty,
  min_qty = excluded.min_qty,
  max_qty = excluded.max_qty,
  unit_price_delta = excluded.unit_price_delta,
  has_jain_variant = excluded.has_jain_variant,
  jain_substitute = excluded.jain_substitute,
  sort_order = excluded.sort_order;

insert into public.app_admins (phone, label)
values ('+911234567890', 'Primary admin')
on conflict (phone) do nothing;
