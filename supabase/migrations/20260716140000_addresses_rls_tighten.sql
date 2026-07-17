-- Tighten address access for authenticated Supabase Auth users.
-- DEV_AUTH / anon still uses pilot access (UUID customers without auth.users).
-- Production: prefer real Auth sessions so customer_id = auth.uid().

drop policy if exists "addresses_manage_pilot" on public.addresses;
drop policy if exists "addresses_own_authenticated" on public.addresses;
drop policy if exists "addresses_anon_pilot" on public.addresses;

-- Logged-in users may only manage their own rows.
create policy "addresses_own_authenticated"
  on public.addresses
  for all
  to authenticated
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

-- Anon / DEV_AUTH pilot path (client still filters by customer_id).
-- Remove this policy before public launch if you no longer need DEV_AUTH.
create policy "addresses_anon_pilot"
  on public.addresses
  for all
  to anon
  using (true)
  with check (true);
