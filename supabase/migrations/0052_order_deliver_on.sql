-- Урьдчилсан захиалга: хүргэх өдрийг хэрэглэгч сонгоно (backlog E1).
--
-- Өмнө нь бүх захиалга «маргааш 11:00» гэсэн ганц дүрмээр явдаг байсан —
-- өдөр нь захиалга үүссэн огнооноос дам тооцогддог тул хэрэглэгч хожим авах
-- боломжгүй, автомат хуваарь ч сонголтыг мэдэхгүй байв. Одоо өдөр нь
-- `orders.deliver_on` дээр бодитоор хадгалагдана:
--   * захиалга өгөхөд хамгийн эрт нь маргааш (бэлдэх хугацаа хэрэгтэй);
--   * автомат хүргэлт зөвхөн тухайн өдрийнхийг хөдөлгөнө;
--   * цуцлах эцсийн хугацаа нь хүргэх өдрийн 09:00 (TS тал: src/lib/time.ts).

------------------------------------------------------------------------------
-- 1. Багана + индекс. Хуучин захиалгуудад «үүссэн өдрийн маргааш» гэсэн
--    хуучин дүрмээ буцаан бичнэ, ингэснээр deliver_on хэзээ ч null болохгүй.
------------------------------------------------------------------------------

alter table orders add column if not exists deliver_on date;

update orders
   set deliver_on = ((created_at at time zone 'Asia/Ulaanbaatar')::date + 1)
 where deliver_on is null;

-- Автомат хуваарь болон админы «өнөөдөр хүргэх» шүүлт хоёулаа энэ баганаар
-- явна.
create index if not exists orders_deliver_on_idx on orders (deliver_on);

------------------------------------------------------------------------------
-- 2. place_order — 0032-ынхтай ижил, зөвхөн deliver_on нэмэгдэв.
------------------------------------------------------------------------------

create or replace function place_order(p_order jsonb, p_items jsonb)
returns jsonb language plpgsql as $$
declare
  v_order_id uuid;
  v_order_no text;
  v_item jsonb;
  v_product uuid;
  v_variant uuid;
  v_ml int;
  v_qty int;
  v_sample boolean;
  v_gift boolean;
  v_coll uuid;
  v_coll_name text;
  v_unit int;
  v_need int;
  v_subtotal int := 0;
  v_shipping int := coalesce((p_order->>'shipping_fee')::int, 0);
  v_discount int := 0;
  v_loyalty int := greatest(coalesce((p_order->>'loyalty_used')::int, 0), 0);
  v_total int;
  v_pname text;
  v_brand text;
  v_reserve_min int := coalesce((p_order->>'reserve_minutes')::int, 30);
  v_user uuid := nullif(p_order->>'user_id','')::uuid;
  v_code text := nullif(btrim(coalesce(p_order->>'coupon_code','')), '');
  v_coupon jsonb;
  v_coupon_id uuid;
  v_redeem_rate numeric;
  v_avail_points int;
  v_points_used int;
  -- Хүргэх өдөр: клиентээс ирсэн өдөр, гэхдээ хамгийн эрт нь маргааш (UB).
  -- Өнөөдөр эсвэл өнгөрсөн өдрийг зөвшөөрвөл автомат хуваарь тэр захиалгыг
  -- бэлдэх завсаргүйгээр шууд хүргэлтэд гаргана.
  v_deliver_on date := greatest(
    coalesce(nullif(p_order->>'deliver_on','')::date,
             ((now() at time zone 'Asia/Ulaanbaatar')::date + 1)),
    ((now() at time zone 'Asia/Ulaanbaatar')::date + 1)
  );
begin
  -- First pass: reserve every line (fails fast on shortage). A gift reserves
  -- its own ml against the chosen product, same as any other line.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product := (v_item->>'product_id')::uuid;
    v_ml := (v_item->>'ml')::int;
    v_qty := (v_item->>'qty')::int;
    v_need := v_ml * v_qty;
    if not reserve_inventory(v_product, v_need) then
      raise exception 'INSUFFICIENT_STOCK:%', v_product
        using errcode = 'check_violation';
    end if;
  end loop;

  insert into orders (
    user_id, payment_method, contact_name, contact_phone, contact_email,
    ship_city, ship_district, ship_detail, ship_zone, note,
    shipping_fee, coupon_code, reserve_expires_at, subtotal, total, deliver_on
  ) values (
    v_user,
    coalesce((p_order->>'payment_method')::payment_method_t,'qpay'),
    p_order->>'contact_name', p_order->>'contact_phone', p_order->>'contact_email',
    coalesce(p_order->>'ship_city','Улаанбаатар'), p_order->>'ship_district',
    p_order->>'ship_detail', p_order->>'ship_zone', p_order->>'note',
    v_shipping, v_code,
    now() + (v_reserve_min || ' minutes')::interval, 0, 0, v_deliver_on
  ) returning id, order_no into v_order_id, v_order_no;

  -- Second pass: insert items with price snapshots.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product := (v_item->>'product_id')::uuid;
    v_variant := nullif(v_item->>'variant_id','')::uuid;
    v_ml := (v_item->>'ml')::int;
    v_qty := (v_item->>'qty')::int;
    v_sample := coalesce((v_item->>'is_sample')::boolean, false);
    v_gift := coalesce((v_item->>'is_gift')::boolean, false);
    v_coll := nullif(v_item->>'collection_id','')::uuid;
    v_coll_name := nullif(v_item->>'collection_name','');

    -- Bundle lines carry their own (discounted / zero) unit; fall back to the
    -- variant's list price for ordinary items.
    select variant_price(pv.*) into v_unit
      from product_variants pv where pv.id = v_variant;
    v_unit := coalesce((v_item->>'unit_price')::int, v_unit, 0);
    select name, brand into v_pname, v_brand from products where id = v_product;

    insert into order_items (
      order_id, product_id, variant_id, product_name, brand,
      ml, unit_price, qty, is_sample, line_total,
      collection_id, collection_name, is_gift
    ) values (
      v_order_id, v_product, v_variant, coalesce(v_pname,''), coalesce(v_brand,''),
      v_ml, v_unit, v_qty, v_sample, v_unit * v_qty,
      v_coll, v_coll_name, v_gift
    );
    v_subtotal := v_subtotal + v_unit * v_qty;
  end loop;

  -- Coupon: recompute discount on the server, for this buyer.
  if v_code is not null then
    v_coupon := validate_coupon(v_code, v_subtotal, v_user);
    if (v_coupon->>'valid')::boolean then
      v_discount := (v_coupon->>'discount')::int;
      update coupons set used_count = used_count + 1
        where upper(code) = upper(v_code)
        returning id into v_coupon_id;
      insert into coupon_redemptions (coupon_id, user_id, order_id)
        values (v_coupon_id, v_user, v_order_id)
        on conflict do nothing;
    else
      v_discount := 0;
    end if;
  end if;

  -- Loyalty redemption: clamp to available points and the GOODS value only —
  -- points are neither earned on nor spendable against the delivery fee.
  if v_user is not null and v_loyalty > 0 then
    select coalesce((value->>'redeemRate')::numeric, 1) into v_redeem_rate
      from settings where key = 'loyalty';
    v_redeem_rate := coalesce(v_redeem_rate, 1);
    select loyalty_points into v_avail_points from profiles where id = v_user;
    v_loyalty := least(
      v_loyalty,
      floor(coalesce(v_avail_points,0) * v_redeem_rate)::int,
      greatest(v_subtotal - v_discount, 0)
    );
    if v_loyalty > 0 then
      v_points_used := ceil(v_loyalty / v_redeem_rate)::int;
      update profiles set loyalty_points = greatest(loyalty_points - v_points_used, 0)
        where id = v_user;
      insert into loyalty_ledger (user_id, order_id, delta, reason)
        values (v_user, v_order_id, -v_points_used, 'redeem');
    end if;
  else
    v_loyalty := 0;
  end if;

  v_total := greatest(v_subtotal + v_shipping - v_discount - v_loyalty, 0);
  update orders set subtotal = v_subtotal, discount = v_discount,
    loyalty_used = v_loyalty, total = v_total where id = v_order_id;

  insert into order_status_history (order_id, status, note, changed_by)
    values (v_order_id, 'pending', 'Захиалга үүсгэгдсэн', v_user);

  return jsonb_build_object('order_id', v_order_id, 'order_no', v_order_no, 'total', v_total);
end $$;


------------------------------------------------------------------------------
-- 3. Автомат хүргэлт: «өчигдрөөс өмнөх бүх захиалга» биш, ЗӨВХӨН өнөөдөр
--    хүргэх ёстой захиалга. Хугацаа хэтэрсэн (жишээ нь cron нэг өдөр
--    алдагдсан) захиалга ч мөн хамрагдана — `<=`.
------------------------------------------------------------------------------

create or replace function auto_dispatch_orders()
returns void language plpgsql as $$
declare
  v_row record;
begin
  for v_row in
    select id from orders
    where status in ('pending', 'confirmed')
      and payment_status = 'paid'
      and coalesce(
            deliver_on,
            ((created_at at time zone 'Asia/Ulaanbaatar')::date + 1)
          ) <= (now() at time zone 'Asia/Ulaanbaatar')::date
  loop
    perform update_order_status(
      v_row.id, 'shipping', 'Автоматаар хүргэлтэд гарлаа (11:00)', null
    );
  end loop;
end $$;
