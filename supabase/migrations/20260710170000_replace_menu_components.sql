-- Replace all components for a menu item (avoids duplicate fake extras).
create or replace function public.replace_menu_components(
  p_menu_item_id uuid,
  p_components jsonb
)
returns setof public.thali_components
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.thali_components where menu_item_id = p_menu_item_id;

  return query
  insert into public.thali_components (
    id,
    menu_item_id,
    name,
    serving_amount,
    serving_unit,
    component_type,
    included_qty,
    min_qty,
    max_qty,
    unit_price_delta,
    has_jain_variant,
    jain_substitute,
    sort_order
  )
  select
    coalesce((c->>'id')::uuid, gen_random_uuid()),
    p_menu_item_id,
    coalesce(c->>'name', 'Item'),
    coalesce((c->>'serving_amount')::numeric, 1),
    coalesce((c->>'serving_unit')::serving_unit, 'piece'),
    coalesce((c->>'component_type')::thali_component_type, 'included'),
    coalesce((c->>'included_qty')::integer, 0),
    coalesce((c->>'min_qty')::integer, 0),
    coalesce((c->>'max_qty')::integer, 1),
    coalesce((c->>'unit_price_delta')::numeric, 0),
    coalesce((c->>'has_jain_variant')::boolean, false),
    nullif(c->>'jain_substitute', ''),
    coalesce((c->>'sort_order')::integer, 0)
  from jsonb_array_elements(coalesce(p_components, '[]'::jsonb)) as c
  returning *;
end;
$$;

revoke all on function public.replace_menu_components(uuid, jsonb) from public;
grant execute on function public.replace_menu_components(uuid, jsonb) to anon, authenticated;
