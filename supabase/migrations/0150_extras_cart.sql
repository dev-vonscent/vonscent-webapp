-- Нэмэлт бараа — сагс ба хадгалсан checkout (extras-shop-plan §10; PR5).
-- Feature flag: `extras_shop`.
--
-- Expand only: `saved_checkouts.extras` (default '[]') — хуучин код үүнийг
-- уншдаггүй, бичдэггүй тул нөлөөгүй.

alter table saved_checkouts
  add column if not exists extras jsonb not null default '[]'::jsonb
    check (jsonb_typeof(extras) = 'array');

-- 0124-ийн бие + `extras` (checkout_snapshot->'extras').
create or replace function save_order_for_later(p_order uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_snap jsonb;
  v_id uuid;
begin
  select user_id, checkout_snapshot into v_user, v_snap
    from orders where id = p_order;
  if v_user is null or v_snap is null then
    return null;
  end if;

  insert into saved_checkouts (user_id, buy_now, items, collections, extras,
                               draft, source_order_id)
  values (
    v_user,
    coalesce((v_snap->>'buyNow')::boolean, false),
    coalesce(v_snap->'items', '[]'::jsonb),
    coalesce(v_snap->'collections', '[]'::jsonb),
    case when jsonb_typeof(v_snap->'extras') = 'array'
         then v_snap->'extras' else '[]'::jsonb end,
    coalesce(v_snap->'draft', '{}'::jsonb),
    p_order
  )
  on conflict (source_order_id) where source_order_id is not null do nothing
  returning id into v_id;

  delete from saved_checkouts s
   where s.user_id = v_user
     and s.id in (
       select id from saved_checkouts
        where user_id = v_user
        order by created_at desc
        offset 10
     );

  return v_id;
end $$;

-- Сагсны нэмэлт барааны мөр одоо зарагдах уу — сагс, checkout нээгдэхэд
-- нэг удаа асууна (`useExtrasAvailability`). Туг хаалттай, бараа нуугдсан
-- бол мөр буцахгүй = «худалдаанаас хасагдсан».
create or replace function extras_variant_status(p_ids uuid[])
returns table (id uuid, price int, available int)
language sql stable security definer set search_path = public as $$
  select v.id, v.price, extra_variant_available(v)
    from extra_variants v
    join extra_products p on p.id = v.extra_id and p.status = 'published'
    join extra_categories c on c.id = p.category_id and c.is_active
   where feature_enabled('extras_shop')
     and v.is_active and v.price > 0
     and (v.inventory_mode <> 'shared_vial' or feature_enabled('vial_inventory'))
     and p_ids is not null
     and v.id = any (p_ids);
$$;

revoke all on function extras_variant_status(uuid[]) from public;
grant execute on function extras_variant_status(uuid[])
  to anon, authenticated, service_role;
