-- Азын хүрд (docs/lucky-wheel.md).
--
-- Хүрд бол мөнгө тарааж буй машин — тиймээс сугалаа бүхэлдээ **сервер тал
-- дээр**, нэг атомик RPC дотор явагдана. Клиент зөвхөн "хэддүгээр салбар дээр
-- зогсох" гэсэн хариу авна; жин (weight) хэзээ ч клиент рүү явахгүй.
--
-- Загварын гол шийдэл: `spin_wheel_entitlements` хүснэгт **үүсгэхгүй**.
-- Тодорхойлолт §6 гурав дахь хүснэгтийг санал болгосон боловч түүний бүх
-- талбар (сүүлийн үнэгүй эргэлт, өдөр/сарын тоолуур) нь `spin_wheel_spins`-
-- ээс бүрэн гаралтай. Хоёр эх сурвалж барих нь тэдгээрийг зөрүүлэх цорын ганц
-- арга — эргэлт бүр яг нэг мөр бичдэг тул тоолуурыг тэр мөрүүдээс шууд уншина.

do $$ begin
  create type spin_prize_kind_t as enum
    ('points', 'coupon_percent', 'coupon_fixed', 'bundle');
exception when duplicate_object then null; end $$;

do $$ begin
  create type spin_prize_tier_t as enum ('common', 'rare', 'grand');
exception when duplicate_object then null; end $$;

do $$ begin
  create type spin_type_t as enum ('free', 'paid');
exception when duplicate_object then null; end $$;

-- ── 1. Купоны хоёр дутуу багана ────────────────────────────────────────
--
-- `max_discount`: хувиар хөнгөлдөг купоны дээд хязгаар (таг №4). Доод
-- хязгааргүй 10% купон 500,000₮ захиалга дээр 50,000₮ иддэг — энэ таг бол
-- хүрдийг ашигтай байлгах нөхцөл, гоёл биш.
-- `source`: купоныг хэн олгосон бэ. Хүрдний "нэг идэвхтэй купон" дүрэм (таг
-- №1) яг үүгээр хайдаг тул `source_order_id`-аар таамаглах шаардлагагүй.
alter table coupons
  add column if not exists max_discount int
    check (max_discount is null or max_discount > 0),
  add column if not exists source text not null default 'manual';

create index if not exists coupons_source_user_idx
  on coupons (source, user_id) where is_active;

-- ── 2. Шагналууд ───────────────────────────────────────────────────────
--
-- Салбар бүр нэг мөр. `slot` бол хүрдэн дэх байрлал (12 цагийн зүүний дагуу
-- 1-ээс эхэлнэ) — тодорхойлолт §2-ын дараалал: хамгийн түгээмэл салбар
-- грандын хажууд суух ёстой ("бараг таарлаа" мэдрэмж).
create table if not exists spin_wheel_prizes (
  id            uuid primary key default gen_random_uuid(),
  slot          int not null unique check (slot between 1 and 12),
  label         text not null,
  -- Хүрдэн дээрх богино бичиглэл ('' бол `label`-ыг ашиглана).
  short_label   text not null default '',
  kind          spin_prize_kind_t not null,
  tier          spin_prize_tier_t not null default 'common',
  -- points → V; coupon_percent → %; coupon_fixed → ₮; bundle → ширхэг.
  value         int not null default 0 check (value >= 0),
  -- Купоны нөхцөл (бусад төрөлд хамаарахгүй).
  min_subtotal  int not null default 0 check (min_subtotal >= 0),
  max_discount  int check (max_discount is null or max_discount > 0),
  -- Сугалааны жин. Хувь биш — нийлбэрээс нь харьцангуйгаар боддог тул админ
  -- нэг салбарыг өөрчлөхөд бусдыг гараар тэнцүүлэх шаардлагагүй.
  weight        numeric(6,3) not null default 0 check (weight >= 0),
  -- Глобал сарын хязгаар (§5 таг №5). null = хязгааргүй.
  monthly_cap   int check (monthly_cap is null or monthly_cap >= 0),
  -- Хязгаарт хүрсэн эсвэл дүрмээр хаагдсан үед сугалаа хаашаа шилжих вэ.
  -- null бол шилжихгүй (тэр салбар зүгээр л гарахгүй).
  fallback_slot int check (fallback_slot is null or fallback_slot between 1 and 12),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ── 3. Эргэлтийн түүх ──────────────────────────────────────────────────
--
-- Шагналын талбарууд хуулбарлагдсан (snapshot): админ маргааш 5% купоныг 7%
-- болгоход өчигдрийн түүх өөрчлөгдөх ёсгүй.
create table if not exists spin_wheel_spins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  prize_id     uuid references spin_wheel_prizes(id) on delete set null,
  slot         int not null,
  label        text not null,
  kind         spin_prize_kind_t not null,
  tier         spin_prize_tier_t not null,
  value        int not null default 0,
  spin_type    spin_type_t not null,
  points_spent int not null default 0 check (points_spent >= 0),
  coupon_id    uuid references coupons(id) on delete set null,
  -- Зөвхөн бодит бараа (2мл багц) — админ хүргэсний дараа тэмдэглэнэ.
  fulfilled_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists spin_wheel_spins_user_idx
  on spin_wheel_spins (user_id, created_at desc);
create index if not exists spin_wheel_spins_month_idx
  on spin_wheel_spins (created_at desc);
-- «Хүлээгдэж буй гранд шагнал» — админы ажлын жагсаалт.
create index if not exists spin_wheel_spins_unfulfilled_idx
  on spin_wheel_spins (created_at) where kind = 'bundle' and fulfilled_at is null;

-- ── 4. RLS ─────────────────────────────────────────────────────────────
--
-- Шагналын жин бол дэлгүүрийн эдийн засаг: хэрэглэгч уншвал аль салбар
-- ховор болохыг мэдэх тул `spin_wheel_prizes`-ыг зөвхөн ажилтан уншина.
-- Хэрэглэгчид хүрдний нүүр `/api/lucky-wheel`-ээр жингүй хувилбарыг авна.
alter table spin_wheel_prizes enable row level security;
drop policy if exists "spin prizes staff" on spin_wheel_prizes;
create policy "spin prizes staff" on spin_wheel_prizes for all
  using (is_staff()) with check (is_staff());

alter table spin_wheel_spins enable row level security;
drop policy if exists "spin history owner read" on spin_wheel_spins;
create policy "spin history owner read" on spin_wheel_spins for select
  using (user_id = auth.uid() or is_staff());
-- Бичилт зөвхөн RPC (security definer) буюу service role-оор.
drop policy if exists "spin history staff write" on spin_wheel_spins;
create policy "spin history staff write" on spin_wheel_spins for all
  using (is_staff()) with check (is_staff());

-- ── 5. Тохиргоо ────────────────────────────────────────────────────────
insert into settings (key, value) values
  ('spin', jsonb_build_object(
     'enabled', true,
     -- §1: сүүлийн үнэгүй эргэлтээс хойш.
     'freeSpinHours', 24,
     -- §4: пойнтын үнэ. Өөр эргэлт авах арга байхгүй.
     'spinCost', 2000,
     -- §5 таг №2: хүрднээс сард авах пойнтын дээд хэмжээ.
     'monthlyPointCap', 5000,
     -- §5 таг №3: ховор купон (10% ба 10,000₮ хамтдаа) сард хэдэн удаа.
     'rareCouponPerMonth', 1,
     -- §1: бүх купон 1 сар хүчинтэй.
     'couponValidDays', 30,
     -- §5 таг №1: ашиглагдаагүй хүрдний купон нэг дор нэг л байна.
     'singleActiveCoupon', true))
on conflict (key) do nothing;

-- ── 6. Салбаруудын үндсэн утга (§2) ────────────────────────────────────
--
-- `on conflict do nothing` — админ жинг өөрчилсний дараа migration дахин
-- ажиллахад түүнийг дарж бичихгүй.
insert into spin_wheel_prizes
  (slot, label, short_label, kind, tier, value, min_subtotal, max_discount,
   weight, monthly_cap, fallback_slot)
values
  (1, '500 V point',       '500V',    'points',         'common', 500,     0, null,  33.8, null, 7),
  (2, '2мл таних багц',    '2мл багц','bundle',         'grand',    1,     0, null,   0.2,    3, 4),
  (3, '5% хөнгөлөлт',      '5%',      'coupon_percent', 'common',   5,     0, 10000, 21.0, null, null),
  (4, '10,000₮ хөнгөлөлт', '10,000₮', 'coupon_fixed',   'rare', 10000, 100000, null,  7.0, null, 7),
  (5, '1,000 V point',     '1,000V',  'points',         'common', 1000,    0, null,  16.0, null, 7),
  (6, '10% хөнгөлөлт',     '10%',     'coupon_percent', 'rare',    10,     0, 15000,  4.0, null, 3),
  (7, '5,000₮ хөнгөлөлт',  '5,000₮',  'coupon_fixed',   'common', 5000, 100000, null, 13.0, null, null),
  (8, '2,500 V point',     '2,500V',  'points',         'rare',   2500,    0, null,   5.0, null, 7)
on conflict (slot) do nothing;

-- ── 7. validate_coupon: хувийн купоны дээд хязгаар ─────────────────────
--
-- Хөнгөлөлт бодогддог цорын ганц газар энэ функц (place_order үүнийг дууддаг),
-- тул таг №4-ийг энд нэг удаа хийхэд захиалгын урсгал бүхэлдээ хамрагдана.
create or replace function validate_coupon(p_code text, p_subtotal int, p_user uuid default null)
returns jsonb language plpgsql stable as $$
declare
  c coupons%rowtype;
  v_discount int := 0;
  v_mine int;
begin
  if p_code is null or btrim(p_code) = '' then
    return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'EMPTY');
  end if;

  select * into c from coupons where upper(code) = upper(btrim(p_code)) limit 1;
  if not found then
    return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'NOT_FOUND');
  end if;
  if c.user_id is not null and c.user_id is distinct from p_user then
    return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'NOT_FOUND');
  end if;
  if not c.is_active then
    return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'INACTIVE');
  end if;
  if c.starts_at is not null and now() < c.starts_at then
    return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'NOT_STARTED');
  end if;
  if c.ends_at is not null and now() > c.ends_at then
    return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'EXPIRED');
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'MAX_USES');
  end if;
  if c.max_uses_per_user is not null then
    if p_user is null then
      return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'LOGIN_REQUIRED');
    end if;
    select count(*) into v_mine from coupon_redemptions
      where coupon_id = c.id and user_id = p_user;
    if v_mine >= c.max_uses_per_user then
      return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'MAX_USES_USER');
    end if;
  end if;
  if p_subtotal < c.min_subtotal then
    return jsonb_build_object('valid', false, 'discount', 0,
      'reason', 'MIN_SUBTOTAL', 'minSubtotal', c.min_subtotal);
  end if;

  if c.type = 'percent' then
    v_discount := floor(p_subtotal * c.value / 100.0);
    -- Таг №4: хувиар хөнгөлөх купоны таг.
    if c.max_discount is not null then
      v_discount := least(v_discount, c.max_discount);
    end if;
  else
    v_discount := least(c.value, p_subtotal);
  end if;

  return jsonb_build_object('valid', true, 'discount', v_discount,
    'code', c.code, 'type', c.type, 'value', c.value,
    'maxDiscount', c.max_discount);
end $$;

-- ── 8. Туслах: сарын эхлэл (UB цагаар) ─────────────────────────────────
create or replace function spin_month_start()
returns timestamptz language sql stable as $$
  select date_trunc('month', now() at time zone 'Asia/Ulaanbaatar')
           at time zone 'Asia/Ulaanbaatar';
$$;

-- ── 9. Хүрдний төлөв (уншилт) ──────────────────────────────────────────
--
-- Хуудсыг зурахад хэрэгтэй бүхнийг нэг дуудлагаар: жин ба магадлалгүй.
create or replace function spin_wheel_state(p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_cfg jsonb;
  v_hours int;
  v_cost int;
  v_last timestamptz;
  v_next timestamptz;
  v_points int := 0;
  v_prizes jsonb;
begin
  select value into v_cfg from settings where key = 'spin';
  v_cfg := coalesce(v_cfg, '{}'::jsonb);
  v_hours := coalesce((v_cfg->>'freeSpinHours')::int, 24);
  v_cost := coalesce((v_cfg->>'spinCost')::int, 2000);

  -- Дараалал нь тоогоор — `p->>'slot'` бол текст тул 12 салбартай үед '10'
  -- нь '2'-ын өмнө орох байсан.
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
  end if;

  return jsonb_build_object(
    'enabled', coalesce((v_cfg->>'enabled')::boolean, true),
    'prizes', v_prizes,
    'spinCost', v_cost,
    'freeSpinHours', v_hours,
    'points', coalesce(v_points, 0),
    'nextFreeAt', v_next,
    'freeReady', v_next is null or v_next <= now(),
    'signedIn', p_user is not null);
end $$;

-- ── 10. Сугалаа ────────────────────────────────────────────────────────
--
-- Нэг эргэлт = нэг транзакц. Хэрэглэгчийн profiles мөрийг эхэнд түгжиж
-- (`for update`) хоёр таб зэрэг эргүүлэх боломжийг хаана — үгүй бол 24 цагийн
-- шалгалт хоёр удаа зэрэг өнгөрч болно.
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
       and v_rare_used >= v_rare_cap then
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
                 and v_rare_used >= v_rare_cap)
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

-- Хоёулаа security definer тул нээлттэй үлдээвэл дурын хүн `p_user`-ыг
-- солиод өөр хүний нэрээр эргүүлж чадна. Зөвхөн service role (route handler)
-- дуудна — эрхийг тэнд, нэвтэрсэн хэрэглэгчийн ID-гаар шалгана.
revoke all on function spin_wheel(uuid, boolean) from public;
revoke all on function spin_wheel_state(uuid) from public;
do $$ begin
  grant execute on function spin_wheel(uuid, boolean) to service_role;
  grant execute on function spin_wheel_state(uuid) to service_role;
exception when undefined_object then null; end $$;

-- ── 11. Админы тайлан ──────────────────────────────────────────────────
--
-- Хүрдний эдийн засгийг хэмжих ганц дуудлага: олгосон vs ашигласан (§6).
-- `pending` нь цонхонд баригдахгүй — хүргэгдээгүй бодит шагнал хугацаа
-- өнгөрснөөс болж админы ажлын жагсаалтаас алга болох ёсгүй.
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
