-- Saved addresses + takeaway pickup PIN.
-- No auth.users FK — matches orders pilot pattern so DEV_AUTH customer ids work.

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  label text not null,
  lat double precision not null,
  lng double precision not null,
  formatted_hint text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists addresses_customer_id_idx on public.addresses(customer_id);

alter table public.addresses enable row level security;

drop policy if exists "customers manage own addresses" on public.addresses;
drop policy if exists "addresses_manage_pilot" on public.addresses;
-- Pilot: anon/dev sessions can CRUD; app filters by customer_id client-side (same as orders_read_pilot).
create policy "addresses_manage_pilot"
  on public.addresses
  for all
  to anon, authenticated
  using (true)
  with check (true);

alter table public.orders
  add column if not exists pickup_pin text;

-- Accept optional pickup_pin from client payload (generated in createOrderFromCart for takeaway).
create or replace function public.place_order(payload jsonb)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.orders;
  existing public.orders;
begin
  select * into existing
  from public.orders o
  where o.customer_id = (payload->>'customer_id')::uuid
    and o.menu_item_id = (payload->>'menu_item_id')::uuid
    and o.meal_date = (payload->>'meal_date')::date
    and o.delivery_window = (payload->>'delivery_window')::delivery_window
    and o.status in ('payment_pending', 'payment_failed')
  order by o.created_at desc
  limit 1;

  if found then
    return existing;
  end if;

  insert into public.orders (
    id,
    customer_id,
    customer_phone,
    maker_id,
    menu_item_id,
    status,
    meal_date,
    meal_slot,
    delivery_window,
    subtotal,
    credits_applied,
    total,
    thali_snapshot,
    pickup_pin
  )
  values (
    coalesce((payload->>'id')::uuid, gen_random_uuid()),
    (payload->>'customer_id')::uuid,
    nullif(payload->>'customer_phone', ''),
    (payload->>'maker_id')::uuid,
    (payload->>'menu_item_id')::uuid,
    coalesce((payload->>'status')::order_status, 'payment_pending'),
    (payload->>'meal_date')::date,
    (payload->>'meal_slot')::meal_slot,
    (payload->>'delivery_window')::delivery_window,
    coalesce((payload->>'subtotal')::numeric, 0),
    coalesce((payload->>'credits_applied')::numeric, 0),
    coalesce((payload->>'total')::numeric, 0),
    coalesce(payload->'thali_snapshot', '{}'::jsonb),
    nullif(payload->>'pickup_pin', '')
  )
  returning * into row;

  return row;
end;
$$;

revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;
