-- Kitchen location + profile fields for production delivery / tracking.

alter table public.maker_profiles
  add column if not exists cover_url text,
  add column if not exists kitchen_address text,
  add column if not exists lat double precision,
  add column if not exists lng double precision,
  add column if not exists is_open boolean not null default true;

comment on column public.maker_profiles.kitchen_address is 'Full address from Google Maps / geocoder';
comment on column public.maker_profiles.lat is 'Kitchen latitude WGS84';
comment on column public.maker_profiles.lng is 'Kitchen longitude WGS84';
