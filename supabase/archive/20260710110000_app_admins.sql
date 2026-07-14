-- Reserved admin phone(s) for production-like role checks.
-- App also reads EXPO_PUBLIC_ADMIN_PHONES; this table is the DB source of truth when synced.

create table if not exists public.app_admins (
  phone text primary key,
  label text,
  created_at timestamptz not null default now()
);

insert into public.app_admins (phone, label)
values ('+911234567890', 'Primary admin')
on conflict (phone) do nothing;

alter table public.app_admins enable row level security;

drop policy if exists "app_admins_select_authenticated" on public.app_admins;
create policy "app_admins_select_authenticated"
  on public.app_admins for select
  to authenticated
  using (true);
