-- Allow the app to upsert community kitchens (admin approve + chef open/close)
-- even when using publishable/anon keys (dev auth has no real JWT for owns_maker).

create or replace function public.upsert_maker_profile(payload jsonb)
returns public.maker_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.maker_profiles;
begin
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
    (payload->>'id')::uuid,
    nullif(payload->>'owner_phone', ''),
    coalesce(payload->>'display_name', 'Home chef'),
    coalesce(payload->>'kitchen_name', 'Home kitchen'),
    nullif(payload->>'bio', ''),
    nullif(payload->>'photo_url', ''),
    nullif(payload->>'cover_url', ''),
    nullif(payload->>'kitchen_address', ''),
    case when payload ? 'lat' and payload->>'lat' is not null and payload->>'lat' <> ''
      then (payload->>'lat')::double precision else null end,
    case when payload ? 'lng' and payload->>'lng' is not null and payload->>'lng' <> ''
      then (payload->>'lng')::double precision else null end,
    coalesce((payload->>'tier')::maker_tier, 'unverified'),
    coalesce(
      array(select jsonb_array_elements_text(coalesce(payload->'cuisine_tags', '[]'::jsonb))),
      '{}'::text[]
    ),
    coalesce((payload->>'rating_avg')::numeric, 0),
    coalesce((payload->>'rating_count')::integer, 0),
    coalesce((payload->>'is_active')::boolean, true),
    coalesce((payload->>'is_open')::boolean, true)
  )
  on conflict (id) do update set
    owner_phone = coalesce(excluded.owner_phone, public.maker_profiles.owner_phone),
    display_name = excluded.display_name,
    kitchen_name = excluded.kitchen_name,
    bio = excluded.bio,
    photo_url = excluded.photo_url,
    cover_url = excluded.cover_url,
    kitchen_address = excluded.kitchen_address,
    lat = excluded.lat,
    lng = excluded.lng,
    tier = excluded.tier,
    cuisine_tags = excluded.cuisine_tags,
    rating_avg = excluded.rating_avg,
    rating_count = excluded.rating_count,
    is_active = excluded.is_active,
    is_open = excluded.is_open,
    updated_at = now()
  returning * into row;

  return row;
end;
$$;

revoke all on function public.upsert_maker_profile(jsonb) from public;
grant execute on function public.upsert_maker_profile(jsonb) to anon, authenticated;

create or replace function public.upsert_menu_item(payload jsonb)
returns public.menu_items
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.menu_items;
begin
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
    (payload->>'id')::uuid,
    (payload->>'maker_id')::uuid,
    coalesce(payload->>'name', 'Thali'),
    nullif(payload->>'description', ''),
    nullif(payload->>'image_url', ''),
    coalesce((payload->>'base_price')::numeric, 0),
    coalesce((payload->>'meal_slot')::meal_slot, 'lunch'),
    coalesce((payload->>'is_available')::boolean, true),
    coalesce((payload->>'has_jain_variant')::boolean, false)
  )
  on conflict (id) do update set
    name = excluded.name,
    description = excluded.description,
    image_url = excluded.image_url,
    base_price = excluded.base_price,
    meal_slot = excluded.meal_slot,
    is_available = excluded.is_available,
    has_jain_variant = excluded.has_jain_variant,
    updated_at = now()
  returning * into row;

  return row;
end;
$$;

revoke all on function public.upsert_menu_item(jsonb) from public;
grant execute on function public.upsert_menu_item(jsonb) to anon, authenticated;
