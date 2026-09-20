-- V point-ийн түгжээг ХҮРГЭХ ӨДРӨӨС тоолно (уулзалтын тэмдэглэл 1.4).
--
-- ## Асуудал
--
-- 0024-өөс хойш захиалгаас олсон оноо `pending_points`-д суугаад хоёр замын
-- аль нэгээр нээгддэг: (1) захиалга «Хүргэгдсэн» болоход `release_order_points`,
-- (2) `available_at` хугацаа өнгөрөхөд `release_due_points()` (pg_cron).
--
-- Хоёр дахь замыг `now() + lockHours` гэж тооцдог байсан — өөрөөр хэлбэл
-- ТӨЛСӨН мөчөөс. Тиймээс 5 хоногийн дараа хүргэгдэх урьдчилсан захиалгын оноо
-- 24 цагийн дараа нээгдэж, хэрэглэгч хүлээж аваагүй барааныхаа оноог зарцуулаад
-- дараа нь цуцлах боломжтой байв (0019-ийн буцаалт тэгээс доош хумигддаг тул
-- зөрүүг дэлгүүр үүрнэ).
--
-- ## Дүрэм (клиентэд хариулсан 1.4)
--
--   available_at = хүргэх өдрийн 00:00 (Улаанбаатар) + lockHours
--
-- Захиалга түүнээс өмнө «Хүргэгдсэн» болбол оноо шууд нээгдэнэ — тэр зам
-- хэвээрээ (`release_order_points`). Өдөр нь тодорхойгүй (хуучин захиалга)
-- бол хуучин зан: төлсөн мөчөөс `lockHours`.
--
-- `deliver_on` нь захиалга үүсэхэд болон төлбөр төлөгдөхөд л өөрчлөгддөг
-- (0069) — төлсний дараа хөдөлдөггүй тул энд нэг удаа тооцвол хангалттай.
--
-- Бусад бүх зүйл 0090-ийнхтэй яг ижил (актор, row lock, idempotency).

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

  v_now_ub := now() at time zone 'Asia/Ulaanbaatar';
  v_min_day := case
    when v_now_ub::time < time '09:00' then v_now_ub::date
    else v_now_ub::date + 1
  end;
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
    if v_earn_per > 0 then
      v_earned := floor(v_base / v_earn_per) * v_earn_points;
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
  end if;
end $$;

-- ⚠ `create or replace` нь эрхийг АНХДАГЧ руу нь буцаадаг: 0088-ийн түгжээг
-- энд ДАХИН тавихгүй бол PostgREST дээр нээлттэй үлдэнэ.
revoke all on function mark_order_paid(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function mark_order_paid(uuid, uuid, text) to service_role;
