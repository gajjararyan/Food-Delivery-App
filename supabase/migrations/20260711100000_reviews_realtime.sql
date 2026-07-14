-- Live review list + rating counts on chef profile / Discover.
do $$
begin
  begin
    alter publication supabase_realtime add table public.reviews;
  exception when duplicate_object then null; when undefined_object then null;
  end;
end $$;
