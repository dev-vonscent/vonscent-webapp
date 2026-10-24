-- place_order: V point-ийн уралдааныг засав (extras-shop-plan §0).
--
-- 1. Оноог түгжээгүй уншдаг байсан. 10,000 оноотой хэрэглэгч хоёр checkout-ыг
--    зэрэг илгээвэл хоёулаа 10,000-ыг уншиж, `greatest(... , 0)` нь хоёр дахь
--    хасалтыг 0 дээр зогсоогоод 20,000₮-ийн хөнгөлөлт өгдөг байв. Одоо
--    `profiles` мөрийг `for update` түгжиж уншина.
-- 2. Хүрэлцэхгүй оноог чимээгүй багасгахгүй — `LOYALTY_CHANGED:<боломжтой ₮>`
--    шидэж, захиалга үүсэхгүй. Route нь 409 буцааж, checkout шинэ үлдэгдлийг
--    харуулаад хэрэглэгчээр дахин батлуулна.
--
-- Түгжих дараалал өөрчлөгдөөгүй: inventory → coupons → profiles. Цуцлалт
-- (`update_order_status`) ч inventory-г түрүүлж, оноог (`reverse_order_loyalty`)
-- сүүлд хөнддөг тул шинэ deadlock үүсэхгүй.
--
-- Бие нь 0132-ынх (dev сан дээрх хувилбартай тулгасан), зөвхөн оноо уншдаг
-- хэсэг өөрчлөгдсөн. Signature ижил тул эрх (0088) хэвээр.

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
  v_list int;
  v_need int;
  v_gender gender_t;
  v_override boolean;
  v_subtotal int := 0;
  v_gross int := 0;
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
  -- Хүргэх өдөр (0052): клиентээс ирсэн өдөр, гэхдээ хамгийн эрт нь маргааш
  -- (UB). Өнөөдөр эсвэл өнгөрсөн өдрийг зөвшөөрвөл автомат хуваарь тэр
  -- захиалгыг бэлдэх завсаргүйгээр шууд хүргэлтэд гаргана.
  v_deliver_on date := greatest(
    coalesce(nullif(p_order->>'deliver_on','')::date,
             ((now() at time zone 'Asia/Ulaanbaatar')::date + 1)),
    ((now() at time zone 'Asia/Ulaanbaatar')::date + 1)
  );
begin
  -- First pass: line check + bottle check + reserve every line (fails fast).
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product := (v_item->>'product_id')::uuid;
    v_variant := nullif(v_item->>'variant_id','')::uuid;
    v_ml := (v_item->>'ml')::int;
    v_qty := (v_item->>'qty')::int;
    v_gift := coalesce((v_item->>'is_gift')::boolean, false);
    v_need := v_ml * v_qty;

    -- Мөр: худалдаанд байгаа бараа, түүний ӨӨРИЙН идэвхтэй хэмжээ, ижил ml.
    -- Хэмжээгүй мөр нь зөвхөн бэлгийн дээж (1ml) байж болно.
    if v_qty is null or v_qty <= 0 or v_ml is null or v_ml <= 0 then
      raise exception 'ITEMS_UNAVAILABLE:%', coalesce(v_variant::text, '')
        using errcode = 'check_violation';
    end if;
    perform 1 from products p
      where p.id = v_product and p.status = 'active'
      for share;
    if not found then
      raise exception 'ITEMS_UNAVAILABLE:%', coalesce(v_variant::text, '')
        using errcode = 'check_violation';
    end if;
    -- Бэлгийн мөр = хэмжээгүй, яг GIFT_SAMPLE_ML (constants.ts). 0126 нь
    -- зөвхөн хэмжээгүй салаанд шалгадаг байсан — `{is_gift:true,
    -- variant_id:<20ml>, unit_price:0}` нь 20ml-ийг 0₮-өөр гаргах байсан.
    if v_gift and (v_variant is not null or v_ml <> 1) then
      raise exception 'ITEMS_UNAVAILABLE:%', coalesce(v_variant::text, '')
        using errcode = 'check_violation';
    end if;
    if v_variant is not null then
      -- `for share`: админ үнэ/идэвхийг энэ transaction дуустал өөрчилж
      -- чадахгүй — 2-р pass-ийн `variant_price` яг шалгасан мөрийг уншина.
      perform 1 from product_variants pv
        where pv.id = v_variant
          and pv.product_id = v_product
          and pv.ml = v_ml
          and pv.is_active
        for share;
      if not found then
        raise exception 'ITEMS_UNAVAILABLE:%', v_variant
          using errcode = 'check_violation';
      end if;
    elsif not v_gift or v_ml <> 1 then
      -- Хэмжээгүй мөр = зөвхөн бэлгийн дээж, яг GIFT_SAMPLE_ML (constants.ts).
      -- Route ml-ийг өөрөө тогтоодог ч энэ функц тэр шалгалтад найддаггүй:
      -- `{is_gift:true, ml:20}` нь 20ml-ийг 0₮-өөр reserve хийх байсан.
      raise exception 'ITEMS_UNAVAILABLE:'
        using errcode = 'check_violation';
    end if;

    -- Савны түгжээ: тухайн барааны өнгө/хэмжээ хаалттай бөгөөд чөлөөлөөгүй бол
    -- захиалга үүсэхгүй.
    select p.gender, coalesce(bool_or(pv.bottle_override), false)
      into v_gender, v_override
      from products p
      left join product_variants pv
        on pv.product_id = p.id and pv.ml = v_ml
     where p.id = v_product
     group by p.gender;
    if v_gender is not null
       and not (bottle_active(v_gender, v_ml) or v_override) then
      raise exception 'BOTTLE_UNAVAILABLE:%:%', v_gender, v_ml
        using errcode = 'check_violation';
    end if;

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

    -- `v_list` нь хямдраагүй каталогийн үнэ. Сул мөр unit_price илгээдэггүй
    -- тул хоёулаа ижил гарна; багцын гишүүнд л ялгаа үүснэ.
    select variant_price(pv.*) into v_list
      from product_variants pv where pv.id = v_variant;
    v_unit := coalesce((v_item->>'unit_price')::int, v_list, 0);
    -- Бэлгийн 0₮ мөрийг хямдрал гэж бодохгүй: бэлэг нь тоймд өөрийн мөртэй
    -- бөгөөд каталогийн үнийг нь энд оруулбал «багцын хямдрал» хиймэл томорно.
    if v_gift or v_unit = 0 then
      v_list := v_unit;
    else
      v_list := greatest(coalesce(v_list, v_unit), v_unit);
    end if;

    select name, brand into v_pname, v_brand from products where id = v_product;

    insert into order_items (
      order_id, product_id, variant_id, product_name, brand,
      ml, unit_price, list_price, qty, is_sample, line_total,
      collection_id, collection_name, is_gift
    ) values (
      v_order_id, v_product, v_variant, coalesce(v_pname,''), coalesce(v_brand,''),
      v_ml, v_unit, v_list, v_qty, v_sample, v_unit * v_qty,
      v_coll, v_coll_name, v_gift
    );
    v_subtotal := v_subtotal + v_unit * v_qty;
    v_gross := v_gross + v_list * v_qty;
  end loop;

  -- Купон: зөвхөн бүртгэлтэй худалдан авагчид (0104). Мөрийг ЭХЛЭЭД
  -- түгжинэ — ингэснээр нэг кодыг зэрэг ашиглах хоёр захиалгын хоёр дахь нь
  -- энд хүлээж, түгжээ суларсны дараа validate_coupon шинэ snapshot дээр
  -- `used_count`-ыг дүүрсэн гэж харна. Өмнө нь шалгалт ба нэмэгдүүлэлтийн
  -- хооронд хамгаалалтгүй цонх байсан тул хоёулаа хөнгөлөлт авдаг байв.
  if v_code is not null and v_user is not null then
    select id into v_coupon_id from coupons
      where upper(code) = upper(v_code)
      limit 1
      for update;
    if found then
      v_coupon := validate_coupon(v_code, v_subtotal, v_user);
      if (v_coupon->>'valid')::boolean then
        v_discount := (v_coupon->>'discount')::int;
        update coupons set used_count = used_count + 1 where id = v_coupon_id;
        insert into coupon_redemptions (coupon_id, user_id, order_id)
          values (v_coupon_id, v_user, v_order_id)
          on conflict do nothing;
      end if;
    end if;
  end if;

  -- Loyalty redemption: clamp to available points and the GOODS value only.
  if v_user is not null and v_loyalty > 0 then
    select coalesce((value->>'redeemRate')::numeric, 1) into v_redeem_rate
      from settings where key = 'loyalty';
    v_redeem_rate := coalesce(v_redeem_rate, 1);
    -- 0144: `for update` — зэрэг илгээсэн хоёр checkout ижил үлдэгдлийг
    -- уншиж, оноог хоёр удаа зарцуулдаг байв. Хоёр дахь нь энд хүлээж,
    -- эхнийх commit болсны дараах үлдэгдлийг уншина.
    select loyalty_points into v_avail_points from profiles
      where id = v_user
      for update;
    -- Хүрэлцэхгүй бол чимээгүй багасгахгүй: хэрэглэгч харсан дүнгээсээ өндөр
    -- нэхэмжлэх авах ёсгүй. Боломжтой дүнг (₮) буцааж, дахин батлуулна.
    if v_loyalty > floor(coalesce(v_avail_points, 0) * v_redeem_rate)::int then
      raise exception 'LOYALTY_CHANGED:%',
        floor(coalesce(v_avail_points, 0) * v_redeem_rate)::int
        using errcode = 'check_violation';
    end if;
    -- Барааны дүнгээс хэтрэхгүй (хүргэлтийг оноогоор төлөхгүй) — энэ хумилт
    -- нийт дүнг өсгөхгүй тул хэвээр.
    v_loyalty := least(v_loyalty, greatest(v_subtotal - v_discount, 0));
    if v_loyalty > 0 then
      v_points_used := ceil(v_loyalty / v_redeem_rate)::int;
      update profiles set loyalty_points = loyalty_points - v_points_used
        where id = v_user;
      insert into loyalty_ledger (user_id, order_id, delta, reason)
        values (v_user, v_order_id, -v_points_used, 'redeem');
    end if;
  else
    v_loyalty := 0;
  end if;

  v_total := greatest(v_subtotal + v_shipping - v_discount - v_loyalty, 0);
  update orders set subtotal = v_subtotal, gross_subtotal = v_gross,
    discount = v_discount, loyalty_used = v_loyalty, total = v_total
    where id = v_order_id;

  insert into order_status_history (order_id, status, note, changed_by)
    values (v_order_id, 'pending', 'Захиалга үүсгэгдсэн', v_user);

  return jsonb_build_object('order_id', v_order_id, 'order_no', v_order_no, 'total', v_total);
end $$;
