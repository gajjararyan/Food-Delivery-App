-- Row Level Security policies for GharKaSwad Phase 0-1

alter table public.profiles enable row level security;
alter table public.maker_profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.thali_components enable row level security;
alter table public.subscriptions enable row level security;
alter table public.orders enable row level security;
alter table public.credits enable row level security;
alter table public.reviews enable row level security;
alter table public.chef_applications enable row level security;

-- profiles: own row only
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- maker_profiles: public read; writes via service role only (no client policies for write)
drop policy if exists "makers_public_read" on public.maker_profiles;
create policy "makers_public_read"
  on public.maker_profiles for select
  using (is_active = true);

-- menu_items: public read; writes service-role only
drop policy if exists "menu_public_read" on public.menu_items;
create policy "menu_public_read"
  on public.menu_items for select
  using (is_available = true);

-- thali_components: public read via available menu items
drop policy if exists "thali_components_public_read" on public.thali_components;
create policy "thali_components_public_read"
  on public.thali_components for select
  using (
    exists (
      select 1 from public.menu_items mi
      where mi.id = thali_components.menu_item_id
        and mi.is_available = true
    )
  );

-- subscriptions: customer owns rows
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = customer_id);

drop policy if exists "subscriptions_insert_own" on public.subscriptions;
create policy "subscriptions_insert_own"
  on public.subscriptions for insert
  with check (auth.uid() = customer_id);

drop policy if exists "subscriptions_update_own" on public.subscriptions;
create policy "subscriptions_update_own"
  on public.subscriptions for update
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

-- orders: customer owns rows; status transitions that require secrets happen via backend service role
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
  on public.orders for select
  using (auth.uid() = customer_id);

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert
  with check (auth.uid() = customer_id);

drop policy if exists "orders_update_own_pending" on public.orders;
create policy "orders_update_own_pending"
  on public.orders for update
  using (
    auth.uid() = customer_id
    and status in ('payment_pending', 'payment_failed')
  )
  with check (auth.uid() = customer_id);

-- credits: customer read-only; inserts via service role (skip/payment flows)
drop policy if exists "credits_select_own" on public.credits;
create policy "credits_select_own"
  on public.credits for select
  using (auth.uid() = customer_id);

-- reviews: customer creates/reads own; public can read for social proof later (MVP: own + maker aggregate via backend)
drop policy if exists "reviews_select_all" on public.reviews;
create policy "reviews_select_all"
  on public.reviews for select
  using (true);

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own"
  on public.reviews for insert
  with check (
    auth.uid() = customer_id
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.customer_id = auth.uid()
        and o.status = 'delivered'
    )
  );

-- chef_applications: authenticated insert (lead capture); no public select
drop policy if exists "chef_applications_insert_authenticated" on public.chef_applications;
create policy "chef_applications_insert_authenticated"
  on public.chef_applications for insert
  to authenticated
  with check (true);

-- Also allow anon lead capture from become-chef form before login
drop policy if exists "chef_applications_insert_anon" on public.chef_applications;
create policy "chef_applications_insert_anon"
  on public.chef_applications for insert
  to anon
  with check (true);
