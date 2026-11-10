-- Савны тоон нөөц — админ ба зарагдах дүрэм (extras-shop-plan §8; PR9, PR10).
-- Feature flag: `vial_inventory` (анхдагч false).
--
-- Туг хаалттай үед ЮУ Ч өөрчлөгдөхгүй: `variant_sellable` хуучин
-- асаах/унтраах түгжээгээр (0095) хэвээр. Нээгдэхэд хэмжээ бүр өөрийн
-- өнгө × ml-ийн савны тоогоор зарагдана — каталог, хайлт, багцын хэмжээ,
-- захиалга бүгд энэ НЭГ функцээс уншдаг.

------------------------------------------------------------------------------
-- 1. variant_sellable (0095) — савны салаа
------------------------------------------------------------------------------

create or replace function variant_sellable(
  pv             product_variants,
  p_gender       gender_t,
  p_sold_out     boolean,
  p_available_ml int
)
returns boolean language sql stable as $$
  select pv.is_active
     and case
           when feature_enabled('vial_inventory') then
             -- Override асаалттай бол түүний өнгө, эс бөгөөс барааны өнгө,
             -- тэр нь ч үгүй бол хүйсээр (perfume_vial_style, 0149).
             vial_available(vial_for(perfume_vial_style(pv.product_id, pv.ml), pv.ml))
           else
             bottle_active(p_gender, pv.ml) or coalesce(pv.bottle_override, false)
         end
     and not coalesce(p_sold_out, false)
     and coalesce(p_available_ml, 0) >= pv.ml;
$$;

comment on function variant_sellable is
  'Хэмжээ өнөөдөр зарагдах уу: админ идэвхтэй + сав (vial_inventory үед '
  'тоогоор, эс бөгөөс 0095-ын түгжээ) + эх савны ml хүрэлцэнэ.';

-- TS-ийн толь (`mapProduct`): савгүйгээс зарагдахгүй хувилбарууд. Туг
-- хаалттай бол хоосон — TS хуучин түгжээгээр (bottle_stock) уншина.
create or replace function vial_blocked_variants()
returns setof uuid
language sql stable security definer set search_path = public as $$
  select pv.id
    from product_variants pv
    join products p on p.id = pv.product_id
   where feature_enabled('vial_inventory')
     and pv.is_active
     and p.status in ('active', 'coming_soon')
     and not vial_available(vial_for(perfume_vial_style(pv.product_id, pv.ml), pv.ml));
$$;

revoke all on function vial_blocked_variants() from public;
grant execute on function vial_blocked_variants() to anon, authenticated, service_role;

------------------------------------------------------------------------------
-- 2. Админ: «Нийт тоо» (§5.2, §8)
--
-- Тоо = савлагдаад хүргэгдээгүй захиалгынхыг ОРУУЛААД нийт. Захиалгад орсноос
-- бага байж болохгүй. Цонх нээгдсэнээс хойш тоо өөрчлөгдсөн бол хадгалахгүй.
------------------------------------------------------------------------------

create or replace function set_vial_count(
  p_vial uuid,
  p_count int,
  p_expected_updated_at timestamptz,
  p_note text,
  p_by uuid
) returns jsonb language plpgsql as $$
declare
  v vials;
begin
  select * into v from vials where id = p_vial for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'check_violation';
  end if;
  if p_expected_updated_at is not null
     and date_trunc('milliseconds', p_expected_updated_at)
         is distinct from date_trunc('milliseconds', v.updated_at) then
    return jsonb_build_object('ok', false, 'reason', 'STALE',
      'on_hand', v.on_hand, 'reserved', v.reserved, 'updated_at', v.updated_at);
  end if;
  if p_count is null or p_count < v.reserved then
    return jsonb_build_object('ok', false, 'reason', 'BELOW_RESERVED',
      'on_hand', v.on_hand, 'reserved', v.reserved, 'updated_at', v.updated_at);
  end if;
  if v.on_hand is distinct from p_count then
    perform vial_stock_move(p_vial, 'set', p_count - coalesce(v.on_hand, 0), 0,
      null, null, coalesce(p_note, ''), p_by);
  end if;
  update vials set updated_by = p_by where id = p_vial;
  select * into v from vials where id = p_vial;
  return jsonb_build_object('ok', true, 'on_hand', v.on_hand,
    'reserved', v.reserved, 'updated_at', v.updated_at);
end $$;

revoke all on function set_vial_count(uuid, int, timestamptz, text, uuid)
  from public, anon, authenticated;
grant execute on function set_vial_count(uuid, int, timestamptz, text, uuid)
  to service_role;
