-- Буцаалт нь зөвхөн цуцлагдсан захиалга дээр хийгдэнэ (requirement_final.md §5).
--
-- Урсгал нь баримтаар: «Цуцлахад оноо, купон автоматаар буцаагдаж, админд
-- мэдэгдэл очно (төлбөрийн буцаалтыг админ гараар хийнэ)». Өөрөөр хэлбэл
-- цуцлалт нь захиалгын амьдралын мөчлөгийг хаадаг үйлдэл, буцаалт нь түүний
-- дараа бүртгэгддэг **төлбөрийн баримт**.
--
-- Өмнө нь mark_order_refunded нь payment_status-ыг л сольдог байсан тул
-- «Хүргэгдэж буй + Буцаагдсан» гэх мэт утгагүй хослол үүсгэх боломжтой байв:
-- мөнгө нь буцсан атлаа мл нь зарцуулагдсан, оноо нь олгогдсон, купон нь
-- шатсан хэвээр үлдэнэ — цуцлалтын урвуулалт (0019/0040) огт ажиллахгүй.
--
-- Мөн mark_order_paid нь цуцлагдсан захиалгыг чимээгүйхэн 'confirmed' болгож,
-- аль хэдийн буцаагдсан мл-ийг дахин commit хийдэг байсныг хаав.

-- ── Буцаалт: цуцлагдсан + төлөгдсөн байхыг шаардана ───────────────────
-- Буцаах утга нь void-оос jsonb болсон тул эхлээд drop.
drop function if exists mark_order_refunded(uuid, uuid);

create or replace function mark_order_refunded(p_order uuid, p_by uuid)
returns jsonb language plpgsql as $$
declare
  v_status order_status_t;
  v_pay payment_status_t;
begin
  select status, payment_status into v_status, v_pay
    from orders where id = p_order for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;

  -- Хоёр дахь даралт нь түүхэнд давхар мөр үлдээхгүй.
  if v_pay = 'refunded' then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  if v_pay <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'NOT_PAID');
  end if;
  if v_status <> 'cancelled' then
    return jsonb_build_object('ok', false, 'reason', 'NOT_CANCELLED');
  end if;

  update orders set payment_status = 'refunded' where id = p_order;
  insert into order_status_history (order_id, status, note, changed_by)
    values (p_order, v_status, 'Төлбөр буцаагдсан', p_by);

  return jsonb_build_object('ok', true);
end $$;

-- ── Төлсөн гэж тэмдэглэх: цуцлагдсан захиалгыг сэргээхгүй ─────────────
-- 0069-ийнхтэй яг ижил, эхэнд нь цуцлалтын хаалт + мөрийн түгжээ нэмэгдэв.
create or replace function mark_order_paid(p_order uuid)
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
  --
  -- Анхаар: цуцлалтыг super_admin-аар буцаах (cancelled → pending) нь мл-ийг
  -- дахин reserve хийдэггүй (update_order_status, 0024). Тиймээс «сэргээгээд
  -- дараа нь төлсөн гэж тэмдэглэх» зам нь commit_inventory-г reserve-гүй
  -- ажиллуулж, бусад захиалгын reserved_ml-ийг иднэ. Сэргээсэн захиалгыг
  -- төлөгдсөн болгохоос өмнө үлдэгдлийг гараар шалгах ёстой — үүнийг
  -- автоматаар засах нь тусдаа migration.
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

  insert into order_status_history (order_id, status, note)
    values (p_order, 'confirmed', 'Төлбөр төлөгдсөн');

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
        update profiles set pending_points = pending_points + v_earned
          where id = v_user;
        insert into loyalty_ledger
          (user_id, order_id, delta, reason, available_at, released)
          values (v_user, p_order, v_earned, 'earn',
                  now() + (v_lock_hours || ' hours')::interval, false);
        -- A zero lock window means "spendable immediately"; honour it here
        -- rather than making the customer wait for the next cron tick.
        if v_lock_hours = 0 then
          perform release_order_points(p_order);
        end if;
      end if;
    end if;
  end if;
end $$;
