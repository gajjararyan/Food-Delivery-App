-- Realtime for kitchen + menu updates on Discover / chef profile.
do $$
begin
  begin
    alter publication supabase_realtime add table public.maker_profiles;
  exception when duplicate_object then null; when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.menu_items;
  exception when duplicate_object then null; when undefined_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.thali_components;
  exception when duplicate_object then null; when undefined_object then null;
  end;
end $$;
