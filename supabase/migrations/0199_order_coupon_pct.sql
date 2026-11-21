-- Захиалгын тооцооны «Купон (10%)» мөр (клиентийн засвар 2026-11-21 сл.8).
--
-- Тооцооны мөрөнд купоны кодын оронд хөнгөлөх хувийг харуулна. Купоны
-- хувийг захиалга үүсэх МӨЧИЙН утгаар хадгална (`orders.coupon_pct`) —
-- админ купоныг дараа засвал хуучин захиалгын баримт өөрчлөгдөхгүй.
-- Мөнгөн купон (`fixed`) ба купонгүй захиалгад null → дэлгэц «Купон · КОД».
--
-- Expand only: nullable багана + `place_order` wrapper-т нэг мөр (дүн
-- өөрчлөгдөхгүй). Хуучин код энэ баганыг уншихгүй тул эвдрэхгүй.
-- Дараалал: db:migrate-prod → дараа нь код main руу.

alter table orders
  add column if not exists coupon_pct int
    check (coupon_pct is null or coupon_pct between 1 and 100);

comment on column orders.coupon_pct is
  'Хувийн купоны хувь, захиалга үүсэх үеийн (0199). fixed / купонгүй бол null.';

create or replace function order_snapshot_coupon_pct(p_order uuid)
returns void
language sql
as $$
  update orders o
     set coupon_pct = c.value
    from coupons c
   where o.id = p_order
     and o.coupon_code is not null
     and upper(c.code) = upper(btrim(o.coupon_code))
     and c.type = 'percent'
     and c.value between 1 and 100;
$$;

revoke all on function order_snapshot_coupon_pct(uuid) from public, anon, authenticated;
grant execute on function order_snapshot_coupon_pct(uuid) to service_role;

-- Өмнөх захиалгууд: одоогийн купоны утгаар нөхнө (ихэнх купон засагддаггүй).
update orders o
   set coupon_pct = c.value
  from coupons c
 where o.coupon_pct is null
   and o.coupon_code is not null
   and upper(c.code) = upper(btrim(o.coupon_code))
   and c.type = 'percent'
   and c.value between 1 and 100;

create or replace function place_order(p_order jsonb, p_items jsonb)
returns jsonb language plpgsql as $$
declare
  v_needs boolean;
  v_result jsonb;
  v_order uuid;
begin
  -- Сагсанд зөвшөөрөл шаардах горимын (хоосон шил, үлдэгдэлтэй шил) бараа?
  select exists (
    select 1
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
      join extra_variants v
        on v.id = nullif(i->>'extra_variant_id', '')::uuid
      join extra_products p on p.id = v.extra_id
      join extra_category_modes m
        on m.category_id = p.category_id
       and m.inventory_mode = p.inventory_mode
     where m.requires_consent
  ) into v_needs;

  if v_needs and not coalesce((p_order->>'used_goods_consent')::boolean, false) then
    raise exception 'USED_GOODS_CONSENT_REQUIRED' using errcode = 'check_violation';
  end if;

  v_result := place_order_core(p_order, p_items);
  v_order := (v_result->>'order_id')::uuid;

  if v_needs then
    update orders set used_goods_consent_at = coalesce(used_goods_consent_at, now())
     where id = v_order;
  end if;

  -- 0189: хямдрал / багцын задаргаа (дүнг өөрчлөхгүй).
  perform order_apply_price_breakdown(v_order);

  -- 0199: хувийн купоны хувь — тооцооны «Купон (10%)» мөрөнд.
  perform order_snapshot_coupon_pct(v_order);
  return order_summary(v_order);
end $$;

comment on function place_order(jsonb, jsonb) is
  'Захиалга үүсгэх (0155 wrapper, 0189, 0199): хэрэглэсэн барааны зөвшөөрлийг '
  'шалгаад place_order_core (0149)-г дуудаж, үнийн задаргаа ба купоны хувийг '
  'бичнэ. Хариу = order_summary().';

revoke all on function place_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function place_order(jsonb, jsonb) to service_role;
