-- Live cook ↔ customer order status (works with DEV_AUTH via security-definer RPCs).
-- Realtime needs a readable SELECT policy; writes go only through RPCs.

alter table public.orders drop constraint if exists orders_customer_id_fkey;
alter table public.orders add column if not exists customer_phone text;

create index if not exists orders_customer_phone_idx
  on public.orders (customer_phone)
  where customer_phone is not null;

-- Pilot read access so Realtime + anon/dev sessions can see status updates.
drop policy if exists "orders_select_own" on public.orders;
drop policy if exists "orders_read_pilot" on public.orders;
create policy "orders_read_pilot"
  on public.orders for select
  to anon, authenticated
  using (true);

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
  -- Reuse unpaid order for same cart signature (avoid double charge on retry).
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
    thali_snapshot
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
    coalesce(payload->'thali_snapshot', '{}'::jsonb)
  )
  returning * into row;

  return row;
end;
$$;

revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;

create or replace function public.set_order_status(
  p_order_id uuid,
  p_status order_status,
  p_maker_id uuid default null,
  p_payment_id text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.orders;
begin
  update public.orders o
  set
    status = p_status,
    razorpay_payment_id = coalesce(p_payment_id, o.razorpay_payment_id),
    updated_at = now()
  where o.id = p_order_id
    and (p_maker_id is null or o.maker_id = p_maker_id)
  returning * into row;

  if not found then
    raise exception 'Order not found or maker mismatch';
  end if;

  return row;
end;
$$;

revoke all on function public.set_order_status(uuid, order_status, uuid, text) from public;
grant execute on function public.set_order_status(uuid, order_status, uuid, text) to anon, authenticated;

-- Realtime for order status (cook ↔ customer).
do $$
begin
  begin
    alter publication supabase_realtime add table public.orders;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
