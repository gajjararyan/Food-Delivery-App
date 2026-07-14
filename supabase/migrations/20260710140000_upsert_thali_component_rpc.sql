-- Upsert thali components so customer thali builder works for community kitchens.

create or replace function public.upsert_thali_component(payload jsonb)
returns public.thali_components
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.thali_components;
begin
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
  values (
    (payload->>'id')::uuid,
    (payload->>'menu_item_id')::uuid,
    coalesce(payload->>'name', 'Item'),
    coalesce((payload->>'serving_amount')::numeric, 1),
    coalesce((payload->>'serving_unit')::serving_unit, 'piece'),
    coalesce((payload->>'component_type')::thali_component_type, 'included'),
    coalesce((payload->>'included_qty')::integer, 0),
    coalesce((payload->>'min_qty')::integer, 0),
    coalesce((payload->>'max_qty')::integer, 1),
    coalesce((payload->>'unit_price_delta')::numeric, 0),
    coalesce((payload->>'has_jain_variant')::boolean, false),
    nullif(payload->>'jain_substitute', ''),
    coalesce((payload->>'sort_order')::integer, 0)
  )
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
    sort_order = excluded.sort_order
  returning * into row;

  return row;
end;
$$;

revoke all on function public.upsert_thali_component(jsonb) from public;
grant execute on function public.upsert_thali_component(jsonb) to anon, authenticated;
