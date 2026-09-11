-- Хүргэх өдөр нь төлбөр төлөгдсөн мөчид бодитой байх (mark_order_paid).
--
-- Асуудал: `deliver_on` нь checkout дээр сонгогдоод тэр чигээрээ хөдөлдөггүй
-- байсан. Өчигдөр «маргааш» гэж захиалсан (deliver_on = өнөөдөр) захиалгыг
-- өнөөдөр 12:00-д төлөхөд:
--
--   • `auto_dispatch_orders` нь 11:00-д л ажилладаг тул тэр захиалга өнөөдөр
--     хүргэлтэд гарахаа аль хэдийн больсон — дараагийн 11:00, өөрөөр хэлбэл
--     маргааш гарна;
--   • гэтэл захиалга, имэйл, төлбөрийн хуудас бүгд «Өнөөдөр 11:00 цагт
--     хүргэлтэд гарна» гэж хэлсээр байсан.
--
-- Өөрөөр хэлбэл өгөгдөл нь хэрэгжих боломжгүй амлалт агуулж байв. Тиймээс
-- төлбөр төлөгдсөн мөчид хүргэх өдрийг **боломжтой хамгийн эрт өдөр болгож
-- ахиулна** (хэзээ ч буцаахгүй — greatest):
--
--   • 09:00 (ORDER_EDIT_CUTOFF_HOUR, UB) -аас өмнө төлбөл өнөөдөр бэлдэх
--     завсар бий → өнөөдөр хүргэж болно;
--   • 09:00-аас хойш төлбөл тэр өдрийн бэлтгэл аль хэдийн эхэлсэн тул
--     хамгийн эрт нь маргааш.
--
-- Ингэснээр өдөр нь бодитой болж, `auto_dispatch_orders`-ийн хийх зүйлтэй
-- давхцана. Өдөр шилжсэн бол `order_status_history`-д шалтгаантай бичигдэнэ —
-- оператор «яагаад өөр өдөр болов» гэдгээ захиалгын хуудаснаасаа харна.
--
-- Бусад бүх зүйл 0024-ийнхтэй яг ижил (оноо locked bucket-д, inventory
-- commit, idempotent байдал).

create or replace function mark_order_paid(p_order uuid)
returns void language plpgsql as $$
declare
  v_item record;
  v_user uuid;
  v_status payment_status_t;
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
  select user_id, payment_status, subtotal, discount, deliver_on
    into v_user, v_status, v_subtotal, v_discount, v_deliver_old
    from orders where id = p_order;
  if v_status = 'paid' then
    return;  -- idempotent
  end if;

  -- Боломжтой хамгийн эрт хүргэх өдөр (UB): 09:00 хүртэл өнөөдөр, дараа нь
  -- маргааш. `deliver_on` null бол 0052-ын хуучин дүрэм (захиалсны дараах
  -- өдөр) хүчинтэй хэвээр — тэрийг ч мөн адил шалгана.
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

  -- Өдөр шилжсэн тохиолдол — шалтгаан нь түүхэндээ бичигдэнэ.
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
