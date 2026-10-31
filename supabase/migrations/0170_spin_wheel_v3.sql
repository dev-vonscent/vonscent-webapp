-- Азын хүрд v3 (docs/lucky-wheel.md §11, feature flag `lucky_wheel`).
--
--   1. Шагнал админаас нэмэгдэж/хасагдана — «Идэвхтэй» сонголт алга, байрлал
--      нь жагсаалтын дараалал (`admin_save_spin_prizes`).
--   2. Шинэ төрөл `product` (0169): админы сонгосон бараа × мл. Гранд багцтай
--      ижил замаар — хожих → дараагийн захиалгад 0₮-өөр хавсаргах → нөөц
--      захиалгатай нэг transaction-д reserve (`attach_spin_prize`).
--   3. Шинэ сан: 9 шагнал, тус бүрийн хооронд «Хоосон» — 18 нүд, жин нь хувиар
--      (нийлбэр 100).
--   4. «Хоосон» дээр буухад гарах зөвлөгөө (`settings.spin.missTips`).
--   5. Тайлан: хугацаа/эрхийн төрлөөр шүүж, шагнал бүрийн задаргаа
--      (`spin_wheel_prize_report`).
--
-- Expand only: nullable баганууд, шинэ функц; хуучин функцуудын гарын үсэг,
-- хариуны хэлбэр хэвээр (зөвхөн талбар нэмэгдсэн) — prod-д migration эхэлж
-- орж, хуучин код хэсэг хугацаанд ажилласан ч эвдрэхгүй.

------------------------------------------------------------------------------
-- 1. Багана
------------------------------------------------------------------------------

alter table spin_wheel_prizes
  add column if not exists product_id uuid
    references products(id) on delete set null,
  add column if not exists ml int
    check (ml is null or ml in (2, 5, 10, 20));

-- Шагналын snapshot (бусад талбарын адил): админ маргааш барааг солиход
-- өчигдрийн хожсон шагнал өөрчлөгдөхгүй.
alter table spin_wheel_spins
  add column if not exists product_id uuid
    references products(id) on delete set null,
  add column if not exists ml int;

-- Админ дарааллыг сольж хадгалахад хоёр мөр түр зуур ижил `slot`-той болно —
-- шалгалтыг transaction-ийн төгсгөлд.
alter table spin_wheel_prizes drop constraint if exists spin_wheel_prizes_slot_key;
alter table spin_wheel_prizes
  add constraint spin_wheel_prizes_slot_key unique (slot)
  deferrable initially deferred;

------------------------------------------------------------------------------
-- 2. «Хоосон»-ий зөвлөгөө — админ засна (Азын хүрд → Ерөнхий тохиргоо)
------------------------------------------------------------------------------

update settings
   set value = value || jsonb_build_object('missTips', jsonb_build_array(
     jsonb_build_object(
       'title', 'V point гэж юу вэ?',
       'body', 'Үнэнч хэрэглэгчээ урамшуулж буй оноо — хүрд эргүүлж бэлэг хожих зэрэгт ашиглах боломжтой.'),
     jsonb_build_object(
       'title', 'Захиалгаа цуцлах болон өөрчлөх',
       'body', 'Та захиалга өгсөн өдрийнхөө 23:59:59 хүртэл «Миний захиалга» хэсгээс захиалгаа бүрэн цуцлах боломжтой. Бараа нэмэх, хасах бол оператортой холбогдоно уу.'),
     jsonb_build_object(
       'title', 'Түвшин гэж юу вэ?',
       'body', 'Энгийн стандарт түвшний хэрэглэгч захиалга бүрийнхээ 1%-ийг V point болгон цуглуулдаг бол түвшин ахих тусам 2%–5% хүртэл нэмэгдэнэ. Түвшин хэрхэн ахих, өөрийн түвшнээ профайлын «Түвшин» цэснээс харна уу.')))
 where key = 'spin' and not (value ? 'missTips');

------------------------------------------------------------------------------
-- 3. Шинэ сан: 9 шагнал + 9 «Хоосон» (клиент, 2026-10-31)
------------------------------------------------------------------------------
--
-- Жин нь хувиар: шагналууд 19%, «Хоосон» 9 × 9 = 81%. Ижил төрөл зэрэгцэхгүй
-- (купон ба оноо ээлжилнэ). Зөвхөн v2-ийн 26 нүдтэй сан хэвээр байвал —
-- дахин ажиллуулах, эсвэл админ v3 дээр засвар хийсний дараа хөндөхгүй.
-- Хуучин эргэлтийн түүх snapshot-оор үлдэнэ (`prize_id` → null).
do $$ begin
  if (select count(*) from spin_wheel_prizes) = 26
     and exists (select 1 from spin_wheel_prizes where slot = 26 and kind = 'none') then
    delete from spin_wheel_prizes;
    insert into spin_wheel_prizes
      (slot, label, short_label, kind, tier, value, min_subtotal, max_discount,
       weight, monthly_cap, fallback_slot, is_active)
    values
      ( 1, '2мл таних багц',    '2мл багц', 'bundle',         'grand',     1,      0, null, 0.2, null, null, true),
      ( 2, 'Хоосон',            '',         'none',           'common',    0,      0, null, 9.0, null, null, true),
      ( 3, '5,000₮ хөнгөлөлт',  '5,000₮',   'coupon_fixed',   'common', 5000, 100000, null, 3.2, null, null, true),
      ( 4, 'Хоосон',            '',         'none',           'common',    0,      0, null, 9.0, null, null, true),
      ( 5, '1,000 V point',     '1,000V',   'points',         'common', 1000,      0, null, 5.0, null, null, true),
      ( 6, 'Хоосон',            '',         'none',           'common',    0,      0, null, 9.0, null, null, true),
      ( 7, '5% хөнгөлөлт',      '5%',       'coupon_percent', 'common',    5,      0, null, 3.0, null, null, true),
      ( 8, 'Хоосон',            '',         'none',           'common',    0,      0, null, 9.0, null, null, true),
      ( 9, '3,000 V point',     '3,000V',   'points',         'common', 3000,      0, null, 3.0, null, null, true),
      (10, 'Хоосон',            '',         'none',           'common',    0,      0, null, 9.0, null, null, true),
      (11, '10,000₮ хөнгөлөлт', '10,000₮',  'coupon_fixed',   'rare',  10000, 100000, null, 1.6, null, null, true),
      (12, 'Хоосон',            '',         'none',           'common',    0,      0, null, 9.0, null, null, true),
      (13, '5,000 V point',     '5,000V',   'points',         'rare',   5000,      0, null, 1.0, null, null, true),
      (14, 'Хоосон',            '',         'none',           'common',    0,      0, null, 9.0, null, null, true),
      (15, '10% хөнгөлөлт',     '10%',      'coupon_percent', 'rare',     10,      0, null, 1.5, null, null, true),
      (16, 'Хоосон',            '',         'none',           'common',    0,      0, null, 9.0, null, null, true),
      (17, '10,000 V point',    '10,000V',  'points',         'rare',  10000,      0, null, 0.5, null, null, true),
      (18, 'Хоосон',            '',         'none',           'common',    0,      0, null, 9.0, null, null, true);
  end if;
end $$;

------------------------------------------------------------------------------
-- 4. Админы хадгалалт: нэмэх / хасах / дараалал нэг transaction-д
------------------------------------------------------------------------------

/**
 * `p_prizes` — хүрдний бүх шагнал, дарааллаараа (1-р элемент = 1-р нүд).
 * `id`-гүй мөр шинээр нэмэгдэнэ, жагсаалтад байхгүй мөр устна. Хэлбэрийг
 * route (Zod) шалгасан; энд зөвхөн төрөл бүрийн нөхцөл.
 */
create or replace function admin_save_spin_prizes(p_prizes jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_item jsonb;
  v_slot int := 0;
  v_id uuid;
  v_kind spin_prize_kind_t;
  v_keep uuid[] := '{}';
begin
  if jsonb_typeof(p_prizes) <> 'array' or jsonb_array_length(p_prizes) = 0
     or jsonb_array_length(p_prizes) > 40 then
    raise exception 'PRIZES_INVALID' using errcode = 'check_violation';
  end if;

  for v_item in select * from jsonb_array_elements(p_prizes) loop
    v_slot := v_slot + 1;
    v_kind := (v_item->>'kind')::spin_prize_kind_t;
    if v_kind = 'product'
       and (nullif(v_item->>'productId', '') is null
            or (v_item->>'ml')::int is null) then
      raise exception 'PRODUCT_REQUIRED' using errcode = 'check_violation';
    end if;

    v_id := nullif(v_item->>'id', '')::uuid;
    if v_id is not null
       and exists (select 1 from spin_wheel_prizes where id = v_id) then
      update spin_wheel_prizes set
        slot = v_slot,
        label = v_item->>'label',
        short_label = coalesce(v_item->>'shortLabel', ''),
        kind = v_kind,
        tier = (v_item->>'tier')::spin_prize_tier_t,
        value = coalesce((v_item->>'value')::int, 0),
        min_subtotal = coalesce((v_item->>'minSubtotal')::int, 0),
        max_discount = (v_item->>'maxDiscount')::int,
        weight = coalesce((v_item->>'weight')::numeric, 0),
        monthly_cap = (v_item->>'monthlyCap')::int,
        -- Байрлал солигдох тул дугаараар заасан шилжилт утгаа алддаг.
        fallback_slot = null,
        product_id = case when v_kind = 'product'
                          then (v_item->>'productId')::uuid end,
        ml = case when v_kind = 'product' then (v_item->>'ml')::int end,
        is_active = true
      where id = v_id;
    else
      insert into spin_wheel_prizes
        (slot, label, short_label, kind, tier, value, min_subtotal,
         max_discount, weight, monthly_cap, product_id, ml, is_active)
      values (
        v_slot, v_item->>'label', coalesce(v_item->>'shortLabel', ''), v_kind,
        (v_item->>'tier')::spin_prize_tier_t,
        coalesce((v_item->>'value')::int, 0),
        coalesce((v_item->>'minSubtotal')::int, 0),
        (v_item->>'maxDiscount')::int,
        coalesce((v_item->>'weight')::numeric, 0),
        (v_item->>'monthlyCap')::int,
        case when v_kind = 'product' then (v_item->>'productId')::uuid end,
        case when v_kind = 'product' then (v_item->>'ml')::int end,
        true)
      returning id into v_id;
    end if;
    v_keep := v_keep || v_id;
  end loop;

  -- Хасагдсан шагнал: түүх нь `spin_wheel_spins`-д snapshot-оор үлдэнэ.
  delete from spin_wheel_prizes where not (id = any (v_keep));
end $$;

revoke all on function admin_save_spin_prizes(jsonb) from public, anon, authenticated;
grant execute on function admin_save_spin_prizes(jsonb) to service_role;

------------------------------------------------------------------------------
-- 5. Бодит бараа одоо өгч болох уу
------------------------------------------------------------------------------

/**
 * Энэ бараа энэ мл-ээр одоо цутгагдах боломжтой юу: идэвхтэй бараа, идэвхтэй
 * хэмжээ, савны түгжээ (0095), нөөц. Сугалаа дууссан барааг сугалахгүй —
 * хэрэглэгчид өгч чадахгүй юм амлахгүйн тулд.
 */
create or replace function spin_product_available(p_product uuid, p_ml int)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from products p
      join product_variants pv
        on pv.product_id = p.id and pv.ml = p_ml and pv.is_active
      join inventory i on i.product_id = p.id
     where p.id = p_product
       and p.status = 'active'
       and (p.gender is null or bottle_active(p.gender, p_ml)
            or coalesce(pv.bottle_override, false))
       and not i.is_sold_out
       and i.on_hand_ml - i.reserved_ml >= p_ml
  );
$$;

revoke all on function spin_product_available(uuid, int) from public, anon, authenticated;
grant execute on function spin_product_available(uuid, int) to service_role;

------------------------------------------------------------------------------
-- 6. Сугалаа (0129-ийн хуулбар; өөрчлөлт нь «v3» тэмдэгтэй)
------------------------------------------------------------------------------

create or replace function spin_wheel(p_user uuid, p_mode text default 'free')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cfg jsonb;
  v_hours int;
  v_cost int;
  v_point_cap int;
  v_rare_cap int;
  v_valid_days int;
  v_single boolean;
  v_points int;
  v_last timestamptz;
  v_next timestamptz;
  v_month timestamptz := spin_month_start();
  v_total numeric;
  v_rand numeric;
  v_id uuid;
  v_prize spin_wheel_prizes%rowtype;
  v_hop spin_wheel_prizes%rowtype;
  v_hops int := 0;
  v_blocked text;
  v_used_points int;
  v_rare_used int;
  v_taken int;
  v_code text;
  v_coupon_id uuid;
  v_expires timestamptz;
  v_spent int := 0;
  v_credit uuid;
  v_type spin_type_t;
  v_spin_id uuid;
begin
  if p_user is null then
    return jsonb_build_object('ok', false, 'reason', 'AUTH');
  end if;
  if p_mode is null or p_mode not in ('free', 'order', 'points') then
    return jsonb_build_object('ok', false, 'reason', 'INVALID');
  end if;
  v_type := case p_mode when 'points' then 'paid' when 'order' then 'order'
                        else 'free' end::spin_type_t;

  select value into v_cfg from settings where key = 'spin';
  v_cfg := coalesce(v_cfg, '{}'::jsonb);
  if not coalesce((v_cfg->>'enabled')::boolean, true) then
    return jsonb_build_object('ok', false, 'reason', 'DISABLED');
  end if;
  v_hours := coalesce((v_cfg->>'freeSpinHours')::int, 24);
  v_cost := greatest(coalesce((v_cfg->>'spinCost')::int, 1000), 0);
  v_point_cap := coalesce((v_cfg->>'monthlyPointCap')::int, 0);
  v_rare_cap := coalesce((v_cfg->>'rareCouponPerMonth')::int, 0);
  v_valid_days := coalesce((v_cfg->>'couponValidDays')::int, 30);
  v_single := coalesce((v_cfg->>'singleActiveCoupon')::boolean, false);

  select loyalty_points into v_points from profiles where id = p_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'AUTH');
  end if;

  if p_mode = 'points' then
    if v_cost <= 0 or v_points < v_cost then
      return jsonb_build_object('ok', false, 'reason', 'NOT_ENOUGH_POINTS',
        'points', v_points, 'spinCost', v_cost);
    end if;
    v_spent := v_cost;
  elsif p_mode = 'order' then
    select c.order_id into v_credit
      from spin_wheel_credits c
     where c.user_id = p_user and c.revoked_at is null
       and c.spins > (select count(*) from spin_wheel_spins s
                       where s.credit_order_id = c.order_id)
     order by c.created_at, c.order_id
     limit 1;
    if v_credit is null then
      return jsonb_build_object('ok', false, 'reason', 'NO_ORDER_SPINS');
    end if;
  else
    select max(created_at) into v_last from spin_wheel_spins
      where user_id = p_user and spin_type = 'free';
    if v_last is not null then
      v_next := v_last + make_interval(hours => v_hours);
      if v_next > now() then
        return jsonb_build_object('ok', false, 'reason', 'COOLDOWN', 'nextFreeAt', v_next);
      end if;
    end if;
  end if;

  select coalesce(sum(value), 0) into v_used_points from spin_wheel_spins
    where user_id = p_user and kind = 'points' and created_at >= v_month;
  select count(*) into v_rare_used from spin_wheel_spins
    where user_id = p_user and tier = 'rare'
      and kind in ('coupon_percent', 'coupon_fixed') and created_at >= v_month;

  -- ── Жинтэй сугалаа ───────────────────────────────────────────────────
  -- v3: дууссан бодит бараа сугалаанд орохгүй (жин нь бусдад хуваарилагдана).
  select sum(weight) into v_total from spin_wheel_prizes
   where is_active and weight > 0
     and (kind <> 'product' or spin_product_available(product_id, ml));
  if coalesce(v_total, 0) <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'NO_PRIZES');
  end if;
  v_rand := random() * v_total;
  select w.id into v_id from (
    select id, slot,
           sum(weight) over (order by slot rows between unbounded preceding and current row) as cum
      from spin_wheel_prizes
     where is_active and weight > 0
       and (kind <> 'product' or spin_product_available(product_id, ml))
  ) w where w.cum >= v_rand order by w.cum limit 1;
  select * into v_prize from spin_wheel_prizes where id = v_id;

  loop
    v_blocked := null;
    if v_prize.kind = 'points'
       and v_point_cap > 0 and v_used_points + v_prize.value > v_point_cap then
      v_blocked := 'MONTHLY_POINT_CAP';
    elsif v_prize.tier = 'rare'
       and v_prize.kind in ('coupon_percent', 'coupon_fixed')
       and v_rare_cap > 0 and v_rare_used >= v_rare_cap then
      v_blocked := 'RARE_COUPON_CAP';
    elsif v_prize.monthly_cap is not null then
      select count(*) into v_taken from spin_wheel_spins
        where prize_id = v_prize.id and created_at >= v_month;
      if v_taken >= v_prize.monthly_cap then
        v_blocked := 'MONTHLY_STOCK';
      end if;
    end if;
    exit when v_blocked is null;

    v_hops := v_hops + 1;
    exit when v_hops > 3 or v_prize.fallback_slot is null;
    select * into v_hop from spin_wheel_prizes
      where slot = v_prize.fallback_slot and is_active;
    exit when not found;
    v_prize := v_hop;
  end loop;

  if v_blocked is not null then
    select * into v_prize from spin_wheel_prizes
      where is_active
        and monthly_cap is null
        and kind <> 'product'
        and not (kind = 'points'
                 and v_point_cap > 0 and v_used_points + value > v_point_cap)
        and not (tier = 'rare' and kind in ('coupon_percent', 'coupon_fixed')
                 and v_rare_cap > 0 and v_rare_used >= v_rare_cap)
      order by weight desc limit 1;
    if not found then
      return jsonb_build_object('ok', false, 'reason', 'NO_PRIZES');
    end if;
  end if;

  -- ── Төлбөр ───────────────────────────────────────────────────────────
  if v_spent > 0 then
    update profiles set loyalty_points = loyalty_points - v_spent where id = p_user;
    insert into loyalty_ledger (user_id, delta, reason)
      values (p_user, -v_spent, 'spin_cost');
    v_points := v_points - v_spent;
  end if;

  -- ── Шагнал олгох ─────────────────────────────────────────────────────
  if v_prize.kind = 'points' then
    update profiles set loyalty_points = loyalty_points + v_prize.value where id = p_user;
    insert into loyalty_ledger (user_id, delta, reason)
      values (p_user, v_prize.value, 'spin');
    v_points := v_points + v_prize.value;

  elsif v_prize.kind in ('coupon_percent', 'coupon_fixed') then
    if v_single then
      update coupons set is_active = false
        where user_id = p_user and source = 'spin' and is_active and used_count = 0;
    end if;
    v_code := generate_coupon_code('VW');
    v_expires := now() + make_interval(days => v_valid_days);
    insert into coupons (code, user_id, type, value, min_subtotal, max_discount,
                         max_uses, max_uses_per_user, ends_at, is_active, source)
    values (v_code, p_user,
            case when v_prize.kind = 'coupon_percent' then 'percent' else 'fixed' end::coupon_type_t,
            v_prize.value, v_prize.min_subtotal, v_prize.max_discount,
            1, 1, v_expires, true, 'spin')
    returning id into v_coupon_id;
  end if;
  -- `bundle` / `product`: дараагийн захиалгад хавсарна (attach_spin_prize).
  -- `none`: олгох юм алга.

  insert into spin_wheel_spins
    (user_id, prize_id, slot, label, kind, tier, value, spin_type, points_spent,
     coupon_id, credit_order_id, product_id, ml)
  values (p_user, v_prize.id, v_prize.slot, v_prize.label, v_prize.kind, v_prize.tier,
          v_prize.value, v_type, v_spent, v_coupon_id, v_credit,
          case when v_prize.kind = 'product' then v_prize.product_id end,
          case when v_prize.kind = 'product' then v_prize.ml end)
  returning id into v_spin_id;

  if p_mode = 'free' then
    v_next := now() + make_interval(hours => v_hours);
  else
    select max(created_at) into v_last from spin_wheel_spins
      where user_id = p_user and spin_type = 'free';
    v_next := case when v_last is null then null
                   else v_last + make_interval(hours => v_hours) end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'spinId', v_spin_id,
    'slot', v_prize.slot,
    'label', v_prize.label,
    'shortLabel', case when v_prize.short_label = '' then v_prize.label else v_prize.short_label end,
    'kind', v_prize.kind,
    'tier', v_prize.tier,
    'value', v_prize.value,
    'minSubtotal', v_prize.min_subtotal,
    'maxDiscount', v_prize.max_discount,
    'couponCode', v_code,
    'couponExpiresAt', v_expires,
    'pointsSpent', v_spent,
    'points', v_points,
    'orderSpins', spin_order_balance(p_user),
    'nextFreeAt', v_next,
    'freeReady', v_next is null or v_next <= now());
end $$;

revoke all on function spin_wheel(uuid, text) from public, anon, authenticated;
grant execute on function spin_wheel(uuid, text) to service_role;

------------------------------------------------------------------------------
-- 7. Бодит шагнал хожих: хугацаа + мэдэгдэл (0165-ийг бараанд өргөтгөв)
------------------------------------------------------------------------------

create or replace function spin_wheel_spins_bundle_expiry()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_days int;
begin
  if new.kind in ('bundle', 'product') and new.expires_at is null then
    select coalesce((value->>'bundleClaimDays')::int, 60) into v_days
      from settings where key = 'spin';
    new.expires_at := coalesce(new.created_at, now())
      + make_interval(days => greatest(coalesce(v_days, 60), 1));
  end if;
  return new;
end $$;

create or replace function spin_wheel_spins_bundle_won()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_phone text;
begin
  if new.kind not in ('bundle', 'product')
     or not feature_enabled('lucky_wheel') then
    return new;
  end if;

  perform notify_user(
    new.user_id,
    'prize_won',
    case when new.kind = 'bundle' then 'Та гранд шагнал хожлоо!'
         else 'Та шагнал хожлоо!' end,
    case when new.kind = 'bundle'
         then 'Эрэгтэй эсвэл эмэгтэй 2мл багцаа сонгоод дараагийн захиалгадаа үнэгүй аваарай.'
         else format('«%s» дараагийн захиалгад тань үнэгүй орно.', new.label) end,
    '/lucky-wheel#prizes',
    jsonb_build_object('spinId', new.id),
    'prize_won:' || new.id,
    now()
  );

  select full_name, phone into v_name, v_phone
    from profiles where id = new.user_id;
  insert into admin_notifications (kind, message)
    values ('spin_grand', format(
      'Азын хүрд: %s (%s) %s «%s» хожлоо',
      coalesce(nullif(btrim(v_name), ''), 'Хэрэглэгч'),
      coalesce(v_phone, '—'),
      case when new.kind = 'bundle' then 'гранд шагнал' else 'бодит шагнал' end,
      new.label));
  return new;
end $$;

------------------------------------------------------------------------------
-- 8. Захиалгад хавсаргах: багц ба бараа
------------------------------------------------------------------------------

/**
 * Нэг шагналыг үүссэн захиалгад 0₮-ийн бэлгийн мөрөөр хавсаргаж, нөөцийг
 * reserve хийнэ. Авах боломжгүй (эзэн биш, сонгоогүй, авсан, хугацаа
 * дууссан) эсвэл нөөц/сав хүрэхгүй бол `PRIZE_UNAVAILABLE` — дуудагчийн
 * transaction бүхэлдээ буцна (захиалга ч үүсэхгүй).
 */
create or replace function attach_spin_prize(p_order uuid, p_user uuid, p_spin uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_spin spin_wheel_spins;
  v_coll_name text;
  v_item record;
  v_lines int := 0;
  v_note text;
begin
  -- Нэг шагналыг зэрэг хоёр захиалгад авахаас хамгаална.
  select * into v_spin from spin_wheel_spins where id = p_spin for update;
  if not found
     or v_spin.user_id is distinct from p_user
     or v_spin.kind not in ('bundle', 'product')
     or (v_spin.kind = 'bundle' and v_spin.bundle_collection_id is null)
     or (v_spin.kind = 'product' and (v_spin.product_id is null or v_spin.ml is null))
     or v_spin.claim_order_id is not null
     or v_spin.fulfilled_at is not null
     or (v_spin.expires_at is not null and v_spin.expires_at < now()) then
    raise exception 'PRIZE_UNAVAILABLE' using errcode = 'check_violation';
  end if;

  if v_spin.kind = 'bundle' then
    select name into v_coll_name
      from collections where id = v_spin.bundle_collection_id;
    for v_item in
      select ci.product_id, 2 as ml
        from collection_items ci
       where ci.collection_id = v_spin.bundle_collection_id
       order by ci.sort_order
    loop
      v_lines := v_lines + 1;
      perform attach_spin_line(p_order, v_spin, v_item.product_id, v_item.ml,
        v_spin.bundle_collection_id,
        'Азын хүрдний шагнал · ' || coalesce(v_coll_name, ''));
    end loop;
    v_note := 'Азын хүрдний гранд шагнал хавсаргав: ' || coalesce(v_coll_name, '');
  else
    v_lines := 1;
    perform attach_spin_line(p_order, v_spin, v_spin.product_id, v_spin.ml,
      null, null);
    v_note := 'Азын хүрдний шагнал хавсаргав: ' || v_spin.label;
  end if;

  if v_lines = 0 then
    raise exception 'PRIZE_UNAVAILABLE' using errcode = 'check_violation';
  end if;

  update spin_wheel_spins
     set claim_order_id = p_order, claimed_at = now()
   where id = v_spin.id;

  insert into order_status_history (order_id, status, note, changed_by)
    select p_order, o.status, v_note, p_user
      from orders o where o.id = p_order;
end $$;

/** Нэг шагналын нэг мөр: шалгаад reserve хийж, 0₮ мөрийг бичнэ. */
create or replace function attach_spin_line(
  p_order uuid,
  p_spin spin_wheel_spins,
  p_product uuid,
  p_ml int,
  p_collection uuid,
  p_collection_name text
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_product record;
  v_variant uuid;
  v_override boolean;
begin
  select name, brand, gender, status into v_product
    from products where id = p_product;
  if not found or v_product.status <> 'active' then
    raise exception 'PRIZE_UNAVAILABLE' using errcode = 'check_violation';
  end if;

  select pv.id, coalesce(pv.bottle_override, false)
    into v_variant, v_override
    from product_variants pv
   where pv.product_id = p_product and pv.ml = p_ml and pv.is_active
   for share;
  if not found then
    raise exception 'PRIZE_UNAVAILABLE' using errcode = 'check_violation';
  end if;

  -- place_order-ийн адил савны түгжээ (0095).
  if v_product.gender is not null
     and not (bottle_active(v_product.gender, p_ml) or v_override) then
    raise exception 'PRIZE_UNAVAILABLE' using errcode = 'check_violation';
  end if;

  if not reserve_inventory(p_product, p_ml) then
    raise exception 'PRIZE_UNAVAILABLE' using errcode = 'check_violation';
  end if;

  insert into order_items (
    order_id, product_id, variant_id, product_name, brand,
    ml, unit_price, list_price, qty, is_sample, line_total,
    collection_id, collection_name, is_gift, spin_id
  ) values (
    p_order, p_product, v_variant, coalesce(v_product.name, ''),
    coalesce(v_product.brand, ''),
    p_ml, 0, 0, 1, false, 0,
    p_collection, p_collection_name, true, p_spin.id
  );
end $$;

revoke all on function attach_spin_prize(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function attach_spin_line(uuid, spin_wheel_spins, uuid, int, uuid, text)
  from public, anon, authenticated;

/** 0165-ийн гарын үсэг хэвээр — нэг шагнал (хуучин route). */
create or replace function place_order_with_prize(
  p_order jsonb,
  p_items jsonb,
  p_spin uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_res jsonb;
  v_user uuid := nullif(p_order->>'user_id', '')::uuid;
begin
  v_res := place_order(p_order, p_items);
  if p_spin is null then
    return v_res;
  end if;
  if v_user is null or not feature_enabled('lucky_wheel') then
    raise exception 'PRIZE_UNAVAILABLE' using errcode = 'check_violation';
  end if;
  perform attach_spin_prize((v_res->>'order_id')::uuid, v_user, p_spin);
  return v_res || jsonb_build_object('prize_spin_id', p_spin);
end $$;

/**
 * v3: хэд хэдэн шагналыг нэг захиалгад. Аль нэг нь авах боломжгүй бол бүгд
 * буцна — route `PRIZE_UNAVAILABLE`-ийг клиентэд өгч, шагналгүйгээр дахин
 * санал болгоно.
 */
create or replace function place_order_with_prizes(
  p_order jsonb,
  p_items jsonb,
  p_spins uuid[] default '{}'
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_res jsonb;
  v_user uuid := nullif(p_order->>'user_id', '')::uuid;
  v_order uuid;
  v_spin uuid;
  v_ids uuid[] := '{}';
begin
  v_res := place_order(p_order, p_items);
  if coalesce(cardinality(p_spins), 0) = 0 then
    return v_res;
  end if;
  if v_user is null or not feature_enabled('lucky_wheel') then
    raise exception 'PRIZE_UNAVAILABLE' using errcode = 'check_violation';
  end if;

  v_order := (v_res->>'order_id')::uuid;
  for v_spin in select distinct unnest(p_spins) loop
    perform attach_spin_prize(v_order, v_user, v_spin);
    v_ids := v_ids || v_spin;
  end loop;
  return v_res || jsonb_build_object('prize_spin_ids', to_jsonb(v_ids));
end $$;

revoke all on function place_order_with_prize(jsonb, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function place_order_with_prize(jsonb, jsonb, uuid)
  to service_role;
revoke all on function place_order_with_prizes(jsonb, jsonb, uuid[])
  from public, anon, authenticated;
grant execute on function place_order_with_prizes(jsonb, jsonb, uuid[])
  to service_role;

------------------------------------------------------------------------------
-- 9. Сануулга: бараа ч мөн адил
------------------------------------------------------------------------------

create or replace function remind_spin_prizes()
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if not feature_enabled('lucky_wheel') then
    return;
  end if;
  for r in
    select id, user_id, kind, label, expires_at
      from spin_wheel_spins
     where kind in ('bundle', 'product')
       and claim_order_id is null
       and fulfilled_at is null
       and expires_at > now()
       and expires_at <= now() + interval '7 days'
  loop
    perform notify_user(
      r.user_id,
      'prize_won',
      'Шагналын хугацаа дуусах гэж байна',
      format('%s %s хүртэл захиалгадаа үнэгүй аваарай.',
             case when r.kind = 'bundle' then '2мл багцаа'
                  else 'Шагналаа' end,
             to_char(r.expires_at at time zone 'Asia/Ulaanbaatar', 'YYYY.MM.DD')),
      '/lucky-wheel#prizes',
      jsonb_build_object('spinId', r.id),
      'prize_remind:' || r.id,
      now()
    );
  end loop;
end $$;

------------------------------------------------------------------------------
-- 10. Тайлан: шүүлттэй, шагнал бүрийн задаргаатай
------------------------------------------------------------------------------

/**
 * `p_from` / `p_to` — эргэлтийн хугацаа (to нь exclusive, null = хязгааргүй),
 * `p_type` — 'free' | 'order' | 'paid' | null (бүгд).
 *
 * Шагналаар бүлэглэх түлхүүр нь snapshot (`kind`, `value`, `label`): нэг шагнал
 * хэд хэдэн нүдэнд байсан ч, админ устгасан ч нэг мөр болно.
 */
create or replace function spin_wheel_prize_report(
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_type text default null
)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_out jsonb;
begin
  if not is_staff() then
    return jsonb_build_object('error', 'FORBIDDEN');
  end if;

  with s as (
    select sp.*,
           c.used_count as c_used,
           c.ends_at as c_ends,
           c.is_active as c_active
      from spin_wheel_spins sp
      left join coupons c on c.id = sp.coupon_id
     where (p_from is null or sp.created_at >= p_from)
       and (p_to is null or sp.created_at < p_to)
       and (p_type is null or sp.spin_type::text = p_type)
  ),
  disc as (
    -- Купоноор өгсөн хөнгөлөлт: цуцлагдаагүй захиалгын `discount`.
    select s.id as spin_id, coalesce(sum(o.discount), 0) as amount
      from s
      join coupon_redemptions r on r.coupon_id = s.coupon_id
      join orders o on o.id = r.order_id and o.status <> 'cancelled'
     where s.coupon_id is not null
     group by s.id
  ),
  g as (
    select s.kind, s.value, s.label,
           min(s.tier::text) as tier,
           count(*) as n,
           count(*) filter (where s.coupon_id is not null) as c_issued,
           count(*) filter (where s.c_used > 0) as c_used,
           count(*) filter (where s.coupon_id is not null and coalesce(s.c_used, 0) = 0
                              and (s.c_ends < now() or not s.c_active)) as c_expired,
           count(*) filter (where s.coupon_id is not null and coalesce(s.c_used, 0) = 0
                              and s.c_active and (s.c_ends is null or s.c_ends >= now())) as c_open,
           coalesce(sum(d.amount), 0) as c_discount,
           count(*) filter (where s.kind in ('bundle', 'product') and s.fulfilled_at is not null) as p_delivered,
           count(*) filter (where s.kind in ('bundle', 'product') and s.fulfilled_at is null
                              and s.claim_order_id is not null) as p_in_order,
           count(*) filter (where s.kind in ('bundle', 'product') and s.fulfilled_at is null
                              and s.claim_order_id is null and s.expires_at < now()) as p_expired,
           count(*) filter (where s.kind in ('bundle', 'product') and s.fulfilled_at is null
                              and s.claim_order_id is null
                              and (s.expires_at is null or s.expires_at >= now())) as p_waiting
      from s
      left join disc d on d.spin_id = s.id
     group by s.kind, s.value, s.label
  )
  select jsonb_build_object(
    'spins', (select count(*) from s),
    'freeSpins', (select count(*) from s where spin_type = 'free'),
    'orderSpins', (select count(*) from s where spin_type = 'order'),
    'paidSpins', (select count(*) from s where spin_type = 'paid'),
    'misses', (select count(*) from s where kind = 'none'),
    'pointsAwarded', (select coalesce(sum(value), 0) from s where kind = 'points'),
    'pointsSpent', (select coalesce(sum(points_spent), 0) from s),
    'orderSpinsGranted', (select coalesce(sum(spins), 0) from spin_wheel_credits
                           where revoked_at is null
                             and (p_from is null or created_at >= p_from)
                             and (p_to is null or created_at < p_to)),
    'prizes', (select coalesce(jsonb_agg(jsonb_build_object(
                 'kind', kind, 'value', value, 'label', label, 'tier', tier,
                 'count', n,
                 'couponsIssued', c_issued, 'couponsUsed', c_used,
                 'couponsExpired', c_expired, 'couponsOpen', c_open,
                 'discount', c_discount,
                 'physicalWaiting', p_waiting, 'physicalInOrder', p_in_order,
                 'physicalDelivered', p_delivered, 'physicalExpired', p_expired)
                 order by (kind = 'none'), n desc), '[]'::jsonb)
                 from g)
  ) into v_out;

  return v_out;
end $$;

revoke all on function spin_wheel_prize_report(timestamptz, timestamptz, text)
  from public, anon;
grant execute on function spin_wheel_prize_report(timestamptz, timestamptz, text)
  to authenticated, service_role;
