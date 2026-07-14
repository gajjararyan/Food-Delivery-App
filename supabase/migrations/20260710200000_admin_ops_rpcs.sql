-- Admin ops visibility under DEV_AUTH (no real JWT for is_app_admin).

create or replace function public.list_chef_applications()
returns setof public.chef_applications
language sql
security definer
set search_path = public
as $$
  select * from public.chef_applications
  order by created_at desc;
$$;

revoke all on function public.list_chef_applications() from public;
grant execute on function public.list_chef_applications() to anon, authenticated;

create or replace function public.set_chef_application_status(
  p_id uuid,
  p_status text
)
returns public.chef_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.chef_applications;
begin
  if p_status not in ('new', 'reviewing', 'accepted', 'rejected') then
    raise exception 'Invalid application status';
  end if;

  update public.chef_applications
  set status = p_status::chef_application_status
  where id = p_id
  returning * into row;

  if not found then
    raise exception 'Application not found';
  end if;

  return row;
end;
$$;

revoke all on function public.set_chef_application_status(uuid, text) from public;
grant execute on function public.set_chef_application_status(uuid, text) to anon, authenticated;

create or replace function public.list_all_makers_admin()
returns setof public.maker_profiles
language sql
security definer
set search_path = public
as $$
  select * from public.maker_profiles
  order by created_at desc;
$$;

revoke all on function public.list_all_makers_admin() from public;
grant execute on function public.list_all_makers_admin() to anon, authenticated;

create or replace function public.list_all_orders_admin()
returns setof public.orders
language sql
security definer
set search_path = public
as $$
  select * from public.orders
  where status <> 'payment_pending'
  order by created_at desc
  limit 200;
$$;

revoke all on function public.list_all_orders_admin() from public;
grant execute on function public.list_all_orders_admin() to anon, authenticated;
