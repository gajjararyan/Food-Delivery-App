-- Fix Nani Geeta seed thali components: plate items were incorrectly seeded as
-- addon_stepper with included_qty > 0. Builder defaulted add-ons to qty 0, then
-- clamped to min_qty, producing negative price deltas (₹149 Discover → ₹48 builder).

update public.thali_components
set component_type = 'included'
where menu_item_id in (
  '22222222-2222-4222-8222-222222222222',
  '22222222-2222-4222-8222-222222222223'
)
and component_type = 'addon_stepper'
and name in ('Roti', 'Rice', 'Dal', 'Sabzi', 'Papad', 'Sweet');
