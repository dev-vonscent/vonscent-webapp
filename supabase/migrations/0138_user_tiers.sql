-- Хэрэглэгчийн түвшин (feature flag `user_tiers`, анхдагч `false`).
--
-- Нийт худалдан авалтаар 5 түвшин, түвшин бүр өөр V point хувьтай:
--   Standard  0 – 1 сая₮    1%
--   Gold      1 – 3 сая₮    2%
--   Platinum  3 – 5 сая₮    3%
--   Sapphire  5 – 10 сая₮   4%
--   Ruby      10 сая₮ +     5%
--
-- Түвшин ХАДГАЛАГДАХГҮЙ — `orders`-оос тухай бүр бодогдоно, тиймээс туг
-- хаалттай үед ямар ч өгөгдөл хуримтлагдахгүй (0130-ийн сургамж). «Нийт
-- дүн» = төлөгдсөн (`paid`), цуцлагдаагүй захиалгын купоны дараах барааны
-- дүн, хүргэлтгүй — V point-ийн суурьтай ижил. Буцаалт (`refunded`) хасагдана.
--
-- Expand only: шинэ функцууд + `mark_order_paid` (0093-ын бие) дотор туг
-- асаалттай үед л түвшний хувь. Хаалттай үед хуучин `settings.loyalty`
-- (earnPer/earnPoints) дүрэм хэвээр.

insert into feature_flags (key) values ('user_tiers') on conflict do nothing;

-- ── 1. Түвшний хувь ────────────────────────────────────────────────────
-- ⚠ `USER_TIERS` (src/lib/constants.ts)-тэй таарах ёстой.
create or replace function tier_rate_for_spend(p_spend bigint)
returns int
language sql
immutable
parallel safe
as $$
  select case
    when p_spend >= 10000000 then 5
    when p_spend >= 5000000  then 4
    when p_spend >= 3000000  then 3
    when p_spend >= 1000000  then 2
    else 1
  end;
$$;

-- ── 2. Нийт худалдан авалт ─────────────────────────────────────────────
create or replace function user_lifetime_spend(p_user uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(greatest(subtotal - coalesce(discount, 0), 0)), 0)::bigint
    from orders
   where user_id = p_user
     and payment_status = 'paid'
     and status <> 'cancelled';
$$;

revoke all on function user_lifetime_spend(uuid) from public, anon, authenticated;
grant execute on function user_lifetime_spend(uuid) to service_role;

-- ── 3. Топ жагсаалт ────────────────────────────────────────────────────
-- [p_from, p_to) хугацаанд хамгийн их худалдан авалт хийсэн хэрэглэгчид +
-- дуудсан хэрэглэгчийн өөрийн байр (топод ороогүй ч). Ажилтнууд (туршилтын
-- захиалга) ороогүй. Тэнцвэл тэр дүнд ЭРТ хүрсэн нь дээр.
-- Хугацааг захиалга үүссэн огноогоор (`orders`-д төлсөн огноо байхгүй).
-- Нэр, зураг, хугацааны дүнтэй (`period_spend`).
create or replace function tier_leaderboard(
  p_from timestamptz,
  p_to timestamptz,
  p_user uuid default null,
  p_limit int default 3
)
returns table (
  rank int,
  user_id uuid,
  full_name text,
  avatar_url text,
  period_spend bigint,
  lifetime_spend bigint,
  is_me boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with spend as (
    select o.user_id,
           sum(greatest(o.subtotal - coalesce(o.discount, 0), 0))::bigint as total,
           max(o.created_at) as last_at
      from orders o
      join profiles p on p.id = o.user_id and p.role = 'customer'
     where o.payment_status = 'paid'
       and o.status <> 'cancelled'
       and o.created_at >= p_from
       and o.created_at < p_to
     group by o.user_id
  ), ranked as (
    select s.*, row_number() over (order by s.total desc, s.last_at asc) as rn
      from spend s
     where s.total > 0
  )
  select r.rn::int, r.user_id, p.full_name, p.avatar_url, r.total,
         user_lifetime_spend(r.user_id), r.user_id = p_user
    from ranked r
    join profiles p on p.id = r.user_id
   where r.rn <= p_limit or r.user_id = p_user
   order by r.rn;
$$;

revoke all on function tier_leaderboard(timestamptz, timestamptz, uuid, int)
  from public, anon, authenticated;
grant execute on function tier_leaderboard(timestamptz, timestamptz, uuid, int)
  to service_role;

-- ── 4. mark_order_paid: 0093-ын бие + түвшний хувь ─────────────────────
-- Өөрчлөлт нь зөвхөн оноо бодох хэсэгт: туг асаалттай бол
-- `floor(суурь × түвшний хувь / 100)`, эс бөгөөс 0093-тай яг ижил.
create or replace function mark_order_paid(
  p_order uuid,
  p_by uuid default null,
  -- 'qpay'   — QPay-ээс `payment/check`-ээр батлагдсан (автомат зам)
  -- 'manual' — ажилтан гараар тэмдэглэсэн (шилжүүлэг, дэмжлэгийн шийдвэр)
  -- 'mock'   — mock орчны симуляц
  p_source text default 'qpay'
)
returns void language plpgsql as $$
declare
  v_item record;
  v_user uuid;
  v_status payment_status_t;
  v_order_status order_status_t;
  v_subtotal int;
  v_discount int;
  v_base int;
  v_earn_per int;
  v_earn_points int;
  v_lock_hours numeric;
  v_earned int;
  v_rate int;
  v_now_ub timestamp;
  v_min_day date;
  v_deliver_old date;
  v_deliver_new date;
  v_available timestamptz;
  v_note text;
begin
  -- `for update`: webhook, poller болон админ гурвуулаа энэ функцийг зэрэг
  -- дуудаж болно. Түгжээгүй бол гурвуулаа доорх idempotent шалгалтыг давж,
  -- `commit_inventory` ба оноо давхар бичигдэнэ.
  select user_id, payment_status, status, subtotal, discount, deliver_on
    into v_user, v_status, v_order_status, v_subtotal, v_discount, v_deliver_old
    from orders where id = p_order for update;
  if v_status = 'paid' then
    return;  -- idempotent
  end if;
  -- Цуцлагдсан захиалгын мл, оноо, купон аль хэдийн буцсан. Төлбөрийг нь
  -- энд бүртгэвэл захиалга 'confirmed' болж сэргээд, буцаасан мл дахин
  -- commit хийгдэнэ.
  if v_order_status = 'cancelled' then
    raise exception 'ORDER_CANCELLED' using errcode = 'check_violation';
  end if;

  -- Цуцлах/өөрчлөх цонх 00:00-д хаагддаг болсон (src/lib/time.ts,
  -- ORDER_EDIT_CUTOFF_HOUR = 0) тул өнөөдрийн бэлтгэл шөнө дундаас эхэлнэ:
  -- одоо төлсөн захиалгыг өнөөдөр хүргэх завсар үлдэхгүй, хамгийн эрт нь
  -- үргэлж маргааш.
  v_now_ub := now() at time zone 'Asia/Ulaanbaatar';
  v_min_day := v_now_ub::date + 1;
  v_deliver_new := greatest(coalesce(v_deliver_old, v_min_day), v_min_day);

  update orders set payment_status = 'paid', status = 'confirmed',
    deliver_on = v_deliver_new,
    reserve_expires_at = null where id = p_order;

  for v_item in select product_id, ml, qty from order_items where order_id = p_order loop
    if v_item.product_id is not null then
      perform commit_inventory(v_item.product_id, v_item.ml * v_item.qty);
    end if;
  end loop;

  -- Эх сурвалж нь тэмдэглэлд ил гарна: «Төлбөр төлөгдсөн» ганцаараа
  -- автоматыг гараас ялгахгүй.
  v_note := case p_source
    when 'manual' then 'Төлбөр төлөгдсөн (гараар тэмдэглэсэн)'
    when 'mock'   then 'Төлбөр төлөгдсөн (mock)'
    else 'Төлбөр төлөгдсөн (QPay)'
  end;
  insert into order_status_history (order_id, status, note, changed_by)
    values (p_order, 'confirmed', v_note, p_by);

  if v_deliver_old is not null and v_deliver_new <> v_deliver_old then
    insert into order_status_history (order_id, status, note)
      values (p_order, 'confirmed',
        'Хүргэх өдөр ' || to_char(v_deliver_old, 'MM/DD') || ' → ' ||
        to_char(v_deliver_new, 'MM/DD') || ' болж шилжлээ (төлбөр ' ||
        to_char(v_now_ub, 'MM/DD HH24:MI') || '-д төлөгдсөн)');
  end if;

  if v_user is not null then
    select coalesce((value->>'earnPer')::int, 100),
           coalesce((value->>'earnPoints')::int, 1),
           coalesce((value->>'lockHours')::numeric, 24)
      into v_earn_per, v_earn_points, v_lock_hours
      from settings where key = 'loyalty';
    v_earn_per := coalesce(v_earn_per, 100);
    v_earn_points := coalesce(v_earn_points, 1);
    v_lock_hours := greatest(coalesce(v_lock_hours, 24), 0);
    -- Points are earned on the post-coupon product subtotal, never shipping.
    v_base := greatest(coalesce(v_subtotal,0) - coalesce(v_discount,0), 0);
    if feature_enabled('user_tiers') then
      -- Түвшний хувь (0138). Захиалга дээр аль хэдийн 'paid' болсон тул
      -- нийт дүнгээс өөрийг нь хасаж «энэ захиалгын ӨМНӨХ» түвшнээр бодно:
      -- түвшин ахиулсан захиалга шинэ хувиа дараагийн захиалгаас авна.
      v_rate := tier_rate_for_spend(
        greatest(user_lifetime_spend(v_user) - v_base, 0));
      v_earned := floor(v_base::bigint * v_rate / 100);
    elsif v_earn_per > 0 then
      v_earned := floor(v_base / v_earn_per) * v_earn_points;
    else
      v_earned := 0;
    end if;
    if v_earned > 0 then
      -- Хүргэх өдрийн 00:00 (UB) + lockHours. `at time zone` нь орон нутгийн
      -- цагийг timestamptz болгоно — сервер UTC дээр ажилладаг тул шууд
      -- нэмбэл 8 цагаар зөрнө.
      -- `v_deliver_new` хэзээ ч null биш (дээрх `greatest`) — хуучин
      -- өдөргүй захиалга ч энд хамгийн эрт хүргэх өдрөө авсан байна.
      v_available := (v_deliver_new::timestamp
                       + (v_lock_hours || ' hours')::interval)
                     at time zone 'Asia/Ulaanbaatar';
      update profiles set pending_points = pending_points + v_earned
        where id = v_user;
      insert into loyalty_ledger
        (user_id, order_id, delta, reason, available_at, released)
        values (v_user, p_order, v_earned, 'earn', v_available, false);
      -- Хугацаа нь аль хэдийн өнгөрсөн бол (lockHours = 0, эсвэл өнөөдөр
      -- хүргэгдэх захиалгыг өдөр дунд төлсөн) cron-ы дараагийн цохилтыг
      -- хүлгэхгүй — шууд нээнэ.
      if v_available <= now() then
        perform release_order_points(p_order);
      end if;
    end if;
  end if;
end $$;

-- ⚠ `create or replace` нь эрхийг АНХДАГЧ руу нь буцаадаг: 0088-ийн түгжээг
-- энд ДАХИН тавихгүй бол PostgREST дээр нээлттэй үлдэнэ.
revoke all on function mark_order_paid(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function mark_order_paid(uuid, uuid, text) to service_role;
