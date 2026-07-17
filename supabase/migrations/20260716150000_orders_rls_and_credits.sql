-- Required production hardening: orders RLS, credits ledger for DEV_AUTH, grant_credit RPC.
-- Apply after 20260716120000_addresses_and_pickup.sql and 20260716140000_addresses_rls_tighten.sql.

-- ---------------------------------------------------------------------------
-- Orders: authenticated users only see their own / own kitchen / admin.
-- Anon pilot kept for DEV_AUTH + Realtime (client still filters).
-- ---------------------------------------------------------------------------
drop policy if exists "orders_read_pilot" on public.orders;
drop policy if exists "orders_select_authenticated" on public.orders;
drop policy if exists "orders_select_anon_pilot" on public.orders;

create policy "orders_select_authenticated"
  on public.orders for select
  to authenticated
  using (
    auth.uid() = customer_id
    or public.owns_maker(maker_id)
    or public.is_app_admin()
  );

create policy "orders_select_anon_pilot"
  on public.orders for select
  to anon
  using (true);

-- ---------------------------------------------------------------------------
-- Credits: allow DEV_AUTH customer ids (no profiles FK), grant via RPC.
-- ---------------------------------------------------------------------------
alter table public.credits drop constraint if exists credits_customer_id_fkey;
alter table public.credits drop constraint if exists credits_order_id_fkey;

alter table public.credits
  add column if not exists order_id uuid;

create index if not exists credits_customer_id_idx on public.credits (customer_id, created_at desc);

drop policy if exists "credits_select_own" on public.credits;
drop policy if exists "credits_select_authenticated" on public.credits;
drop policy if exists "credits_select_anon_pilot" on public.credits;

create policy "credits_select_authenticated"
  on public.credits for select
  to authenticated
  using (auth.uid() = customer_id or public.is_app_admin());

create policy "credits_select_anon_pilot"
  on public.credits for select
  to anon
  using (true);

create or replace function public.grant_credit(payload jsonb)
returns public.credits
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.credits;
  amt numeric;
begin
  amt := coalesce((payload->>'amount')::numeric, 0);
  if amt <= 0 then
    raise exception 'Credit amount must be positive';
  end if;
  if payload->>'customer_id' is null then
    raise exception 'customer_id required';
  end if;

  insert into public.credits (
    customer_id,
    amount,
    reason,
    order_id
  )
  values (
    (payload->>'customer_id')::uuid,
    amt,
    coalesce(nullif(payload->>'reason', ''), 'Wallet credit'),
    nullif(payload->>'order_id', '')::uuid
  )
  returning * into row;

  return row;
end;
$$;

revoke all on function public.grant_credit(jsonb) from public;
grant execute on function public.grant_credit(jsonb) to anon, authenticated;
