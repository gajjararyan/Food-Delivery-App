-- GharKaSwad Phase 0-1 schema
-- Single-kitchen MVP with RLS. Apply via: supabase db push / SQL editor.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
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

do $$ begin
  create type subscription_status as enum ('active', 'paused', 'cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type chef_application_status as enum ('new', 'reviewing', 'accepted', 'rejected');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text not null,
  full_name text,
  avatar_url text,
  jain_preference boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

  create table if not exists public.maker_profiles (
  id uuid primary key default gen_random_uuid(),
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
  created_at timestamptz not null default now()
);

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
  created_at timestamptz not null default now()
);

create table if not exists public.thali_components (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  name text not null,
  included_qty integer not null check (included_qty >= 0),
  min_qty integer not null check (min_qty >= 0),
  max_qty integer not null check (max_qty >= min_qty),
  unit_price_delta numeric(10,2) not null default 0,
  has_jain_variant boolean not null default false,
  jain_substitute text,
  sort_order integer not null default 0
);

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

-- ---------------------------------------------------------------------------
-- updated_at helper
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

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Profile bootstrap on auth.users insert
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone, full_name)
  values (
    new.id,
    coalesce(new.phone, new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'full_name', null)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
