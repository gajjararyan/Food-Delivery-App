-- =============================================================================
-- GharKaSwad production schema alignment
-- Brings DB in sync with the Expo app: email, serving sizes, chef ownership,
-- kitchen location, admin, order accept flow, and chef/admin RLS.
-- Safe to re-run (IF NOT EXISTS / additive alters).
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums (idempotent)
-- ---------------------------------------------------------------------------
do $$ begin
  create type maker_tier as enum ('unverified', 'verified', 'featured');
exception when duplicate_object then null; end $$;

do $$ begin
  create type meal_slot as enum ('lunch', 'dinner');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_window as enum ('13:00-13:15', '19:00-19:15');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'payment_pending',
    'placed',
    'accepted',
    'cooking',
    'out_for_delivery',
    'delivered',
    'cancelled',
    'payment_failed'
  );
exception when duplicate_object then null; end $$;

-- accepted may be missing on older DBs
do $$
begin
  if not exists (
    select 1 from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'order_status' and e.enumlabel = 'accepted'
  ) then
    alter type order_status add value 'accepted' after 'placed';
  end if;
end $$;

do $$ begin
  create type subscription_status as enum ('active', 'paused', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type chef_application_status as enum ('new', 'reviewing', 'accepted', 'rejected');
exception when duplicate_object then null; end $$;

do $$ begin
  create type serving_unit as enum ('gm', 'ml', 'piece', 'bowl', 'plate');
exception when duplicate_object then null; end $$;

do $$ begin
  create type thali_component_type as enum ('included', 'addon_toggle', 'addon_stepper');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text not null,
  full_name text,
  email text,
  avatar_url text,
  jain_preference boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists email text;

create unique index if not exists profiles_phone_uidx
  on public.profiles (phone)
  where phone is not null and phone <> '';

create table if not exists public.maker_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users (id) on delete set null,
  owner_phone text,
  display_name text not null,
  kitchen_name text not null,
  bio text,
  photo_url text,
  cover_url text,
  kitchen_address text,
  lat double precision,
  lng double precision,
  tier maker_tier not null default 'unverified',
  cuisine_tags text[] not null default '{}',
  rating_avg numeric(3,2) not null default 0,
  rating_count integer not null default 0,
  is_active boolean not null default true,
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.maker_profiles add column if not exists owner_user_id uuid references auth.users (id) on delete set null;
alter table public.maker_profiles add column if not exists owner_phone text;
alter table public.maker_profiles add column if not exists cover_url text;
alter table public.maker_profiles add column if not exists kitchen_address text;
alter table public.maker_profiles add column if not exists lat double precision;
alter table public.maker_profiles add column if not exists lng double precision;
alter table public.maker_profiles add column if not exists is_open boolean not null default true;
alter table public.maker_profiles add column if not exists updated_at timestamptz not null default now();

create unique index if not exists maker_profiles_owner_phone_uidx
  on public.maker_profiles (owner_phone)
  where owner_phone is not null;

create index if not exists maker_profiles_active_idx
  on public.maker_profiles (is_active, is_open);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  maker_id uuid not null references public.maker_profiles (id) on delete cascade,
  name text not null,
  description text,
  image_url text,
  base_price numeric(10,2) not null check (base_price >= 0),
  meal_slot meal_slot not null,
  is_available boolean not null default true,
  has_jain_variant boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.menu_items add column if not exists updated_at timestamptz not null default now();

create index if not exists menu_items_maker_idx on public.menu_items (maker_id);

create table if not exists public.thali_components (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  name text not null,
  serving_amount numeric(10,2) not null default 1 check (serving_amount > 0),
  serving_unit serving_unit not null default 'piece',
  component_type thali_component_type not null default 'included',
  included_qty integer not null check (included_qty >= 0),
  min_qty integer not null check (min_qty >= 0),
  max_qty integer not null check (max_qty >= min_qty),
  unit_price_delta numeric(10,2) not null default 0,
  has_jain_variant boolean not null default false,
  jain_substitute text,
  sort_order integer not null default 0
);

alter table public.thali_components add column if not exists serving_amount numeric(10,2) not null default 1;
alter table public.thali_components add column if not exists serving_unit serving_unit not null default 'piece';
alter table public.thali_components add column if not exists component_type thali_component_type not null default 'included';

create index if not exists thali_components_menu_idx on public.thali_components (menu_item_id);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  maker_id uuid not null references public.maker_profiles (id),
  menu_item_id uuid not null references public.menu_items (id),
  plan_days integer not null check (plan_days > 0),
  meal_slot meal_slot not null,
  delivery_window delivery_window not null,
  status subscription_status not null default 'active',
  paused_dates date[] not null default '{}',
  starts_on date not null,
  ends_on date,
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  maker_id uuid not null references public.maker_profiles (id),
  menu_item_id uuid not null references public.menu_items (id),
  status order_status not null default 'payment_pending',
  meal_date date not null,
  meal_slot meal_slot not null,
  delivery_window delivery_window not null,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  credits_applied numeric(10,2) not null default 0 check (credits_applied >= 0),
  total numeric(10,2) not null check (total >= 0),
  razorpay_order_id text,
  razorpay_payment_id text,
  thali_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists orders_razorpay_order_id_uidx
  on public.orders (razorpay_order_id)
  where razorpay_order_id is not null;

create index if not exists orders_customer_idx on public.orders (customer_id, created_at desc);
create index if not exists orders_maker_idx on public.orders (maker_id, status, created_at desc);

create table if not exists public.credits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(10,2) not null,
  reason text not null,
  order_id uuid references public.orders (id) on delete set null,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  maker_id uuid not null references public.maker_profiles (id),
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (order_id)
);

create table if not exists public.chef_applications (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  city text not null,
  cuisine_experience text not null,
  message text,
  status chef_application_status not null default 'new',
  created_at timestamptz not null default now()
);

create index if not exists chef_applications_status_idx
  on public.chef_applications (status, created_at desc);

create table if not exists public.app_admins (
  phone text primary key,
  label text,
  created_at timestamptz not null default now()
);

insert into public.app_admins (phone, label)
values ('+911234567890', 'Primary admin')
on conflict (phone) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_user_phone()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(auth.jwt() ->> 'phone', ''),
    (select p.phone from public.profiles p where p.id = auth.uid())
  );
$$;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.app_admins a
    where a.phone = public.current_user_phone()
  );
$$;

create or replace function public.owns_maker(maker uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.maker_profiles m
    where m.id = maker
      and (
        m.owner_user_id = auth.uid()
        or (m.owner_phone is not null and m.owner_phone = public.current_user_phone())
      )
  );
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

drop trigger if exists maker_profiles_set_updated_at on public.maker_profiles;
create trigger maker_profiles_set_updated_at
  before update on public.maker_profiles
  for each row execute function public.set_updated_at();

drop trigger if exists menu_items_set_updated_at on public.menu_items;
create trigger menu_items_set_updated_at
  before update on public.menu_items
  for each row execute function public.set_updated_at();

-- Profile bootstrap on auth signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, full_name, email)
  values (
    new.id,
    coalesce(new.phone, new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'full_name', null),
    coalesce(new.raw_user_meta_data->>'email', new.email, null)
  )
  on conflict (id) do update set
    phone = excluded.phone,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    email = coalesce(excluded.email, public.profiles.email),
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.maker_profiles enable row level security;
alter table public.menu_items enable row level security;
alter table public.thali_components enable row level security;
alter table public.subscriptions enable row level security;
alter table public.orders enable row level security;
alter table public.credits enable row level security;
alter table public.reviews enable row level security;
alter table public.chef_applications enable row level security;
alter table public.app_admins enable row level security;

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id or public.is_app_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- makers: public read active; owner can update own kitchen
drop policy if exists "makers_public_read" on public.maker_profiles;
create policy "makers_public_read"
  on public.maker_profiles for select
  using (is_active = true or public.owns_maker(id) or public.is_app_admin());

drop policy if exists "makers_update_own" on public.maker_profiles;
create policy "makers_update_own"
  on public.maker_profiles for update
  using (public.owns_maker(id) or public.is_app_admin())
  with check (public.owns_maker(id) or public.is_app_admin());

-- menu: public read available; owner manages all their items
drop policy if exists "menu_public_read" on public.menu_items;
create policy "menu_public_read"
  on public.menu_items for select
  using (
    is_available = true
    or public.owns_maker(maker_id)
    or public.is_app_admin()
  );

drop policy if exists "menu_owner_write" on public.menu_items;
drop policy if exists "menu_owner_insert" on public.menu_items;
create policy "menu_owner_insert"
  on public.menu_items for insert
  with check (public.owns_maker(maker_id) or public.is_app_admin());

drop policy if exists "menu_owner_update" on public.menu_items;
create policy "menu_owner_update"
  on public.menu_items for update
  using (public.owns_maker(maker_id) or public.is_app_admin())
  with check (public.owns_maker(maker_id) or public.is_app_admin());

drop policy if exists "menu_owner_delete" on public.menu_items;
create policy "menu_owner_delete"
  on public.menu_items for delete
  using (public.owns_maker(maker_id) or public.is_app_admin());

-- components
drop policy if exists "thali_components_public_read" on public.thali_components;
create policy "thali_components_public_read"
  on public.thali_components for select
  using (
    exists (
      select 1 from public.menu_items mi
      where mi.id = thali_components.menu_item_id
        and (
          mi.is_available = true
          or public.owns_maker(mi.maker_id)
          or public.is_app_admin()
        )
    )
  );

drop policy if exists "thali_components_owner_write" on public.thali_components;
drop policy if exists "thali_components_owner_insert" on public.thali_components;
create policy "thali_components_owner_insert"
  on public.thali_components for insert
  with check (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_id
        and (public.owns_maker(mi.maker_id) or public.is_app_admin())
    )
  );

drop policy if exists "thali_components_owner_update" on public.thali_components;
create policy "thali_components_owner_update"
  on public.thali_components for update
  using (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_id
        and (public.owns_maker(mi.maker_id) or public.is_app_admin())
    )
  );

drop policy if exists "thali_components_owner_delete" on public.thali_components;
create policy "thali_components_owner_delete"
  on public.thali_components for delete
  using (
    exists (
      select 1 from public.menu_items mi
      where mi.id = menu_item_id
        and (public.owns_maker(mi.maker_id) or public.is_app_admin())
    )
  );

-- subscriptions
drop policy if exists "subscriptions_select_own" on public.subscriptions;
create policy "subscriptions_select_own"
  on public.subscriptions for select
  using (auth.uid() = customer_id or public.owns_maker(maker_id) or public.is_app_admin());

drop policy if exists "subscriptions_insert_own" on public.subscriptions;
create policy "subscriptions_insert_own"
  on public.subscriptions for insert
  with check (auth.uid() = customer_id);

drop policy if exists "subscriptions_update_own" on public.subscriptions;
create policy "subscriptions_update_own"
  on public.subscriptions for update
  using (auth.uid() = customer_id)
  with check (auth.uid() = customer_id);

-- orders: customer + kitchen chef + admin
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
  on public.orders for select
  using (
    auth.uid() = customer_id
    or public.owns_maker(maker_id)
    or public.is_app_admin()
  );

drop policy if exists "orders_insert_own" on public.orders;
create policy "orders_insert_own"
  on public.orders for insert
  with check (auth.uid() = customer_id);

drop policy if exists "orders_update_own_pending" on public.orders;
create policy "orders_update_own_pending"
  on public.orders for update
  using (
    (
      auth.uid() = customer_id
      and status in ('payment_pending', 'payment_failed')
    )
    or public.owns_maker(maker_id)
    or public.is_app_admin()
  )
  with check (
    auth.uid() = customer_id
    or public.owns_maker(maker_id)
    or public.is_app_admin()
  );

-- credits
drop policy if exists "credits_select_own" on public.credits;
create policy "credits_select_own"
  on public.credits for select
  using (auth.uid() = customer_id or public.is_app_admin());

-- reviews
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

-- chef applications
drop policy if exists "chef_applications_insert_authenticated" on public.chef_applications;
create policy "chef_applications_insert_authenticated"
  on public.chef_applications for insert
  to authenticated
  with check (true);

drop policy if exists "chef_applications_insert_anon" on public.chef_applications;
create policy "chef_applications_insert_anon"
  on public.chef_applications for insert
  to anon
  with check (true);

drop policy if exists "chef_applications_select_admin" on public.chef_applications;
create policy "chef_applications_select_admin"
  on public.chef_applications for select
  using (public.is_app_admin());

drop policy if exists "chef_applications_update_admin" on public.chef_applications;
create policy "chef_applications_update_admin"
  on public.chef_applications for update
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- app admins readable by authenticated (role checks)
drop policy if exists "app_admins_select_authenticated" on public.app_admins;
create policy "app_admins_select_authenticated"
  on public.app_admins for select
  to authenticated
  using (true);
