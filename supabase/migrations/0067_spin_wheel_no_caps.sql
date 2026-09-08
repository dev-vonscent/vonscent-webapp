-- Азын хүрд: сарын тагууд авагдав (клиент, 2026-09-07).
--
-- Клиентийн шийдвэр: «таг дүүрэх гэсэн ойлголт байхгүй — магадлал нь таарсан
-- бол хэдэн ч удаа хожиж болно.» Тиймээс хоёр **глобал** таг унтарлаа:
--
--   monthlyPointCap    5000 → 0   (0 = хязгааргүй)
--   rareCouponPerMonth    1 → 0   (0 = хязгааргүй)
--
-- Яагаад энэ нь зүгээр нэг тохиргооны өөрчлөлт биш вэ: тагт баригдсан салбар
-- `fallback_slot` руу шилждэг ба 0053-ын seed-д слот 1/4/5/8 бүгд слот 7 рүү
-- заасан. Хоёр таг дүүрмэгц хүрдний 77.8% нь 5,000₮ купон дээр буудаг байв
-- (пойнт 58.0 + 10,000₮ 6.0 + өөрийн 13.8). Бодит жишээ: нэг бүртгэл 2026-09-07-д
-- 5 удаа дараалан 5,000₮ хожсон — 0.778^5 = 28.5%, огт ховор биш. Таг байхгүй
-- болсноор ямар ч салбар хаагдахгүй тул шилжилт огт ажиллахаа болино.
--
-- `spin_wheel_prizes.monthly_cap` (нэг шагналын глобал сан) ба `fallback_slot`
-- механизм **хэвээр** — админы хэрэгсэл, одоо бүгд null. Зөвхөн хоёр глобал
-- таг унтарсан.
--
-- Функцийн өөрчлөлт: `rareCouponPerMonth = 0` нь урьд «үргэлж хаа» гэсэн утгатай
-- байсан (`v_rare_used >= 0` нь үргэлж үнэн). Пойнтын таг аль хэдийн
-- `v_point_cap > 0` гэж хамгаалагдсан байсныг ховор купонд мөн адил хийв — 0 нь
-- одоо «хязгааргүй» гэсэн утгатай, хоёулаа ижил дүрэмтэй боллоо.
--
-- ⚠️ Эдийн засгийн үр дагавар docs/lucky-wheel.md §5-д: сард 30 үнэгүй эргэлт
-- хийдэг хэрэглэгчийн өртөг 9,870₮ → 16,880₮ (захиалгын 12.3% → 21.1%) болно.
-- Тагууд бол зардлыг барьж байсан гол хэрэгсэл байсан.

update settings
   set value = value
             || jsonb_build_object('monthlyPointCap', 0)
             || jsonb_build_object('rareCouponPerMonth', 0)
 where key = 'spin'
   and (coalesce((value->>'monthlyPointCap')::int, 5000) <> 0
     or coalesce((value->>'rareCouponPerMonth')::int, 1) <> 0);

create or replace function spin_wheel(p_user uuid, p_paid boolean default false)
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
begin
  if p_user is null then
    return jsonb_build_object('ok', false, 'reason', 'AUTH');
  end if;

  select value into v_cfg from settings where key = 'spin';
  v_cfg := coalesce(v_cfg, '{}'::jsonb);
  if not coalesce((v_cfg->>'enabled')::boolean, true) then
    return jsonb_build_object('ok', false, 'reason', 'DISABLED');
  end if;
  v_hours := coalesce((v_cfg->>'freeSpinHours')::int, 24);
  v_cost := greatest(coalesce((v_cfg->>'spinCost')::int, 2000), 0);
  v_point_cap := coalesce((v_cfg->>'monthlyPointCap')::int, 5000);
  v_rare_cap := coalesce((v_cfg->>'rareCouponPerMonth')::int, 1);
  v_valid_days := coalesce((v_cfg->>'couponValidDays')::int, 30);
  v_single := coalesce((v_cfg->>'singleActiveCoupon')::boolean, true);

  -- Түгжээ: энэ хэрэглэгчийн эргэлтүүд цувааран орно. Үгүй бол хоёр таб
  -- зэрэг дарахад 24 цагийн шалгалтыг хоёулаа өнгөрч болно.
  select loyalty_points into v_points from profiles where id = p_user for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'AUTH');
  end if;

  if p_paid then
    if v_points < v_cost then
      return jsonb_build_object('ok', false, 'reason', 'NOT_ENOUGH_POINTS',
        'points', v_points, 'spinCost', v_cost);
    end if;
    v_spent := v_cost;
  else
    -- §1: цонх нь сүүлийн **үнэгүй** эргэлтээс тоологдоно. Пойнтоор эргүүлсэн
    -- нь үнэгүй эрхийг хойш түлхэхгүй — төлсөн хүнийг шийтгэх учиргүй.
    select max(created_at) into v_last from spin_wheel_spins
      where user_id = p_user and spin_type = 'free';
    if v_last is not null then
      v_next := v_last + make_interval(hours => v_hours);
      if v_next > now() then
        return jsonb_build_object('ok', false, 'reason', 'COOLDOWN', 'nextFreeAt', v_next);
      end if;
    end if;
  end if;

  -- Сарын тоолуурууд (§5 тагууд): пойнт ба ховор купон нь хэрэглэгч тус бүрээр,
  -- `monthly_cap` нь глобал сангаас.
  select coalesce(sum(value), 0) into v_used_points from spin_wheel_spins
    where user_id = p_user and kind = 'points' and created_at >= v_month;
  select count(*) into v_rare_used from spin_wheel_spins
    where user_id = p_user and tier = 'rare'
      and kind in ('coupon_percent', 'coupon_fixed') and created_at >= v_month;

  -- ── Жинтэй сугалаа ───────────────────────────────────────────────────
  select sum(weight) into v_total from spin_wheel_prizes where is_active and weight > 0;
  if coalesce(v_total, 0) <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'NO_PRIZES');
  end if;
  v_rand := random() * v_total;
  select w.id into v_id from (
    select id, slot,
           sum(weight) over (order by slot rows between unbounded preceding and current row) as cum
      from spin_wheel_prizes where is_active and weight > 0
  ) w where w.cum >= v_rand order by w.cum limit 1;
  select * into v_prize from spin_wheel_prizes where id = v_id;

  -- ── Тагууд ба шилжилт ────────────────────────────────────────────────
  --
  -- Хаагдсан салбар нь өөрийн `fallback_slot` руу шилжинэ. Заагч эцэст нь
  -- **бодитоор олгосон** салбар дээр зогсдог тул хэрэглэгч хожоогүй зүйлээ
  -- хараад эргэлзэхгүй. Гурван алхмаар хязгаарласан нь тохиргооны алдаа
  -- (хоёр салбар бие рүүгээ заасан) мөнхийн давталт болохоос сэргийлнэ.
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

  -- Шилжих газаргүй үлдвэл: тагт баригдаагүй хамгийн жинтэй салбарыг олгоно.
  -- Хүрд хэзээ ч хоосон эргэхгүй (§1: бүх салбар шагналтай).
  if v_blocked is not null then
    select * into v_prize from spin_wheel_prizes
      where is_active
        and monthly_cap is null
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
    -- §6: хүрдний пойнт §12.3-ын түгжээнд хамаарахгүй — шууд зарцуулагдана.
    update profiles set loyalty_points = loyalty_points + v_prize.value where id = p_user;
    insert into loyalty_ledger (user_id, delta, reason)
      values (p_user, v_prize.value, 'spin');
    v_points := v_points + v_prize.value;

  elsif v_prize.kind in ('coupon_percent', 'coupon_fixed') then
    -- Таг №1: ашиглагдаагүй хуучин хүрдний купоныг унтраана — захиалга бүрт
    -- хүрднээс дээд тал нь нэг купон.
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
  -- `bundle` нь бодит бараа: эргэлтийн мөр үлдэж, админ гараар хүргэнэ
  -- (`fulfilled_at`).

  insert into spin_wheel_spins
    (user_id, prize_id, slot, label, kind, tier, value, spin_type, points_spent, coupon_id)
  values (p_user, v_prize.id, v_prize.slot, v_prize.label, v_prize.kind, v_prize.tier,
          v_prize.value, case when p_paid then 'paid' else 'free' end::spin_type_t,
          v_spent, v_coupon_id);

  if p_paid then
    select max(created_at) into v_last from spin_wheel_spins
      where user_id = p_user and spin_type = 'free';
    v_next := case when v_last is null then null
                   else v_last + make_interval(hours => v_hours) end;
  else
    v_next := now() + make_interval(hours => v_hours);
  end if;

  return jsonb_build_object(
    'ok', true,
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
    'nextFreeAt', v_next,
    'freeReady', v_next is null or v_next <= now());
end $$;
