-- Seed: Nani Geeta kitchen + Gujarati Thali with Jain-capable components
-- Deterministic UUIDs so app code / docs can reference them stably.

insert into public.maker_profiles (
  id,
  display_name,
  kitchen_name,
  bio,
  photo_url,
  tier,
  cuisine_tags,
  rating_avg,
  rating_count,
  is_active
)
values (
  '11111111-1111-4111-8111-111111111111',
  'Nani Geeta',
  'Nani Geeta''s Kitchen',
  'Traditional Gujarati recipes, cooked fresh each morning. Jain-friendly swaps available on every thali.',
  null,
  'verified',
  array['Gujarati', 'Home-style', 'Vegetarian'],
  4.90,
  128,
  true
)
on conflict (id) do update set
  display_name = excluded.display_name,
  kitchen_name = excluded.kitchen_name,
  bio = excluded.bio,
  tier = excluded.tier,
  cuisine_tags = excluded.cuisine_tags,
  rating_avg = excluded.rating_avg,
  rating_count = excluded.rating_count,
  is_active = excluded.is_active;

insert into public.menu_items (
  id,
  maker_id,
  name,
  description,
  image_url,
  base_price,
  meal_slot,
  is_available,
  has_jain_variant
)
values (
  '22222222-2222-4222-8222-222222222222',
  '11111111-1111-4111-8111-111111111111',
  'Gujarati Thali',
  'Roti, rice, dal, sabzi, papad & sweet — customize quantities to your appetite.',
  null,
  149.00,
  'lunch',
  true,
  true
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  base_price = excluded.base_price,
  is_available = excluded.is_available,
  has_jain_variant = excluded.has_jain_variant;

delete from public.thali_components
where menu_item_id in (
  '22222222-2222-4222-8222-222222222222',
  '22222222-2222-4222-8222-222222222223'
);

insert into public.thali_components (
  id,
  menu_item_id,
  name,
  included_qty,
  min_qty,
  max_qty,
  unit_price_delta,
  has_jain_variant,
  jain_substitute,
  sort_order
)
values
  ('33333333-3333-4333-8333-333333333301', '22222222-2222-4222-8222-222222222222', 'Roti',  3, 1, 6, 8.00,  false, null, 1),
  ('33333333-3333-4333-8333-333333333302', '22222222-2222-4222-8222-222222222222', 'Rice',  1, 0, 2, 15.00, false, null, 2),
  ('33333333-3333-4333-8333-333333333303', '22222222-2222-4222-8222-222222222222', 'Dal',   1, 0, 2, 20.00, true,  'Moong dal (no onion/garlic)', 3),
  ('33333333-3333-4333-8333-333333333304', '22222222-2222-4222-8222-222222222222', 'Sabzi', 1, 0, 2, 25.00, true,  'Mixed veg (no root vegetables)', 4),
  ('33333333-3333-4333-8333-333333333305', '22222222-2222-4222-8222-222222222222', 'Papad', 1, 0, 3, 5.00,  false, null, 5),
  ('33333333-3333-4333-8333-333333333306', '22222222-2222-4222-8222-222222222222', 'Sweet', 1, 0, 2, 20.00, true,  'Jain shrikhand', 6);

insert into public.menu_items (
  id,
  maker_id,
  name,
  description,
  image_url,
  base_price,
  meal_slot,
  is_available,
  has_jain_variant
)
values (
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
  is_available = excluded.is_available,
  has_jain_variant = excluded.has_jain_variant;

insert into public.thali_components (
  id,
  menu_item_id,
  name,
  included_qty,
  min_qty,
  max_qty,
  unit_price_delta,
  has_jain_variant,
  jain_substitute,
  sort_order
)
values
  ('33333333-3333-4333-8333-333333333311', '22222222-2222-4222-8222-222222222223', 'Roti',  3, 1, 6, 8.00,  false, null, 1),
  ('33333333-3333-4333-8333-333333333312', '22222222-2222-4222-8222-222222222223', 'Rice',  1, 0, 2, 15.00, false, null, 2),
  ('33333333-3333-4333-8333-333333333313', '22222222-2222-4222-8222-222222222223', 'Dal',   1, 0, 2, 20.00, true,  'Moong dal (no onion/garlic)', 3),
  ('33333333-3333-4333-8333-333333333314', '22222222-2222-4222-8222-222222222223', 'Sabzi', 1, 0, 2, 25.00, true,  'Mixed veg (no root vegetables)', 4),
  ('33333333-3333-4333-8333-333333333315', '22222222-2222-4222-8222-222222222223', 'Papad', 1, 0, 3, 5.00,  false, null, 5),
  ('33333333-3333-4333-8333-333333333316', '22222222-2222-4222-8222-222222222223', 'Sweet', 1, 0, 2, 20.00, true,  'Jain shrikhand', 6);
