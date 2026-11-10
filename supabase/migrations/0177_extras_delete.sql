-- Нэмэлт барааг бүрмөсөн устгах (extras-shop-plan §7.1).
--
-- Андуурч үүсгэсэн бараа (ж: «Хуулбарлах»-ыг санамсаргүй дарсан) архивт
-- үүрд үлдэхгүйн тулд. Зөвхөн ТҮҮХГҮЙ барааг:
--   - захиалгын мөр (order_items) байхгүй,
--   - худалдан авалт (`purchase` — тайлангийн зардал), тохируулга
--     (`adjust`), захиалгын хөдөлгөөн (reserve/commit/release/restock)
--     байхгүй. Өртөггүй `set` (анхны тоо, гараар тоолсон) л байж болно.
-- Түүхтэй бол `EXTRA_HAS_HISTORY` — тайлан, захиалгын түүх эвдрэхгүйн тулд
-- архивлана. Үлдэгдэлтэй шил жагсаалтад байвал эх үнэртний ml-ийг суллана.
-- Устгалын хамгаалалт (0145a `extras_forbid_delete`) хэвээр: зөвхөн энэ RPC
-- `vonscent.extra_delete`-ийг transaction дотор асааж бараа, хувилбар,
-- түгжээг устгана (`vonscent.stock_move`-тай ижил загвар). Ангилал, сав
-- хэзээ ч устахгүй.
-- Expand-only: шинэ RPC; хуучин код тохиргоог асаадаггүй тул өмнөх шигээ.

create or replace function extras_forbid_delete()
returns trigger language plpgsql as $$
begin
  if tg_table_name in ('extra_products', 'extra_variants', 'leftover_liquid_locks')
     and coalesce(current_setting('vonscent.extra_delete', true), '') = '1' then
    return old;
  end if;
  raise exception 'EXTRA_DELETE_FORBIDDEN:%', tg_table_name
    using errcode = 'check_violation';
end $$;

create or replace function extras_delete(p_extra uuid)
returns jsonb language plpgsql as $$
declare
  v_row extra_products;
  v_lock leftover_liquid_locks;
begin
  select * into v_row from extra_products where id = p_extra;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'check_violation';
  end if;
  -- extras_set_status-тэй ижил дараалал: эх үнэртний inventory → бараа.
  if v_row.inventory_mode = 'leftover_liquid' then
    perform 1 from inventory where product_id = v_row.product_id for update;
  end if;
  select * into v_row from extra_products where id = p_extra for update;
  perform 1 from extra_variants where extra_id = p_extra for update;

  if exists (
       select 1 from order_items o
         join extra_variants v on v.id = o.extra_variant_id
        where v.extra_id = p_extra)
     or exists (
       select 1 from extra_movements m
         join extra_variants v on v.id = m.extra_variant_id
        where v.extra_id = p_extra and m.kind <> 'set') then
    raise exception 'EXTRA_HAS_HISTORY' using errcode = 'check_violation';
  end if;

  perform set_config('vonscent.extra_delete', '1', true);
  if v_row.inventory_mode = 'leftover_liquid' then
    select * into v_lock from leftover_liquid_locks
     where extra_product_id = p_extra for update;
    if found and v_lock.state in ('reserved', 'committed') then
      raise exception 'EXTRA_HAS_HISTORY' using errcode = 'check_violation';
    end if;
    perform leftover_unlist(p_extra, v_row.product_id);
    delete from leftover_liquid_locks where extra_product_id = p_extra;
  end if;

  delete from extra_movements m
   using extra_variants v
   where v.id = m.extra_variant_id and v.extra_id = p_extra;
  delete from extra_variants where extra_id = p_extra;
  delete from extra_products where id = p_extra;
  perform set_config('vonscent.extra_delete', '', true);

  return jsonb_build_object('ok', true, 'id', p_extra);
end $$;

revoke all on function extras_delete(uuid) from public, anon, authenticated;
grant execute on function extras_delete(uuid) to service_role;
