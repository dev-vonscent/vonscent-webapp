-- Купоны логикийн шинэчлэл (docs/planning/todo.md B4 «Купон — хуваалцах»).
--
-- 1. Нийтийн купон (`user_id is null`) зөвхөн КОДООР ажиллана: RLS нь
--    хэрэглэгчид зөвхөн өөрт нь оноосон купоныг уншуулна. Өмнө нь anon
--    түлхүүртэй хэн ч `from('coupons')` гэж бүх кампанит кодыг уншдаг байв.
-- 2. Купон ба V point зөвхөн бүртгэлтэй хэрэглэгчид: `validate_coupon` зочинд
--    ямар ч купон дээр `LOGIN_REQUIRED`, `place_order` зочны кодыг үл хэрэгсэнэ.
-- 3. Хувийн купоныг хуваалцаж болно: бүртгэлтэй хэн ч эзэмшигчийн кодыг
--    ашиглаж болох бөгөөд нийт хязгаар (`max_uses`) дүүрмэгц эзэмшигчийнх ч
--    дуусна. Хувийн купонд `max_uses` заавал байна — эс тэгвэл урамшууллын
--    купон (max_uses null, max_uses_per_user 1) хүн бүрт нэг удаа болж хувирна.
-- 4. Зэрэг ашиглалт: `place_order` купоны мөрийг `for update`-аар түгжинэ.
-- 5. Цуцлалт ашиглалтын мөрийг устгахаа больж `cancelled_at` тавина — админы
--    log үлдэж, тооллого зөвхөн идэвхтэй мөрийг тоолно.
--
-- `validate_coupon` 0088-ийн lockdown-д ороогүй байсан («session fallback
-- эвдэрнэ» гэж). RLS одоо нийтийн купоныг нуудаг тул session-ээр дуудах нь
-- утгаа алдсан, харин anon RPC нь rate limit-ийг тойрон код таах зам болж
-- байсан. Тиймээс энд service_role-д хаана; route-ууд admin client-ээр дуудна.

-- ── 1. Ашиглалтын log: цуцлалтыг тэмдэглэнэ ───────────────────────────
alter table coupon_redemptions
  add column if not exists cancelled_at timestamptz;

create index if not exists coupon_redemptions_active_order_idx
  on coupon_redemptions (order_id) where cancelled_at is null;

-- ── 2. Хувийн купоны нийт хязгаар ──────────────────────────────────────
update coupons set max_uses = coalesce(max_uses_per_user, 1)
  where user_id is not null and max_uses is null;

do $$ begin
  alter table coupons add constraint coupons_personal_max_uses
    check (user_id is null or max_uses is not null);
exception when duplicate_object then null; end $$;

-- ── 3. RLS: хэрэглэгч зөвхөн өөрийн купоноо ────────────────────────────
-- is_active шаардахгүй: «Ашиглагдсан / Хугацаа дууссан» таб эзэмшигчид
-- өөрийн түүхийг харуулна. Staff дүрэм (0009) хэвээр.
drop policy if exists "coupons read active" on coupons;
create policy "coupons read own" on coupons for select
  using (user_id is not null and user_id = auth.uid());

-- ── 4. validate_coupon ─────────────────────────────────────────────────
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
  -- Зочин ямар ч купон ашиглахгүй. Кодыг хайхаас ӨМНӨ буцаана — зочинд
  -- код байгаа эсэхийг ч мэдэгдэхгүй.
  if p_user is null then
    return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'LOGIN_REQUIRED');
  end if;

  select * into c from coupons where upper(code) = upper(btrim(p_code)) limit 1;
  if not found then
    return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'NOT_FOUND');
  end if;
  -- Эзэмшигчийн шалгалт хасагдсан: хувийн кодыг эзэмшигч өөр хүнд өгч
  -- болно. Хязгаарыг `max_uses` барина (хувийн купонд заавал, 0104 §2).
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
    select count(*) into v_mine from coupon_redemptions
      where coupon_id = c.id and user_id = p_user and cancelled_at is null;
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

revoke all on function validate_coupon(text, int, uuid) from public, anon, authenticated;
do $$ begin
  grant execute on function validate_coupon(text, int, uuid) to service_role;
exception when undefined_object then null; end $$;

-- ── 5. place_order: купоны мөрийг түгжинэ (бие нь 0097-ынх) ────────────
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
  -- First pass: bottle check + reserve every line (fails fast on shortage).
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product := (v_item->>'product_id')::uuid;
    v_ml := (v_item->>'ml')::int;
    v_qty := (v_item->>'qty')::int;
    v_need := v_ml * v_qty;

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
  update orders set subtotal = v_subtotal, gross_subtotal = v_gross,
    discount = v_discount, loyalty_used = v_loyalty, total = v_total
    where id = v_order_id;

  insert into order_status_history (order_id, status, note, changed_by)
    values (v_order_id, 'pending', 'Захиалга үүсгэгдсэн', v_user);

  return jsonb_build_object('order_id', v_order_id, 'order_no', v_order_no, 'total', v_total);
end $$;

-- ── 6. Цуцлалт: купоныг буцааж, log-ийг үлдээнэ (0040-ыг орлоно) ────────
create or replace function orders_on_cancelled()
returns trigger language plpgsql security definer as $$
declare
  v_coupon uuid;
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    insert into admin_notifications (kind, order_id, message)
    values (
      'order_cancelled',
      new.id,
      'Захиалга ' || new.order_no || ' цуцлагдлаа — ' ||
      coalesce(new.contact_name, '') || ' (' || coalesce(new.contact_phone, '') || '). ' ||
      case when new.payment_status = 'paid'
        then 'Төлбөр төлөгдсөн тул хэрэглэгчтэй холбогдож мөнгийг нь буцаана уу.'
        else 'Төлбөр төлөгдөөгүй байсан.' end
    );

    -- Энэ захиалгын АШИГЛАСАН купоныг буцаана. Захиалгын дугаараар хайна
    -- (кодоор биш) — ашиглалтын мөр бол купон үнэхээр хэрэглэгдсэний цорын
    -- ганц баталгаа. Мөр устахгүй, `cancelled_at` авна: админы log үлдэж,
    -- validate_coupon зөвхөн идэвхтэй мөрийг тоолно. Купоны `user_id`
    -- хөндөгдөхгүй тул хуваалцсан купон эзэмшигчдээ буцна.
    for v_coupon in
      update coupon_redemptions set cancelled_at = now()
        where order_id = new.id and cancelled_at is null
        returning coupon_id
    loop
      update coupons set used_count = greatest(used_count - 1, 0)
        where id = v_coupon;
    end loop;

    -- Энэ захиалгын ТӨЛӨӨ олгосон 300k+ урамшууллын купон: хэн ч ашиглаагүй
    -- бол устгана. Цуцлагдсан ашиглалт л үлдсэн бол log-ийг (cascade)
    -- алдахгүйн тулд устгахгүй, идэвхгүй болгоно.
    delete from coupons c
      where c.source_order_id = new.id
        and not exists (select 1 from coupon_redemptions r where r.coupon_id = c.id);
    update coupons c set is_active = false
      where c.source_order_id = new.id
        and not exists (
          select 1 from coupon_redemptions r
           where r.coupon_id = c.id and r.cancelled_at is null
        );
  end if;
  return new;
end $$;

-- ── 7. Урамшууллын купон: нийт хязгаартай (0041-ийн бие) ────────────────
create or replace function grant_reward_coupon(p_order uuid)
returns text language plpgsql as $$
declare
  v_user uuid;
  v_base int;
  v_cfg jsonb;
  v_code text;
  v_uses int;
begin
  select user_id, greatest(coalesce(subtotal, 0) - coalesce(discount, 0), 0)
    into v_user, v_base from orders where id = p_order;
  if v_user is null then return null; end if;

  select value->'autoGrant' into v_cfg from settings where key = 'coupons';
  if v_cfg is null or not coalesce((v_cfg->>'enabled')::boolean, false) then
    return null;
  end if;
  if v_base < coalesce((v_cfg->>'minTotal')::int, 300000) then
    return null;
  end if;
  if exists (select 1 from coupons where source_order_id = p_order) then
    return null;
  end if;

  -- Хуваалцаж болох тул нийт хязгаар = нэг хүний хязгаар (0104 §2).
  v_uses := greatest(coalesce((v_cfg->>'maxUsesPerUser')::int, 1), 1);
  v_code := generate_coupon_code('VS');
  insert into coupons (code, user_id, source_order_id, type, value, min_subtotal,
                       max_uses, max_uses_per_user, ends_at, is_active)
  values (
    v_code, v_user, p_order,
    coalesce(v_cfg->>'type', 'percent')::coupon_type_t,
    coalesce((v_cfg->>'value')::int, 10),
    0, v_uses, v_uses,
    now() + (coalesce((v_cfg->>'validDays')::int, 30) || ' days')::interval,
    true
  );
  return v_code;
end $$;
