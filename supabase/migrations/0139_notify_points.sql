-- «V оноо нээгдлээ» мэдэгдэл (docs/planning/notifications-plan.md §4.1).
--
-- Оноо ГУРВАН замаар нээгддэг: `release_due_points` (cron, 15 мин),
-- `mark_order_paid` (`available_at` өнгөрсөн бол шууд, 0093),
-- `update_order_status` → `delivered`. Гурвуулаа `release_order_points`-оор
-- дамждаг тул мэдэгдлийг тэр НЭГ helper дотор үүсгэнэ.
--
-- Бизнес үйлдэл (оноо нээх) үргэлж хийгдэнэ; мэдэгдлийн insert нь
-- `notify_user` дотор `notifications` тугаар хаагдана (0138).
--
-- Функцуудын бие нь dev сангийн одоогийн хувилбар (0024) — зөвхөн тэмдэглэсэн
-- мөрүүд нэмэгдсэн.

-- Нэг захиалгын нээгдээгүй earn мөрүүдийг нээгээд нийт дүнг буцаана.
-- Ledger мөрүүд `for update` түгжигддэг тул зэрэг ажилласан хоёр дахь дуудлага
-- 0 буцааж мэдэгдэл үүсгэхгүй; `points:order:<id>` dedupe нь нэмэлт хамгаалалт.
create or replace function release_order_points(p_order uuid)
returns int language plpgsql as $$
declare
  v_row record;
  v_total int := 0;
  v_user uuid;            -- 0139
  v_order_no text;        -- 0139
begin
  for v_row in
    select id, user_id, delta from loyalty_ledger
    where order_id = p_order and reason = 'earn' and not released
    for update
  loop
    update profiles
      set pending_points = greatest(pending_points - v_row.delta, 0),
          loyalty_points = loyalty_points + v_row.delta
      where id = v_row.user_id;
    update loyalty_ledger set released = true where id = v_row.id;
    v_total := v_total + v_row.delta;
    v_user := v_row.user_id;  -- 0139
  end loop;

  -- 0139: мэдэгдэл
  if v_total > 0 and v_user is not null then
    select order_no into v_order_no from orders where id = p_order;
    perform notify_user(
      v_user,
      'points_released',
      coalesce(v_order_no || ' захиалгын ', '') ||
        to_char(v_total, 'FM999,999,999') || ' V оноо ашиглах боломжтой боллоо',
      null,
      '/account/loyalty',
      jsonb_build_object('points', v_total, 'orderId', p_order),
      'points:order:' || p_order
    );
  end if;
  return v_total;
end $$;

-- Cron (15 мин). Өмнө нь ledger МӨР бүрээр давтдаг байсан — одоо due болсон
-- мөрүүдийн `order_id`-аар давтаж `release_order_points`-ийг дуудна: нэг
-- захиалга = нэг мэдэгдэл. Захиалга бүр нэг л earn мөртэй (`mark_order_paid`).
-- `order_id is null` хуучин мөрүүдийг өмнөхөөрөө нээнэ, мэдэгдэлгүй.
-- Буцаах утга: нээсэн захиалга + хуучин (order_id-гүй) мөрийн тоо — cron
-- зөвхөн дууддаг, утгыг нь хэн ч уншдаггүй.
create or replace function release_due_points()
returns int language plpgsql as $$
declare
  v_order uuid;
  v_row record;
  n int := 0;
begin
  for v_order in
    select distinct order_id from loyalty_ledger
    where reason = 'earn' and not released
      and available_at is not null and available_at <= now()
      and order_id is not null
  loop
    -- Өөр transaction (хүргэлт, төлбөр) тухайн захиалгыг нээж байвал алгасна —
    -- дараагийн ажиллалтад (эсвэл тэр transaction өөрөө) нээнэ.
    perform 1 from loyalty_ledger
      where order_id = v_order and reason = 'earn' and not released
      for update skip locked;
    if not found then
      continue;
    end if;
    if release_order_points(v_order) > 0 then
      n := n + 1;
    end if;
  end loop;

  for v_row in
    select id, user_id, delta from loyalty_ledger
    where reason = 'earn' and not released
      and available_at is not null and available_at <= now()
      and order_id is null
    for update skip locked
  loop
    update profiles
      set pending_points = greatest(pending_points - v_row.delta, 0),
          loyalty_points = loyalty_points + v_row.delta
      where id = v_row.user_id;
    update loyalty_ledger set released = true where id = v_row.id;
    n := n + 1;
  end loop;
  return n;
end $$;
