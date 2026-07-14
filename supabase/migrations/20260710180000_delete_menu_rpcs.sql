-- Chef menu CRUD deletes (DEV_AUTH / anon has no owns_maker JWT).
-- Mirrors upsert_* RPCs so delete actually removes rows customers see.

create or replace function public.delete_menu_item(p_menu_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.thali_components where menu_item_id = p_menu_item_id;
  delete from public.menu_items where id = p_menu_item_id;
end;
$$;

revoke all on function public.delete_menu_item(uuid) from public;
grant execute on function public.delete_menu_item(uuid) to anon, authenticated;

create or replace function public.delete_thali_component(p_component_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.thali_components where id = p_component_id;
end;
$$;

revoke all on function public.delete_thali_component(uuid) from public;
grant execute on function public.delete_thali_component(uuid) to anon, authenticated;
