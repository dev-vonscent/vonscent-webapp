-- Азын хүрд v2 — ашиглалтад оруулах шаардлага (docs/lucky-wheel.md §9).
--
--   * 26 нүд: 13 шагнал ба 13 «Баярлалаа» ээлжилнэ, ижил шагнал тарсан.
--   * Эрх гурван замаар: 24 цагт нэг үнэгүй · 100,000₮ захиалга тутамд нэг ·
--     1,000V-оор нэг.
--   * Купон бүр 1 сар; тогтмол дүнтэй нь ≥100,000₮ захиалгад.
--
-- Шинэ enum утгууд (`none`, `order`) 0128-д нэмэгдсэн.

-- ── 1. Нүдний дугаарын хязгаар 12 → 40 ─────────────────────────────────
alter table spin_wheel_prizes drop constraint if exists spin_wheel_prizes_slot_check;
alter table spin_wheel_prizes
  add constraint spin_wheel_prizes_slot_check check (slot between 1 and 40);
alter table spin_wheel_prizes drop constraint if exists spin_wheel_prizes_fallback_slot_check;
alter table spin_wheel_prizes
  add constraint spin_wheel_prizes_fallback_slot_check
  check (fallback_slot is null or fallback_slot between 1 and 40);

-- ── 2. 26 нүд ──────────────────────────────────────────────────────────
--
-- Сондгой нүд = шагнал, тэгш нүд = «Баярлалаа» → шагнал бүрийн голд
-- «Баярлалаа». Шагналын дараалал ижил шагналуудыг хүрдээр тараана:
-- 5,000₮ нь 3·11·19, 10,000₮ нь 7·15·23 дээр (8 нүдний зайтай).
--
-- Жин нь хувиар (нийлбэр 100). Олон нүдтэй шагналын жин нүд тус бүрт:
-- 5,000₮ 3 × 1.8 = 5.4, 10,000₮ 3 × 0.9 = 2.7, «Баярлалаа» 13 × 6 = 78.
--
-- Зөвхөн нэг удаа: «Баярлалаа» мөр аль хэдийн байвал (дахин ажиллуулах,
-- эсвэл админ v2 дээр засвар хийсэн) хөндөхгүй. Хуучин 8 мөрийн түүх
-- `spin_wheel_spins`-д snapshot-оор үлдэнэ (`prize_id` → null).
do $$ begin
  if not exists (select 1 from spin_wheel_prizes where kind = 'none') then
    delete from spin_wheel_prizes;
    insert into spin_wheel_prizes
      (slot, label, short_label, kind, tier, value, min_subtotal, max_discount,
       weight, monthly_cap, fallback_slot)
    values
      ( 1, '2мл таних багц',    '2мл багц', 'bundle',         'grand',     1,      0, null, 0.1, null, null),
      ( 2, 'Баярлалаа',         '',         'none',           'common',    0,      0, null, 6.0, null, null),
      ( 3, '5,000₮ хөнгөлөлт',  '5,000₮',   'coupon_fixed',   'common', 5000, 100000, null, 1.8, null, null),
      ( 4, 'Баярлалаа',         '',         'none',           'common',    0,      0, null, 6.0, null, null),
      ( 5, '1,000 V point',     '1,000V',   'points',         'common', 1000,      0, null, 6.0, null, null),
      ( 6, 'Баярлалаа',         '',         'none',           'common',    0,      0, null, 6.0, null, null),
      ( 7, '10,000₮ хөнгөлөлт', '10,000₮',  'coupon_fixed',   'rare',  10000, 100000, null, 0.9, null, null),
      ( 8, 'Баярлалаа',         '',         'none',           'common',    0,      0, null, 6.0, null, null),
      ( 9, '5% хөнгөлөлт',      '5%',       'coupon_percent', 'common',    5,      0, null, 1.6, null, null),
      (10, 'Баярлалаа',         '',         'none',           'common',    0,      0, null, 6.0, null, null),
      (11, '5,000₮ хөнгөлөлт',  '5,000₮',   'coupon_fixed',   'common', 5000, 100000, null, 1.8, null, null),
      (12, 'Баярлалаа',         '',         'none',           'common',    0,      0, null, 6.0, null, null),
      (13, '3,000 V point',     '3,000V',   'points',         'common', 3000,      0, null, 3.0, null, null),
      (14, 'Баярлалаа',         '',         'none',           'common',    0,      0, null, 6.0, null, null),
      (15, '10,000₮ хөнгөлөлт', '10,000₮',  'coupon_fixed',   'rare',  10000, 100000, null, 0.9, null, null),
      (16, 'Баярлалаа',         '',         'none',           'common',    0,      0, null, 6.0, null, null),
      (17, '10% хөнгөлөлт',     '10%',      'coupon_percent', 'rare',     10,      0, null, 0.8, null, null),
      (18, 'Баярлалаа',         '',         'none',           'common',    0,      0, null, 6.0, null, null),
      (19, '5,000₮ хөнгөлөлт',  '5,000₮',   'coupon_fixed',   'common', 5000, 100000, null, 1.8, null, null),
      (20, 'Баярлалаа',         '',         'none',           'common',    0,      0, null, 6.0, null, null),
      (21, '5,000 V point',     '5,000V',   'points',         'rare',   5000,      0, null, 1.6, null, null),
      (22, 'Баярлалаа',         '',         'none',           'common',    0,      0, null, 6.0, null, null),
      (23, '10,000₮ хөнгөлөлт', '10,000₮',  'coupon_fixed',   'rare',  10000, 100000, null, 0.9, null, null),
      (24, 'Баярлалаа',         '',         'none',           'common',    0,      0, null, 6.0, null, null),
      (25, '10,000 V point',    '10,000V',  'points',         'rare',  10000,      0, null, 0.8, null, null),
      (26, 'Баярлалаа',         '',         'none',           'common',    0,      0, null, 6.0, null, null);
  end if;
end $$;

-- ── 3. Тохиргоо ────────────────────────────────────────────────────────
--
-- `orderSpinStep`: захиалгын суурь дүнгийн хэдэн ₮ тутамд нэг эрх (0 = унтраах).
-- Байхгүй үед л бичнэ — админ дараа нь өөрчилсөн бол дахин ажиллахад дарахгүй.
update settings
   set value = value || jsonb_build_object(
         'spinCost', 1000,
         'freeSpinHours', 24,
         'orderSpinStep', 100000,
         'couponValidDays', 30,
         'singleActiveCoupon', false,
         'monthlyPointCap', 0,
         'rareCouponPerMonth', 0)
 where key = 'spin' and not (value ? 'orderSpinStep');

-- ── 4. Захиалгаас олсон эрх ────────────────────────────────────────────
--
-- Захиалга бүр нэг мөр (`order_id` PK → төлбөр давхар баталгаажсан ч нэг л
-- удаа). Эргэлт бүр аль захиалгын эрхийг зарцуулсныг `credit_order_id`-д
-- бичдэг тул цуцлалт нь зөвхөн тэр захиалгын **үлдсэн** эрхийг хүчингүй
-- болгоно — ашигласан эргэлтийг бусад захиалгын эрхээс нөхөж авахгүй
-- (оноо буцаалт тэгээс доош орохгүйтэй ижил зарчим).
create table if not exists spin_wheel_credits (
  order_id   uuid primary key references orders(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  spins      int not null check (spins > 0),
  -- Эрх бодсон суурь дүн (барааны дүн − купон) — тайлан, маргаанд.
  base       int not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists spin_wheel_credits_user_idx
  on spin_wheel_credits (user_id, created_at) where revoked_at is null;

alter table spin_wheel_credits enable row level security;
drop policy if exists "spin credits owner read" on spin_wheel_credits;
create policy "spin credits owner read" on spin_wheel_credits for select
  using (user_id = auth.uid() or is_staff());
drop policy if exists "spin credits staff write" on spin_wheel_credits;
create policy "spin credits staff write" on spin_wheel_credits for all
  using (is_staff()) with check (is_staff());

alter table spin_wheel_spins
  add column if not exists credit_order_id uuid references orders(id) on delete set null;
create index if not exists spin_wheel_spins_credit_idx
  on spin_wheel_spins (credit_order_id) where credit_order_id is not null;

-- Суурь дүн нь урамшууллын купонтой ижил (0041/0118): барааны дүн − купоны
-- хямдрал; хүргэлт, оноо ороогүй. 250,000₮ → 2 эрх.
create or replace function grant_order_spins(p_order uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_base int;
  v_step int;
  v_spins int;
begin
  select user_id, greatest(coalesce(subtotal, 0) - coalesce(discount, 0), 0)
    into v_user, v_base from orders where id = p_order;
  if v_user is null then return 0; end if;   -- зочин хүрд эргүүлэхгүй

  select coalesce((value->>'orderSpinStep')::int, 100000) into v_step
    from settings where key = 'spin';
  v_step := coalesce(v_step, 100000);
  if v_step <= 0 then return 0; end if;

  v_spins := v_base / v_step;
  if v_spins <= 0 then return 0; end if;

  insert into spin_wheel_credits (order_id, user_id, spins, base)
    values (p_order, v_user, v_spins, v_base)
    on conflict (order_id) do nothing;
  return v_spins;
end $$;

create or replace function revoke_order_spins(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update spin_wheel_credits set revoked_at = now()
   where order_id = p_order and revoked_at is null;
end $$;

-- Захиалгын ашиглаагүй эрх: идэвхтэй мөрүүдийн (олгосон − зарцуулсан) нийлбэр.
create or replace function spin_order_balance(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(greatest(c.spins - coalesce(u.n, 0), 0)), 0)::int
    from spin_wheel_credits c
    left join (
      select credit_order_id, count(*) as n from spin_wheel_spins
       where user_id = p_user and credit_order_id is not null
       group by credit_order_id
    ) u on u.credit_order_id = c.order_id
   where c.user_id = p_user and c.revoked_at is null;
$$;

-- Урамшууллын купоны trigger-тэй (0025) ижил хэлбэр: mark_order_paid-ийн
-- хуулбарыг дахин бичихгүйн тулд orders хүснэгтэд өлгөв.
create or replace function orders_grant_spins()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform grant_order_spins(new.id);
  return new;
end $$;

drop trigger if exists orders_spin_credits on orders;
create trigger orders_spin_credits
  after update of payment_status on orders
  for each row
  when (new.payment_status = 'paid' and old.payment_status is distinct from 'paid')
  execute function orders_grant_spins();

-- Цуцлалт ба буцаалт (хүргэгдсэний дараах ч) — урамшууллын купонтой ижил
-- хоёр мөч (0113).
create or replace function orders_revoke_spins()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform revoke_order_spins(new.id);
  return new;
end $$;

drop trigger if exists orders_spin_credits_revoke on orders;
create trigger orders_spin_credits_revoke
  after update of status, payment_status on orders
  for each row
  when ((new.status = 'cancelled' and old.status is distinct from 'cancelled')
     or (new.payment_status = 'refunded' and old.payment_status is distinct from 'refunded'))
  execute function orders_revoke_spins();

revoke all on function grant_order_spins(uuid) from public;
revoke all on function revoke_order_spins(uuid) from public;
revoke all on function spin_order_balance(uuid) from public;
do $$ begin
  grant execute on function spin_order_balance(uuid) to service_role;
exception when undefined_object then null; end $$;

-- ── 5. Хүрдний төлөв ───────────────────────────────────────────────────
create or replace function spin_wheel_state(p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_cfg jsonb;
  v_hours int;
  v_cost int;
  v_last timestamptz;
  v_next timestamptz;
  v_points int := 0;
  v_order_spins int := 0;
  v_prizes jsonb;
begin
  select value into v_cfg from settings where key = 'spin';
  v_cfg := coalesce(v_cfg, '{}'::jsonb);
  v_hours := coalesce((v_cfg->>'freeSpinHours')::int, 24);
  v_cost := coalesce((v_cfg->>'spinCost')::int, 1000);

  select coalesce(jsonb_agg(p order by s), '[]'::jsonb) into v_prizes
    from (
      select slot as s, jsonb_build_object(
               'slot', slot,
               'label', label,
               'shortLabel', case when short_label = '' then label else short_label end,
               'kind', kind,
               'tier', tier,
               'value', value,
               'minSubtotal', min_subtotal,
               'maxDiscount', max_discount) as p
      from spin_wheel_prizes where is_active
    ) t;

  if p_user is not null then
    select loyalty_points into v_points from profiles where id = p_user;
    select max(created_at) into v_last from spin_wheel_spins
      where user_id = p_user and spin_type = 'free';
    if v_last is not null then
      v_next := v_last + make_interval(hours => v_hours);
    end if;
    v_order_spins := spin_order_balance(p_user);
  end if;

  return jsonb_build_object(
    'enabled', coalesce((v_cfg->>'enabled')::boolean, true),
    'prizes', v_prizes,
    'spinCost', v_cost,
    'freeSpinHours', v_hours,
    'orderSpinStep', coalesce((v_cfg->>'orderSpinStep')::int, 100000),
    'orderSpins', v_order_spins,
    'points', coalesce(v_points, 0),
    'nextFreeAt', v_next,
    'freeReady', v_next is null or v_next <= now(),
    'signedIn', p_user is not null);
end $$;

-- ── 6. Сугалаа ─────────────────────────────────────────────────────────
--
-- `p_paid boolean` → `p_mode text` ('free' | 'order' | 'points'). Хуучин
-- хувилбарыг устгана: хоёулаа үлдвэл `spin_wheel(uuid)` гэсэн дуудлага
-- хоёрдмол болно.
drop function if exists spin_wheel(uuid, boolean);

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

  -- Түгжээ: энэ хэрэглэгчийн эргэлтүүд цувааран орно — хоёр таб зэрэг дарахад
  -- 24 цагийн шалгалт ба захиалгын эрх хоёулаа давхар зарцуулагдахгүй.
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
    -- Хамгийн эртний, үлдэгдэлтэй идэвхтэй эрх.
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
    -- Цонх нь сүүлийн **үнэгүй** эргэлтээс тоологдоно — бусад эрхээр
    -- эргүүлсэн нь үнэгүй эрхийг хойш түлхэхгүй.
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

  -- ── Тагууд ба шилжилт (0053b) — v2-д бүгд унтраалттай, механизм хэвээр ──
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
  -- `bundle`: админ гараар хүргэнэ (`fulfilled_at`). `none`: олгох юм алга.

  insert into spin_wheel_spins
    (user_id, prize_id, slot, label, kind, tier, value, spin_type, points_spent,
     coupon_id, credit_order_id)
  values (p_user, v_prize.id, v_prize.slot, v_prize.label, v_prize.kind, v_prize.tier,
          v_prize.value, v_type, v_spent, v_coupon_id, v_credit);

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

revoke all on function spin_wheel(uuid, text) from public;
revoke all on function spin_wheel_state(uuid) from public;
do $$ begin
  grant execute on function spin_wheel(uuid, text) to service_role;
  grant execute on function spin_wheel_state(uuid) to service_role;
exception when undefined_object then null; end $$;

-- ── 7. Админы тайлан: захиалгын эрх нэмэгдэв ───────────────────────────
create or replace function spin_wheel_report(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_from timestamptz := now() - make_interval(days => greatest(p_days, 1));
  v_out jsonb;
begin
  if not is_staff() then
    return jsonb_build_object('error', 'FORBIDDEN');
  end if;

  with s as (
    select * from spin_wheel_spins where created_at >= v_from
  )
  select jsonb_build_object(
    'days', greatest(p_days, 1),
    'spins', (select count(*) from s),
    'freeSpins', (select count(*) from s where spin_type = 'free'),
    'paidSpins', (select count(*) from s where spin_type = 'paid'),
    'orderSpins', (select count(*) from s where spin_type = 'order'),
    'orderSpinsGranted', (select coalesce(sum(spins), 0) from spin_wheel_credits
                           where created_at >= v_from and revoked_at is null),
    'thanks', (select count(*) from s where kind = 'none'),
    'pointsAwarded', (select coalesce(sum(value), 0) from s where kind = 'points'),
    'pointsSpent', (select coalesce(sum(points_spent), 0) from s),
    'couponsIssued', (select count(*) from s where coupon_id is not null),
    'couponsUsed', (select count(*) from s
                      join coupons c on c.id = s.coupon_id where c.used_count > 0),
    'bySlot', (select coalesce(jsonb_agg(
                 jsonb_build_object('slot', slot, 'label', label, 'count', n)
                 order by slot), '[]'::jsonb)
                 from (select slot, min(label) as label, count(*) as n
                         from s group by slot) x),
    'pending', (select coalesce(jsonb_agg(
                 jsonb_build_object('id', sp.id, 'label', sp.label,
                   'createdAt', sp.created_at,
                   'customer', coalesce(nullif(p.full_name, ''), 'Нэргүй'),
                   'phone', p.phone) order by sp.created_at), '[]'::jsonb)
                 from spin_wheel_spins sp
                 left join profiles p on p.id = sp.user_id
                where sp.kind = 'bundle' and sp.fulfilled_at is null)
  ) into v_out;

  return v_out;
end $$;
