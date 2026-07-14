-- Add cook acceptance step to order lifecycle.
-- Flow: payment_pending → placed → accepted → cooking → out_for_delivery → delivered

do $$
begin
  if not exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    where t.typname = 'order_status'
      and e.enumlabel = 'accepted'
  ) then
    alter type order_status add value 'accepted' after 'placed';
  end if;
end $$;
