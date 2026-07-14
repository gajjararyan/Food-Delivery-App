-- Reviews under DEV_AUTH (no real JWT) — same pattern as place_order / set_order_status.

alter table public.reviews drop constraint if exists reviews_customer_id_fkey;

create or replace function public.submit_review(payload jsonb)
returns public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_customer_id uuid := (payload->>'customer_id')::uuid;
  v_order_id uuid := (payload->>'order_id')::uuid;
  v_maker_id uuid := (payload->>'maker_id')::uuid;
  v_rating integer := coalesce((payload->>'rating')::integer, 0);
  v_comment text := nullif(trim(coalesce(payload->>'comment', '')), '');
  row public.reviews;
  existing public.reviews;
  avg_rating numeric(3,2);
  cnt integer;
begin
  if v_customer_id is null or v_order_id is null or v_maker_id is null then
    raise exception 'customer_id, order_id, and maker_id are required';
  end if;

  if v_rating < 1 or v_rating > 5 then
    raise exception 'rating must be between 1 and 5';
  end if;

  select * into existing from public.reviews where order_id = v_order_id;
  if found then
    return existing;
  end if;

  select * into v_order from public.orders where id = v_order_id;
  if not found then
    raise exception 'Order not found';
  end if;

  if v_order.customer_id is distinct from v_customer_id then
    raise exception 'Order does not belong to this customer';
  end if;

  if v_order.maker_id is distinct from v_maker_id then
    raise exception 'Maker does not match this order';
  end if;

  -- delivered = delivered or takeaway picked up
  if v_order.status is distinct from 'delivered' then
    raise exception 'Only completed orders can be reviewed';
  end if;

  insert into public.reviews (
    customer_id,
    order_id,
    maker_id,
    rating,
    comment
  )
  values (
    v_customer_id,
    v_order_id,
    v_maker_id,
    v_rating,
    v_comment
  )
  returning * into row;

  select
    coalesce(round(avg(r.rating)::numeric, 2), 0),
    count(*)::integer
  into avg_rating, cnt
  from public.reviews r
  where r.maker_id = v_maker_id;

  update public.maker_profiles
  set
    rating_avg = avg_rating,
    rating_count = cnt,
    updated_at = now()
  where id = v_maker_id;

  return row;
end;
$$;

revoke all on function public.submit_review(jsonb) from public;
grant execute on function public.submit_review(jsonb) to anon, authenticated;
