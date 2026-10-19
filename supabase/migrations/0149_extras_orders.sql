-- Нэмэлт бараатай захиалга — нэг атомик хэсэг (extras-shop-plan §6; PR6).
-- Feature flag: `extras_shop` (нэмэлт барааны шинэ reserve), `vial_inventory`
-- (савны шинэ reserve).
--
-- Нөөц үүсгэдэг код (place_order) ба нөөцийг суллаж/хасдаг код (цуцлалт,
-- хугацаа, хүргэлт, сэргээлт, буцаалт) НЭГ migration-д — нэмэлт бараатай
-- захиалга мөчлөг нь бүрэн болохоос өмнө хэзээ ч үүсэхгүй.
--
-- Expand only: `place_order(jsonb, jsonb)`-ийн signature хэвээр, хуучин route
-- (бэлгийн мөрийг өөрөө бодож, `expected`-гүй илгээдэг) яг өмнөх шигээ
-- ажиллана. Шинэ route нь:
--   p_order.expected         — хэрэглэгчийн баталсан дүнгүүд (§6.2 №5)
--   p_order.gift_product_ids — бэлгийн сонголт; эрхийг SQL бодно (§6.2 №4)
--   p_items[].kind           — 'perfume' | 'bundle' | 'extra'
--
-- Түгжих НЭГ дараалал (бүгд id-аар эрэмбэлж): orders (мөр) → profiles →
-- coupons → products → product_variants → inventory → extra_products →
-- extra_variants → vials → leftover_liquid_locks. place_order, төлөв,
-- төлбөр, буцаалт, админы RPC (0147) бүгд үүнийг дагана — урвуу дараалалтай
-- хоёр захиалга deadlock-гүй.
--
-- Алдаа: `raise exception 'CODE:<json эсвэл тоо>'`. Route (app/api/orders)
-- кодыг уншиж, json-ыг клиент рүү дамжуулна.

------------------------------------------------------------------------------
-- 0. Багана, туслах функц
------------------------------------------------------------------------------

-- Мөрийн дараалал (§6.2 №8) — reload / retry үед ижил дарааллаар буцна.
alter table order_items add column if not exists line_no int;

-- ⚠ `giftAllowanceFor` (src/lib/gift.ts) ба GIFT_THRESHOLD / GIFT_MAX_SAMPLES
-- (constants.ts)-тэй таарах ёстой — `pnpm db:test-extras-dev` хилийн утгаар
-- шалгана.
create or replace function gift_entitlement(p_goods bigint)
returns int language sql immutable parallel safe as $$
  select least(floor(greatest(p_goods, 0) / 200000.0)::int, 8);
$$;

-- Үнэртний мөрийг аль өнгийн саванд цутгах вэ (§5.3, §8): тоон горимд
-- override асаалттай бол түүний өнгө, эс бөгөөс барааны өнгө, тэр нь ч үгүй
-- бол хүйсээр. 1ml, 2ml сав өнгөгүй.
create or replace function perfume_vial_style(p_product uuid, p_ml int)
returns text language sql stable as $$
  select case when p_ml <= 2 then null else
    coalesce(
      (select pv.bottle_override_style from product_variants pv
        where pv.product_id = p_product and pv.ml = p_ml
          and pv.bottle_override and pv.bottle_override_style is not null),
      p.vial_style,
      default_vial_style(p.gender))
  end
  from products p where p.id = p_product;
$$;

-- «Ягаан 10ml», «2ml сав» — `vialName` (src/lib/vials.ts)-тэй ижил.
create or replace function vial_label(p_style text, p_ml int)
returns text language sql immutable as $$
  select case p_style
    when 'black' then 'Хар ' || p_ml || 'ml'
    when 'pink' then 'Ягаан ' || p_ml || 'ml'
    when 'silver' then 'Мөнгөлөг ' || p_ml || 'ml'
    else p_ml || 'ml сав'
  end;
$$;

-- Захиалгын хадгалсан хураангуй — place_order-ийн хариу ба `request_id`-ийн
-- давхар илгээлт (describeExistingOrder) хоёулаа ЭНЭГЭЭР (§6.2 №6).
create or replace function order_summary(p_order uuid)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'order_id', o.id,
    'order_no', o.order_no,
    'subtotal', o.subtotal,
    'discount', o.discount,
    'loyalty_used', o.loyalty_used,
    'shipping_fee', o.shipping_fee,
    'total', o.total,
    'omitted_gifts', coalesce(o.omitted_gifts, '[]'::jsonb),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id,
               'line_kind', i.line_kind,
               'product_id', i.product_id,
               'variant_id', i.variant_id,
               'extra_variant_id', i.extra_variant_id,
               'name', i.product_name,
               'brand', i.brand,
               'variant_label', i.variant_label,
               'ml', i.ml,
               'qty', i.qty,
               'unit_price', i.unit_price,
               'list_price', i.list_price,
               'line_total', i.line_total,
               'is_gift', i.is_gift,
               'collection_name', i.collection_name)
             order by i.line_no nulls last, i.id)
        from order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from orders o where o.id = p_order;
$$;

------------------------------------------------------------------------------
-- 1. Нөөцийн мөчлөг (§6.3) — нэмэлт бараа, сав, үлдэгдэлтэй шил
--
-- Төлөв зөвхөн хүлээгдэж буй өмнөх утгаас шилжинэ; хөдөлгөөн бүр
-- `<order_item>:<resource>:<kind>:<lifecycle_cycle>` түлхүүртэй тул давтан
-- дуудалт нөөцийг хоёр удаа хөдөлгөхгүй. `null` төлөвтэй (хуучин) мөрийг
-- алгасна. Тугаас үл хамаарна — өмнө үүссэн төлөвийг үргэлж дуусгана.
-- Дуудагч нь захиалгын мөр ба нөөцийн мөрүүдийг аль хэдийн түгжсэн байна
-- (`order_lock_stock`).
------------------------------------------------------------------------------

-- Захиалгын бүх нөөцийн мөрийг нэг дарааллаар түгжинэ.
create or replace function order_lock_stock(p_order uuid)
returns void language plpgsql as $$
begin
  perform 1 from inventory
   where product_id in (
     select i.product_id from order_items i
      where i.order_id = p_order and i.product_id is not null
     union
     select ep.product_id from order_items i
       join extra_products ep on ep.id = i.extra_product_id
      where i.order_id = p_order and ep.product_id is not null)
   order by product_id for update;
  perform 1 from extra_variants
   where id in (select extra_variant_id from order_items
                 where order_id = p_order and extra_variant_id is not null)
   order by id for update;
  perform 1 from vials
   where id in (select vial_id from order_items
                 where order_id = p_order and vial_id is not null)
   order by id for update;
  perform 1 from leftover_liquid_locks
   where extra_product_id in (
     select extra_product_id from order_items
      where order_id = p_order and extra_inventory_mode = 'leftover_liquid')
   order by extra_product_id for update;
end $$;

-- Хүргэхээс өмнө цуцлагдах / хугацаа дуусах: reserved → released.
create or replace function order_stock_release(p_order uuid, p_cycle int)
returns void language plpgsql as $$
declare
  v_item record;
begin
  for v_item in
    select * from order_items
     where order_id = p_order and extra_state = 'reserved'
     order by extra_variant_id, id
  loop
    if v_item.extra_inventory_mode = 'local_quantity' then
      perform extra_stock_move(v_item.extra_variant_id, 'release', 0, -v_item.qty,
        v_item.id || ':extra:release:' || p_cycle, v_item.id, 'Захиалга цуцлагдсан');
    elsif v_item.extra_inventory_mode = 'leftover_liquid' then
      -- Шил дахин зарагдана (listed) — эх үнэртний түгжээ хэвээр.
      update leftover_liquid_locks
         set state = 'listed', order_item_id = null
       where extra_product_id = v_item.extra_product_id
         and state = 'reserved' and order_item_id = v_item.id;
      perform extra_stock_move(v_item.extra_variant_id, 'release', 0, -1,
        v_item.id || ':extra:release:' || p_cycle, v_item.id, 'Захиалга цуцлагдсан');
    end if;
    -- shared_vial: сав нь доорх vial_state-ээр.
    update order_items set extra_state = 'released'
     where id = v_item.id and extra_state = 'reserved';
  end loop;

  for v_item in
    select * from order_items
     where order_id = p_order and vial_state = 'reserved'
     order by vial_id, id
  loop
    perform vial_stock_move(v_item.vial_id, 'release', 0, -v_item.qty,
      v_item.id || ':vial:release:' || p_cycle, v_item.id, 'Захиалга цуцлагдсан');
    update order_items set vial_state = 'released'
     where id = v_item.id and vial_state = 'reserved';
  end loop;
end $$;

-- Хүргэгдэх: reserved → committed. Сав, бараа нөөцөөс бүрмөсөн хасагдана;
-- үлдэгдэлтэй шилний түгжсэн ml эх үнэртний on_hand-аас хасагдана.
create or replace function order_stock_commit(p_order uuid, p_cycle int)
returns void language plpgsql as $$
declare
  v_item record;
  v_lock leftover_liquid_locks;
  v_product uuid;
begin
  for v_item in
    select * from order_items
     where order_id = p_order and extra_state = 'reserved'
     order by extra_variant_id, id
  loop
    if v_item.extra_inventory_mode = 'local_quantity' then
      perform extra_stock_move(v_item.extra_variant_id, 'commit',
        -v_item.qty, -v_item.qty,
        v_item.id || ':extra:commit:' || p_cycle, v_item.id, 'Хүргэгдсэн');
    elsif v_item.extra_inventory_mode = 'leftover_liquid' then
      select * into v_lock from leftover_liquid_locks
       where extra_product_id = v_item.extra_product_id
         and state = 'reserved' and order_item_id = v_item.id;
      if found then
        select product_id into v_product from extra_products
         where id = v_item.extra_product_id;
        perform commit_inventory(v_product, v_lock.locked_ml);
        update leftover_liquid_locks set state = 'committed'
         where extra_product_id = v_item.extra_product_id;
      end if;
      perform extra_stock_move(v_item.extra_variant_id, 'commit', -1, -1,
        v_item.id || ':extra:commit:' || p_cycle, v_item.id, 'Хүргэгдсэн');
    end if;
    update order_items set extra_state = 'committed'
     where id = v_item.id and extra_state = 'reserved';
  end loop;

  for v_item in
    select * from order_items
     where order_id = p_order and vial_state = 'reserved'
     order by vial_id, id
  loop
    perform vial_stock_move(v_item.vial_id, 'commit', -v_item.qty, -v_item.qty,
      v_item.id || ':vial:commit:' || p_cycle, v_item.id, 'Хүргэгдсэн');
    update order_items set vial_state = 'committed'
     where id = v_item.id and vial_state = 'reserved';
  end loop;
end $$;

-- Цуцлагдсаныг сэргээх (cancelled → pending): released → reserved. Нөөц
-- хүрэхгүй, шил өөр захиалгад орсон бол бүхэлдээ татгалзана (§5.5).
create or replace function order_stock_reserve(p_order uuid, p_cycle int)
returns void language plpgsql as $$
declare
  v_item record;
  v_var extra_variants;
  v_vial vials;
  v_n int;
begin
  for v_item in
    select * from order_items
     where order_id = p_order and extra_state = 'released'
     order by extra_variant_id, id
  loop
    select * into v_var from extra_variants where id = v_item.extra_variant_id;
    if v_item.extra_inventory_mode = 'local_quantity' then
      if v_var.on_hand_qty - v_var.reserved_qty < v_item.qty then
        raise exception 'EXTRA_QTY_UNAVAILABLE:%', jsonb_build_object(
          'extra_variant_id', v_item.extra_variant_id,
          'available', greatest(v_var.on_hand_qty - v_var.reserved_qty, 0),
          'requested', v_item.qty) using errcode = 'check_violation';
      end if;
      perform extra_stock_move(v_item.extra_variant_id, 'reserve', 0, v_item.qty,
        v_item.id || ':extra:reserve:' || p_cycle, v_item.id, 'Захиалга сэргэсэн');
    elsif v_item.extra_inventory_mode = 'leftover_liquid' then
      update leftover_liquid_locks
         set state = 'reserved', order_item_id = v_item.id
       where extra_product_id = v_item.extra_product_id
         and state = 'listed' and order_item_id is null;
      get diagnostics v_n = row_count;
      if v_n = 0 then
        raise exception 'LEFTOVER_RESTORE_CONFLICT:%', v_item.extra_product_id
          using errcode = 'check_violation';
      end if;
      perform extra_stock_move(v_item.extra_variant_id, 'reserve', 0, 1,
        v_item.id || ':extra:reserve:' || p_cycle, v_item.id, 'Захиалга сэргэсэн');
    end if;
    update order_items set extra_state = 'reserved' where id = v_item.id;
  end loop;

  for v_item in
    select * from order_items
     where order_id = p_order and vial_state = 'released'
     order by vial_id, id
  loop
    select * into v_vial from vials where id = v_item.vial_id;
    if not v_vial.is_active
       or (v_vial.on_hand is not null
           and v_vial.on_hand - v_vial.reserved < v_item.qty) then
      raise exception 'VIAL_UNAVAILABLE:%', jsonb_build_object(
        'vial_id', v_item.vial_id, 'ml', v_vial.ml, 'style', v_vial.style)
        using errcode = 'check_violation';
    end if;
    perform vial_stock_move(v_item.vial_id, 'reserve', 0, v_item.qty,
      v_item.id || ':vial:reserve:' || p_cycle, v_item.id, 'Захиалга сэргэсэн');
    update order_items set vial_state = 'reserved' where id = v_item.id;
  end loop;
end $$;

------------------------------------------------------------------------------
-- 2. place_order (§6.2)
------------------------------------------------------------------------------

create or replace function place_order(p_order jsonb, p_items jsonb)
returns jsonb language plpgsql as $$
declare
  v_user uuid := nullif(p_order->>'user_id', '')::uuid;
  v_code text := nullif(btrim(coalesce(p_order->>'coupon_code', '')), '');
  v_shipping int := coalesce((p_order->>'shipping_fee')::int, 0);
  v_loyalty_req int := greatest(coalesce((p_order->>'loyalty_used')::int, 0), 0);
  v_reserve_min int := coalesce((p_order->>'reserve_minutes')::int, 30);
  v_expected jsonb := case when jsonb_typeof(p_order->'expected') = 'object'
                           then p_order->'expected' end;
  v_gift_picks jsonb := case when jsonb_typeof(p_order->'gift_product_ids') = 'array'
                             then p_order->'gift_product_ids' end;
  -- Хүргэх өдөр (0052): хамгийн эрт нь маргааш (UB).
  v_deliver_on date := greatest(
    coalesce(nullif(p_order->>'deliver_on', '')::date,
             ((now() at time zone 'Asia/Ulaanbaatar')::date + 1)),
    ((now() at time zone 'Asia/Ulaanbaatar')::date + 1)
  );
  v_vials_on boolean := feature_enabled('vial_inventory');
  v_lines jsonb;          -- хэвийн болгосон мөрүүд (perfume / bundle / gift / extra)
  v_line jsonb;
  v_idx int;
  v_product uuid;
  v_variant uuid;
  v_ml int;
  v_qty int;
  v_kind text;
  v_unit int;
  v_list int;
  v_price_changes jsonb := '[]'::jsonb;
  v_subtotal bigint := 0;
  v_gross bigint := 0;
  v_discount int := 0;
  v_loyalty int := 0;
  v_total bigint;
  v_coupon jsonb;
  v_coupon_id uuid;
  v_redeem_rate numeric;
  v_avail_points int;
  v_points_max int;
  v_points_used int;
  v_entitled int;
  v_pool jsonb;
  v_pool_on boolean;
  v_gift_taken jsonb := '{}'::jsonb;   -- product_id → тоо
  v_gift_total int := 0;
  v_omitted jsonb := '[]'::jsonb;
  v_vial1 uuid;
  v_vial1_left int;     -- null = хязгааргүй
  v_ml_left int;
  v_order_id uuid;
  v_order_no text;
  v_item_id uuid;
  v_row record;
  v_ev extra_variants;
  v_ep extra_products;
  v_cat_name text;
  v_vial vials;
  v_label text;
  v_image text;
  v_n int := 0;
begin
  -- ── 1. Мөрүүдийг хэвийн болгох ─────────────────────────────────────
  -- `kind`-гүй (хуучин route) мөр: is_gift → gift, unit_price-тэй → bundle,
  -- бусад нь perfume. Шинэ route бэлгийг `gift_product_ids`-ээр илгээнэ.
  select coalesce(jsonb_agg(x.line order by x.n), '[]'::jsonb) into v_lines
    from (
      select e.n, e.x || jsonb_build_object(
        'idx', e.n,
        'kind', coalesce(e.x->>'kind',
          case when coalesce((e.x->>'is_gift')::boolean, false) then 'gift'
               when e.x ? 'unit_price' or e.x ? 'collection_name' then 'bundle'
               else 'perfume' end)) as line
        from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
             with ordinality e(x, n)
    ) x;

  for v_line in select * from jsonb_array_elements(v_lines) loop
    v_kind := v_line->>'kind';
    v_qty := (v_line->>'qty')::int;
    if v_kind not in ('perfume', 'bundle', 'gift', 'extra')
       or v_qty is null or v_qty <= 0 or v_qty > 99 then
      raise exception 'ITEMS_UNAVAILABLE:' using errcode = 'check_violation';
    end if;
    if v_kind = 'extra' then
      if nullif(v_line->>'extra_variant_id', '') is null then
        raise exception 'ITEMS_UNAVAILABLE:' using errcode = 'check_violation';
      end if;
      -- Туг хаалттай үед нэмэлт барааны ШИНЭ reserve үүсэхгүй (§6.3 дүрэм 2).
      if not feature_enabled('extras_shop') then
        raise exception 'EXTRAS_DISABLED' using errcode = 'check_violation';
      end if;
      continue;
    end if;
    v_variant := nullif(v_line->>'variant_id', '')::uuid;
    v_ml := (v_line->>'ml')::int;
    if v_ml is null or v_ml <= 0 then
      raise exception 'ITEMS_UNAVAILABLE:%', coalesce(v_variant::text, '')
        using errcode = 'check_violation';
    end if;
    -- Бэлгийн мөр = хэмжээгүй, яг GIFT_SAMPLE_ML (0132).
    if (v_kind = 'gift') <> (v_variant is null) or (v_kind = 'gift' and v_ml <> 1) then
      raise exception 'ITEMS_UNAVAILABLE:%', coalesce(v_variant::text, '')
        using errcode = 'check_violation';
    end if;
  end loop;

  -- ── 2. Түгжих — НЭГ дараалал, id-аар эрэмбэлж ─────────────────────
  if v_user is not null and v_loyalty_req > 0 then
    perform 1 from profiles where id = v_user for update;
  end if;
  if v_code is not null and v_user is not null then
    select id into v_coupon_id from coupons
     where upper(code) = upper(v_code)
     order by id limit 1
     for update;
  end if;

  perform 1 from products
   where id in (
     select (l->>'product_id')::uuid from jsonb_array_elements(v_lines) l
      where l->>'kind' <> 'extra'
     union
     select (g #>> '{}')::uuid from jsonb_array_elements(coalesce(v_gift_picks, '[]')) g
      where (g #>> '{}') ~ '^[0-9a-f-]{36}$')
   order by id for share;
  perform 1 from product_variants
   where id in (select (l->>'variant_id')::uuid from jsonb_array_elements(v_lines) l
                 where l->>'kind' in ('perfume', 'bundle'))
   order by id for share;

  -- Нэмэлт барааны мөрүүд: хувилбар → бараа (үлдэгдэлтэй шилний эх үнэртний
  -- inventory-г бусадтай хамт түгжихийн тулд эхлээд уншина).
  perform 1 from inventory
   where product_id in (
     select (l->>'product_id')::uuid from jsonb_array_elements(v_lines) l
      where l->>'kind' <> 'extra'
     union
     select (g #>> '{}')::uuid from jsonb_array_elements(coalesce(v_gift_picks, '[]')) g
      where (g #>> '{}') ~ '^[0-9a-f-]{36}$'
     union
     select ep.product_id from jsonb_array_elements(v_lines) l
       join extra_variants ev on ev.id = (l->>'extra_variant_id')::uuid
       join extra_products ep on ep.id = ev.extra_id
      where l->>'kind' = 'extra' and ep.product_id is not null)
   order by product_id for update;
  perform 1 from extra_products
   where id in (select ev.extra_id from jsonb_array_elements(v_lines) l
                  join extra_variants ev on ev.id = (l->>'extra_variant_id')::uuid
                 where l->>'kind' = 'extra')
   order by id for share;
  perform 1 from extra_variants
   where id in (select (l->>'extra_variant_id')::uuid from jsonb_array_elements(v_lines) l
                 where l->>'kind' = 'extra')
   order by id for update;
  if v_vials_on then
    perform 1 from vials
     where id in (
       select vial_for(perfume_vial_style((l->>'product_id')::uuid, (l->>'ml')::int),
                       (l->>'ml')::int)
         from jsonb_array_elements(v_lines) l where l->>'kind' in ('perfume', 'bundle')
       union
       select ev.vial_id from jsonb_array_elements(v_lines) l
         join extra_variants ev on ev.id = (l->>'extra_variant_id')::uuid
        where l->>'kind' = 'extra' and ev.vial_id is not null
       union
       select vial_for(null, 1))
     order by id for update;
  end if;
  perform 1 from leftover_liquid_locks
   where extra_product_id in (
     select ev.extra_id from jsonb_array_elements(v_lines) l
       join extra_variants ev on ev.id = (l->>'extra_variant_id')::uuid
      where l->>'kind' = 'extra' and ev.inventory_mode = 'leftover_liquid')
   order by extra_product_id for update;

  -- ── 3. Үнэртний мөр: худалдаанд, хэмжээ идэвхтэй, сав ────────────────
  for v_line in select * from jsonb_array_elements(v_lines) loop
    v_kind := v_line->>'kind';
    continue when v_kind = 'extra';
    v_product := (v_line->>'product_id')::uuid;
    v_variant := nullif(v_line->>'variant_id', '')::uuid;
    v_ml := (v_line->>'ml')::int;
    perform 1 from products p where p.id = v_product and p.status = 'active';
    if not found then
      raise exception 'ITEMS_UNAVAILABLE:%', coalesce(v_variant::text, '')
        using errcode = 'check_violation';
    end if;
    if v_variant is not null then
      perform 1 from product_variants pv
        where pv.id = v_variant and pv.product_id = v_product
          and pv.ml = v_ml and pv.is_active;
      if not found then
        raise exception 'ITEMS_UNAVAILABLE:%', v_variant
          using errcode = 'check_violation';
      end if;
    end if;
    -- Савны хуучин түгжээ (0095) — тоон горим хаалттай үед.
    if not v_vials_on and v_kind <> 'gift' then
      perform 1 from products p
        where p.id = v_product
          and (bottle_active(p.gender, v_ml)
               or exists (select 1 from product_variants pv
                           where pv.product_id = p.id and pv.ml = v_ml
                             and pv.bottle_override));
      if not found then
        raise exception 'BOTTLE_UNAVAILABLE:%:%',
          (select gender from products where id = v_product), v_ml
          using errcode = 'check_violation';
      end if;
    end if;
  end loop;

  -- ── 4. Нэмэлт бараа: идэвхтэй, нийтэлсэн, үнэ, тоо ─────────────────
  for v_row in
    select (l->>'extra_variant_id')::uuid as id,
           sum((l->>'qty')::int)::int as qty,
           -- Ижил хувилбар хоёр мөрөөр ирвэл нэгтгэнэ; харсан үнэ нь хамгийн
           -- сүүлийнх (ижил байх ёстой).
           (array_agg((l->>'expected_unit_price')::int order by (l->>'idx')::int desc))[1]
             as expected_price
      from jsonb_array_elements(v_lines) l
     where l->>'kind' = 'extra'
     group by 1
  loop
    select * into v_ev from extra_variants where id = v_row.id;
    select * into v_ep from extra_products where id = v_ev.extra_id;
    if v_ev.id is null or not v_ev.is_active or v_ev.price <= 0
       or v_ep.status <> 'published'
       or not exists (select 1 from extra_categories c
                       where c.id = v_ep.category_id and c.is_active)
       or (v_ev.inventory_mode = 'shared_vial' and not v_vials_on) then
      raise exception 'EXTRA_UNAVAILABLE:%', jsonb_build_object(
        'extra_variant_id', v_row.id) using errcode = 'check_violation';
    end if;
    if v_row.expected_price is not null and v_row.expected_price <> v_ev.price then
      v_price_changes := v_price_changes || jsonb_build_object(
        'extra_variant_id', v_row.id, 'unit_price', v_ev.price);
    end if;
    if v_ev.inventory_mode = 'local_quantity'
       and v_ev.on_hand_qty - v_ev.reserved_qty < v_row.qty then
      raise exception 'EXTRA_QTY_UNAVAILABLE:%', jsonb_build_object(
        'extra_variant_id', v_row.id,
        'available', greatest(v_ev.on_hand_qty - v_ev.reserved_qty, 0),
        'requested', v_row.qty) using errcode = 'check_violation';
    end if;
    if v_ev.inventory_mode = 'leftover_liquid'
       and (v_row.qty <> 1
            or not exists (select 1 from leftover_liquid_locks k
                            where k.extra_product_id = v_ep.id
                              and k.state = 'listed')
            or v_ev.on_hand_qty - v_ev.reserved_qty < 1) then
      raise exception 'LEFTOVER_ALREADY_SOLD:%', jsonb_build_object(
        'extra_variant_id', v_row.id) using errcode = 'check_violation';
    end if;
  end loop;
  -- Үнэ өөрчлөгдсөн бол сервер чимээгүй солихгүй — шинэ үнийг буцаана.
  if jsonb_array_length(v_price_changes) > 0 then
    raise exception 'EXTRA_PRICE_CHANGED:%', jsonb_build_object(
      'prices', v_price_changes) using errcode = 'check_violation';
  end if;

  -- ── 5. Шингэн ба савны хүрэлцээ ────────────────────────────────────
  for v_row in
    select (l->>'product_id')::uuid as product_id,
           sum((l->>'ml')::int * (l->>'qty')::int)::int as need
      from jsonb_array_elements(v_lines) l
     where l->>'kind' <> 'extra'
     group by 1
     order by 1
  loop
    select greatest(on_hand_ml - reserved_ml, 0) into v_ml_left
      from inventory where product_id = v_row.product_id;
    if coalesce(v_ml_left, 0) < v_row.need then
      raise exception 'INSUFFICIENT_STOCK:%', v_row.product_id
        using errcode = 'check_violation';
    end if;
  end loop;

  if v_vials_on then
    -- Сав бүрийн хэрэгцээ: үнэртний мөр (бэлгээс бусад) + грамын сав.
    for v_row in
      select v_id, sum(qty)::int as qty,
             (array_agg(product_id) filter (where product_id is not null))[1] as product_id,
             (array_agg(extra_variant_id) filter (where extra_variant_id is not null))[1]
               as extra_variant_id
        from (
          select vial_for(perfume_vial_style((l->>'product_id')::uuid, (l->>'ml')::int),
                          (l->>'ml')::int) as v_id,
                 (l->>'qty')::int as qty,
                 (l->>'product_id')::uuid as product_id,
                 null::uuid as extra_variant_id
            from jsonb_array_elements(v_lines) l
           where l->>'kind' in ('perfume', 'bundle')
          union all
          select ev.vial_id, (l->>'qty')::int, null, ev.id
            from jsonb_array_elements(v_lines) l
            join extra_variants ev on ev.id = (l->>'extra_variant_id')::uuid
           where l->>'kind' = 'extra' and ev.vial_id is not null
        ) need
       group by v_id
    loop
      select * into v_vial from vials where id = v_row.v_id;
      if v_vial.id is null or not v_vial.is_active
         or (v_vial.on_hand is not null
             and v_vial.on_hand - v_vial.reserved < v_row.qty) then
        raise exception 'VIAL_UNAVAILABLE:%', jsonb_build_object(
          'product_id', v_row.product_id,
          'extra_variant_id', v_row.extra_variant_id,
          'ml', v_vial.ml, 'style', v_vial.style)
          using errcode = 'check_violation';
      end if;
    end loop;
  end if;

  -- ── 6. Дүн ─────────────────────────────────────────────────────────
  for v_line in select * from jsonb_array_elements(v_lines) loop
    v_kind := v_line->>'kind';
    v_qty := (v_line->>'qty')::int;
    if v_kind = 'extra' then
      select price into v_unit from extra_variants
       where id = (v_line->>'extra_variant_id')::uuid;
      v_list := v_unit;
    elsif v_kind = 'gift' then
      v_unit := 0;
      v_list := 0;
    else
      select variant_price(pv.*) into v_list from product_variants pv
       where pv.id = (v_line->>'variant_id')::uuid;
      -- Багцын гишүүн: TS-ийн бодсон хямдарсан үнэ (priceCollectionLines).
      v_unit := case when v_kind = 'bundle'
                     then coalesce((v_line->>'unit_price')::int, v_list, 0)
                     else coalesce(v_list, 0) end;
      v_list := greatest(coalesce(v_list, v_unit), v_unit);
    end if;
    v_subtotal := v_subtotal + v_unit::bigint * v_qty;
    v_gross := v_gross + v_list::bigint * v_qty;
  end loop;
  if v_subtotal > 2147483647 or v_gross > 2147483647 then
    raise exception 'ORDER_TOO_LARGE' using errcode = 'check_violation';
  end if;

  -- Купон: зөвхөн бүртгэлтэй худалдан авагчид (0104), хүргэлтэд үйлчлэхгүй.
  if v_coupon_id is not null then
    v_coupon := validate_coupon(v_code, v_subtotal::int, v_user);
    if (v_coupon->>'valid')::boolean then
      v_discount := (v_coupon->>'discount')::int;
    end if;
  end if;

  -- V point (0144): хүрэлцэхгүй бол чимээгүй багасгахгүй.
  if v_user is not null and v_loyalty_req > 0 then
    select coalesce((value->>'redeemRate')::numeric, 1) into v_redeem_rate
      from settings where key = 'loyalty';
    v_redeem_rate := coalesce(v_redeem_rate, 1);
    select loyalty_points into v_avail_points from profiles where id = v_user;
    v_points_max := floor(coalesce(v_avail_points, 0) * v_redeem_rate)::int;
    if v_loyalty_req > v_points_max then
      raise exception 'LOYALTY_CHANGED:%',
        least(v_points_max, greatest(v_subtotal - v_discount, 0))
        using errcode = 'check_violation';
    end if;
    v_loyalty := least(v_loyalty_req, greatest(v_subtotal - v_discount, 0)::int);
  end if;

  v_total := v_subtotal + v_shipping - v_discount - v_loyalty;

  -- Баталсан дүн өөрчлөгдөхгүй (§2.2 K) — `expected` ирсэн үед.
  if v_expected is not null then
    if (v_expected->>'subtotal')::bigint is distinct from v_subtotal then
      raise exception 'TOTAL_CHANGED:%', jsonb_build_object(
        'subtotal', v_subtotal, 'discount', v_discount, 'loyalty_used', v_loyalty,
        'shipping_fee', v_shipping, 'total', v_total)
        using errcode = 'check_violation';
    end if;
    if (v_expected->>'discount')::int is distinct from v_discount then
      raise exception 'COUPON_CHANGED:%', jsonb_build_object(
        'subtotal', v_subtotal, 'discount', v_discount, 'loyalty_used', v_loyalty,
        'shipping_fee', v_shipping, 'total', v_total)
        using errcode = 'check_violation';
    end if;
    if (v_expected->>'loyalty_used')::int is distinct from v_loyalty then
      raise exception 'LOYALTY_CHANGED:%', v_loyalty
        using errcode = 'check_violation';
    end if;
    if (v_expected->>'shipping_fee')::int is distinct from v_shipping then
      raise exception 'SHIPPING_CHANGED:%', jsonb_build_object(
        'subtotal', v_subtotal, 'discount', v_discount, 'loyalty_used', v_loyalty,
        'shipping_fee', v_shipping, 'total', v_total)
        using errcode = 'check_violation';
    end if;
    if (v_expected->>'total')::bigint is distinct from v_total then
      raise exception 'TOTAL_CHANGED:%', jsonb_build_object(
        'subtotal', v_subtotal, 'discount', v_discount, 'loyalty_used', v_loyalty,
        'shipping_fee', v_shipping, 'total', v_total)
        using errcode = 'check_violation';
    end if;
  end if;

  -- ── 7. Бэлэг transaction дотор (§6.2 №4) ──────────────────────────
  -- Эрхээс илүү, үлдэгдэлгүй, 1ml сав дууссан сонголт ороогүй — захиалга
  -- үргэлжилнэ, хасагдсаныг хадгалж хэрэглэгчид мэдэгдэнэ. Бэлэг 0₮ тул
  -- баталсан дүнд нөлөөлөхгүй.
  if v_gift_picks is not null and jsonb_array_length(v_gift_picks) > 0 then
    v_entitled := gift_entitlement(v_subtotal - v_discount);
    select value into v_pool from settings where key = 'gift';
    v_pool_on := coalesce((v_pool->>'enabled')::boolean, true);
    if v_vials_on then
      v_vial1 := vial_for(null, 1);
      select case when not is_active then 0
                  when on_hand is null then null
                  else greatest(on_hand - reserved, 0) end
        into v_vial1_left from vials where id = v_vial1;
    end if;
    for v_line in select * from jsonb_array_elements(v_gift_picks) loop
      continue when (v_line #>> '{}') !~ '^[0-9a-f-]{36}$';
      v_product := (v_line #>> '{}')::uuid;
      -- Сангаас гадуурх / худалдаанаас гарсан сонголт чимээгүй унана (TS-ийн
      -- priceGiftLines-тэй ижил).
      continue when not v_pool_on
        or not coalesce(v_pool->'productIds', '[]'::jsonb) ? v_product::text
        or not exists (select 1 from products where id = v_product and status = 'active');
      continue when coalesce((v_gift_taken->>v_product::text)::int, 0) >= 2;  -- GIFT_PER_PRODUCT_LIMIT
      if v_gift_total >= v_entitled then
        v_omitted := v_omitted || jsonb_build_object('product_id', v_product, 'reason', 'threshold');
        continue;
      end if;
      select greatest(on_hand_ml - reserved_ml, 0) into v_ml_left
        from inventory where product_id = v_product;
      v_ml_left := coalesce(v_ml_left, 0)
        - coalesce((select sum((l->>'ml')::int * (l->>'qty')::int)
                      from jsonb_array_elements(v_lines) l
                     where l->>'kind' <> 'extra'
                       and (l->>'product_id')::uuid = v_product), 0)
        - coalesce((v_gift_taken->>v_product::text)::int, 0);
      if v_ml_left < 1 then
        v_omitted := v_omitted || jsonb_build_object('product_id', v_product, 'reason', 'stock');
        continue;
      end if;
      if v_vials_on and (v_vial1 is null or (v_vial1_left is not null and v_vial1_left < 1)) then
        v_omitted := v_omitted || jsonb_build_object('product_id', v_product, 'reason', 'vial');
        continue;
      end if;
      v_gift_taken := jsonb_set(v_gift_taken, array[v_product::text],
        to_jsonb(coalesce((v_gift_taken->>v_product::text)::int, 0) + 1));
      v_gift_total := v_gift_total + 1;
      if v_vial1_left is not null then v_vial1_left := v_vial1_left - 1; end if;
    end loop;
    -- Бэлгийн мөрүүд (бараа бүрт нэг мөр, qty-гаар) — сонгосон дарааллаар.
    for v_row in
      select (k)::uuid as product_id, (v_gift_taken->>k)::int as qty,
             min(n) as first_n
        from jsonb_object_keys(v_gift_taken) k
        join jsonb_array_elements_text(v_gift_picks) with ordinality p(id, n) on p.id = k
       group by k
       order by first_n
    loop
      v_lines := v_lines || jsonb_build_object(
        'idx', 1000 + v_row.first_n, 'kind', 'gift',
        'product_id', v_row.product_id, 'ml', 1, 'qty', v_row.qty);
    end loop;
  end if;

  -- ── 8. Захиалга ───────────────────────────────────────────────────
  insert into orders (
    user_id, payment_method, contact_name, contact_phone, contact_email,
    ship_city, ship_district, ship_detail, ship_zone, note,
    shipping_fee, coupon_code, reserve_expires_at, subtotal, gross_subtotal,
    discount, loyalty_used, total, deliver_on, omitted_gifts
  ) values (
    v_user,
    coalesce((p_order->>'payment_method')::payment_method_t, 'qpay'),
    p_order->>'contact_name', p_order->>'contact_phone', p_order->>'contact_email',
    coalesce(p_order->>'ship_city', 'Улаанбаатар'), p_order->>'ship_district',
    p_order->>'ship_detail', p_order->>'ship_zone', p_order->>'note',
    v_shipping, v_code,
    now() + (v_reserve_min || ' minutes')::interval,
    v_subtotal::int, v_gross::int, v_discount, v_loyalty, v_total::int, v_deliver_on,
    case when jsonb_array_length(v_omitted) > 0 then v_omitted end
  ) returning id, order_no into v_order_id, v_order_no;

  -- ── 9. Мөр + нөөц ─────────────────────────────────────────────────
  for v_line in
    select l from jsonb_array_elements(v_lines) l order by (l->>'idx')::int
  loop
    v_kind := v_line->>'kind';
    v_qty := (v_line->>'qty')::int;
    v_n := v_n + 1;
    if v_kind = 'extra' then
      select * into v_ev from extra_variants where id = (v_line->>'extra_variant_id')::uuid;
      select * into v_ep from extra_products where id = v_ev.extra_id;
      select name into v_cat_name from extra_categories where id = v_ep.category_id;
      v_vial := null;
      if v_ev.vial_id is not null then
        select * into v_vial from vials where id = v_ev.vial_id;
      end if;
      v_label := case v_ev.inventory_mode
        when 'shared_vial' then vial_label(v_vial.style, v_vial.ml)
        when 'leftover_liquid' then v_ep.remaining_ml || ' / ' || v_ep.full_ml || 'ml'
        else nullif(btrim(v_ev.label), '') end;
      v_image := coalesce(v_ep.images[1],
        (select pi.url from product_images pi
          where pi.product_id = v_ep.product_id and pi.is_visible
          order by pi.sort_order limit 1));
      insert into order_items (
        order_id, line_no, line_kind, product_name, brand, ml, unit_price, list_price,
        qty, line_total, extra_variant_id, extra_product_id, extra_inventory_mode,
        variant_label, image_url, extra_state, vial_id, vial_state
      ) values (
        v_order_id, v_n, 'extra', v_ep.name, coalesce(v_cat_name, ''), null,
        v_ev.price, v_ev.price, v_qty, v_ev.price * v_qty,
        v_ev.id, v_ep.id, v_ev.inventory_mode, v_label, v_image, 'reserved',
        v_ev.vial_id, case when v_ev.vial_id is not null then 'reserved' end
      ) returning id into v_item_id;
      if v_ev.inventory_mode = 'local_quantity' then
        perform extra_stock_move(v_ev.id, 'reserve', 0, v_qty,
          v_item_id || ':extra:reserve:0', v_item_id, 'Захиалга ' || v_order_no);
      elsif v_ev.inventory_mode = 'shared_vial' then
        perform vial_stock_move(v_ev.vial_id, 'reserve', 0, v_qty,
          v_item_id || ':vial:reserve:0', v_item_id, 'Захиалга ' || v_order_no);
      else
        update leftover_liquid_locks
           set state = 'reserved', order_item_id = v_item_id
         where extra_product_id = v_ep.id and state = 'listed';
        perform extra_stock_move(v_ev.id, 'reserve', 0, 1,
          v_item_id || ':extra:reserve:0', v_item_id, 'Захиалга ' || v_order_no);
      end if;
      continue;
    end if;

    v_product := (v_line->>'product_id')::uuid;
    v_variant := nullif(v_line->>'variant_id', '')::uuid;
    v_ml := (v_line->>'ml')::int;
    if v_kind = 'gift' then
      v_unit := 0;
      v_list := 0;
    else
      select variant_price(pv.*) into v_list from product_variants pv where pv.id = v_variant;
      v_unit := case when v_kind = 'bundle'
                     then coalesce((v_line->>'unit_price')::int, v_list, 0)
                     else coalesce(v_list, 0) end;
      v_list := greatest(coalesce(v_list, v_unit), v_unit);
    end if;
    v_vial := null;
    if v_vials_on then
      select * into v_vial from vials
       where id = vial_for(case when v_kind = 'gift' then null
                                else perfume_vial_style(v_product, v_ml) end,
                           v_ml);
    end if;
    insert into order_items (
      order_id, line_no, line_kind, product_id, variant_id, product_name, brand,
      ml, unit_price, list_price, qty, is_sample, line_total,
      collection_id, collection_name, is_gift, vial_id, vial_state
    )
    select v_order_id, v_n, 'perfume', v_product, v_variant, p.name, p.brand,
           v_ml, v_unit, v_list, v_qty,
           coalesce((v_line->>'is_sample')::boolean, v_kind = 'gift'),
           v_unit * v_qty,
           nullif(v_line->>'collection_id', '')::uuid,
           nullif(v_line->>'collection_name', ''),
           v_kind = 'gift',
           v_vial.id, case when v_vial.id is not null then 'reserved' end
      from products p where p.id = v_product
    returning id into v_item_id;
    if v_vial.id is not null then
      perform vial_stock_move(v_vial.id, 'reserve', 0, v_qty,
        v_item_id || ':vial:reserve:0', v_item_id, 'Захиалга ' || v_order_no);
    end if;
  end loop;

  -- Шингэний reserve — бараа бүрт нэг удаа, id-аар эрэмбэлж.
  for v_row in
    select (l->>'product_id')::uuid as product_id,
           sum((l->>'ml')::int * (l->>'qty')::int)::int as need
      from jsonb_array_elements(v_lines) l
     where l->>'kind' <> 'extra'
     group by 1 order by 1
  loop
    if not reserve_inventory(v_row.product_id, v_row.need) then
      raise exception 'INSUFFICIENT_STOCK:%', v_row.product_id
        using errcode = 'check_violation';
    end if;
  end loop;

  -- ── 10. Купон, оноо, түүх ─────────────────────────────────────────
  if v_discount > 0 then
    update coupons set used_count = used_count + 1 where id = v_coupon_id;
    insert into coupon_redemptions (coupon_id, user_id, order_id)
      values (v_coupon_id, v_user, v_order_id)
      on conflict do nothing;
  end if;
  if v_loyalty > 0 then
    v_points_used := ceil(v_loyalty / v_redeem_rate)::int;
    update profiles set loyalty_points = loyalty_points - v_points_used
     where id = v_user;
    insert into loyalty_ledger (user_id, order_id, delta, reason)
      values (v_user, v_order_id, -v_points_used, 'redeem');
  end if;

  insert into order_status_history (order_id, status, note, changed_by)
    values (v_order_id, 'pending', 'Захиалга үүсгэгдсэн', v_user);

  return order_summary(v_order_id);
end $$;

comment on function place_order(jsonb, jsonb) is
  'Захиалга үүсгэх (0149): мөрүүдийг нэгтгэж, нэг дарааллаар түгжиж, үнийг '
  'сангаас, баталсан дүнг (expected) тулгаж, бэлгийг SQL-д бодно. Үнэртэн, '
  'багц, нэмэлт бараа, сав, үлдэгдэлтэй шил. Хариу = order_summary().';

------------------------------------------------------------------------------
-- 3. update_order_status — шилжилтийн хүснэгт SQL-д (§6.4) + нөөцийн мөчлөг
------------------------------------------------------------------------------

create or replace function update_order_status(
  p_order uuid,
  p_status order_status_t,
  p_note text,
  p_by uuid
)
returns void language plpgsql as $$
declare
  v_item record;
  v_prev order_status_t;
  v_pay payment_status_t;
  v_paid boolean;
  v_user uuid;
  v_cycle int;
  v_need int;
  v_legal boolean;
begin
  select status, payment_status, payment_status = 'paid', user_id, lifecycle_cycle
    into v_prev, v_pay, v_paid, v_user, v_cycle
    from orders where id = p_order for update;
  if not found then return; end if;

  -- Ижил төлөв дахин өгөх → бүрэн no-op (мэдэгдэл, түүх ч үгүй).
  if p_status = v_prev then return; end if;

  -- Route-ийн хүснэгтийн давхар шалгалт (api/admin/orders/[id]/status).
  -- super_admin эрхийг route шалгана; энд шилжилт хууль ёсны эсэхийг.
  v_legal := case v_prev
    when 'pending'   then p_status in ('confirmed', 'cancelled')
    when 'confirmed' then p_status in ('shipping', 'cancelled')
    when 'shipping'  then p_status in ('delivered', 'confirmed', 'cancelled')
    when 'delivered' then p_status = 'shipping'
    when 'cancelled' then p_status = 'pending'
    else false end;
  -- Буцаасан захиалга хаалттай — идэвхтэй төлөв рүү орохгүй.
  if not v_legal or v_pay = 'refunded' then
    raise exception 'ILLEGAL_TRANSITION:%:%', v_prev, p_status
      using errcode = 'check_violation';
  end if;
  if p_status in ('shipping', 'delivered') and not v_paid then
    raise exception 'PAYMENT_REQUIRED' using errcode = 'check_violation';
  end if;

  -- Түгжих дараалал: profiles → (купон нь trigger дотор) → нөөц.
  if p_status = 'cancelled' and v_user is not null then
    perform 1 from profiles where id = v_user for update;
  end if;
  perform order_lock_stock(p_order);

  -- Хүргэгдсэн бол цуцлагдахгүй тул оноог нээнэ; нэмэлт бараа, сав нөөцөөс
  -- бүрмөсөн хасагдана.
  if p_status = 'delivered' then
    perform release_order_points(p_order);
    perform order_stock_commit(p_order, v_cycle);
  end if;

  if p_status = 'cancelled' then
    for v_item in
      select product_id, ml, qty from order_items
       where order_id = p_order and line_kind = 'perfume' and product_id is not null
       order by product_id
    loop
      if v_paid then
        -- Төлсөн захиалга on_hand-аас commit хийгдсэн — ml-ийг буцаана.
        update inventory
          set on_hand_ml = on_hand_ml + v_item.ml * v_item.qty
          where product_id = v_item.product_id;
        update inventory
          set is_sold_out = false
          where product_id = v_item.product_id and (on_hand_ml - reserved_ml) > 0;
      else
        perform release_inventory(v_item.product_id, v_item.ml * v_item.qty);
      end if;
    end loop;
    perform order_stock_release(p_order, v_cycle);
    perform reverse_order_loyalty(p_order);
  end if;

  -- Сэргээлт (super_admin, cancelled → pending): нөөцийг БҮГДИЙГ дахин авч
  -- чадвал л. Шинэ мөчлөг — хөдөлгөөний түлхүүр шинэ.
  -- Анхаар: цуцлалтаар урвуулсан оноо, купон сэргэхгүй (§2.2 L).
  if v_prev = 'cancelled' then
    v_cycle := v_cycle + 1;
    for v_item in
      select product_id, sum(ml * qty)::int as need from order_items
       where order_id = p_order and line_kind = 'perfume' and product_id is not null
       group by product_id order by product_id
    loop
      if not reserve_inventory(v_item.product_id, v_item.need) then
        raise exception 'INSUFFICIENT_STOCK:%', v_item.product_id
          using errcode = 'check_violation';
      end if;
      if v_paid then
        perform commit_inventory(v_item.product_id, v_item.need);
      end if;
    end loop;
    perform order_stock_reserve(p_order, v_cycle);
  end if;

  perform set_config('vonscent.order_actor', coalesce(p_by::text, ''), true);  -- 0141
  update orders set status = p_status,
    lifecycle_cycle = v_cycle,
    reserve_expires_at = case when p_status in ('cancelled') then null else reserve_expires_at end
    where id = p_order;
  perform set_config('vonscent.order_actor', '', true);  -- 0141

  insert into order_status_history (order_id, status, note, changed_by)
    values (p_order, p_status, coalesce(p_note, ''), p_by);
end $$;

-- Cron: төлөгдөөгүй захиалга хүргэлтээс гарахгүй — нэг буруу мөр бүх
-- давталтыг (PAYMENT_REQUIRED) унагахаас сэргийлж шүүлтээр.
create or replace function auto_deliver_orders()
returns void language plpgsql as $$
declare
  v_row record;
begin
  for v_row in
    select id from orders where status = 'shipping' and payment_status = 'paid'
  loop
    perform update_order_status(
      v_row.id, 'delivered', 'Автоматаар хүргэгдсэн (23:00)', null
    );
  end loop;
end $$;

------------------------------------------------------------------------------
-- 4. mark_order_paid — 0143-ын бие + төлөвийн хамгаалалт, түгжих дараалал
------------------------------------------------------------------------------

create or replace function mark_order_paid(
  p_order uuid,
  p_by uuid default null,
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
  select user_id, payment_status, status, subtotal, discount, deliver_on
    into v_user, v_status, v_order_status, v_subtotal, v_discount, v_deliver_old
    from orders where id = p_order for update;
  if v_status = 'paid' then
    return;  -- idempotent
  end if;
  -- Цуцлагдсан захиалгын мл, оноо, купон аль хэдийн буцсан (0073).
  if v_order_status = 'cancelled' then
    raise exception 'ORDER_CANCELLED' using errcode = 'check_violation';
  end if;
  -- 0149: төлбөрийг зөвхөн хүлээгдэж буй / баталгаажсан захиалгад (§6.4).
  if v_order_status not in ('pending', 'confirmed') or v_status = 'refunded' then
    raise exception 'ILLEGAL_TRANSITION:%:paid', v_order_status
      using errcode = 'check_violation';
  end if;

  v_now_ub := now() at time zone 'Asia/Ulaanbaatar';
  v_min_day := v_now_ub::date + 1;
  v_deliver_new := greatest(coalesce(v_deliver_old, v_min_day), v_min_day);

  -- Түгжих дараалал: profiles → inventory (0149).
  if v_user is not null then
    perform 1 from profiles where id = v_user for update;
  end if;
  perform 1 from inventory
   where product_id in (select product_id from order_items
                         where order_id = p_order and line_kind = 'perfume'
                           and product_id is not null)
   order by product_id for update;

  update orders set payment_status = 'paid', status = 'confirmed',
    deliver_on = v_deliver_new,
    reserve_expires_at = null where id = p_order;

  -- Шингэн төлбөрөөр commit; нэмэлт бараа, сав хүргэлтээр (§6.3).
  for v_item in
    select product_id, sum(ml * qty)::int as need from order_items
     where order_id = p_order and line_kind = 'perfume' and product_id is not null
     group by product_id order by product_id
  loop
    perform commit_inventory(v_item.product_id, v_item.need);
  end loop;

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
    -- Нэмэлт бараа ч бараа — дүнд орно (§2.1 №9).
    v_base := greatest(coalesce(v_subtotal,0) - coalesce(v_discount,0), 0);
    if feature_enabled('user_tiers') then
      v_rate := tier_rate_for_spend(
        greatest(user_lifetime_spend(v_user) - v_base, 0));
      v_earned := floor(v_base::bigint * v_rate / 100);
    elsif v_earn_per > 0 then
      v_earned := floor(v_base / v_earn_per) * v_earn_points;
    else
      v_earned := 0;
    end if;
    if v_earned > 0 then
      v_available := (v_deliver_new::timestamp
                       + (v_lock_hours || ' hours')::interval)
                     at time zone 'Asia/Ulaanbaatar';
      update profiles set pending_points = pending_points + v_earned
        where id = v_user;
      insert into loyalty_ledger
        (user_id, order_id, delta, reason, available_at, released)
        values (v_user, p_order, v_earned, 'earn', v_available, false);
      if v_available <= now() then
        perform release_order_points(p_order);
      end if;
    end if;
  end if;
end $$;

------------------------------------------------------------------------------
-- 5. mark_order_refunded — мөр бүрийн «Нөөцөд буцаах» (§6.5)
--
-- `p_extra_restocks`: [{order_item_id, restocked_qty}] — restocked_qty нь
-- ЭЦСИЙН нийт (нэмэх биш), буурахгүй. Ижил хүсэлт давтан ирвэл зөрүү 0.
-- Мөнгөний буцаалтаас тусдаа шийдвэр — дүнд нөлөөлөхгүй. Мөнгө аль хэдийн
-- буцаагдсан (refunded) захиалгад ч нөөцөө нөхөж болно.
-- Signature өөрчлөгдөж буй тул хуучныг DROP (0111/0129-ийн жишээ).
------------------------------------------------------------------------------

drop function if exists mark_order_refunded(uuid, uuid, int, boolean);

create function mark_order_refunded(
  p_order uuid,
  p_by uuid,
  p_fee int default 0,
  p_restock boolean default null,
  p_extra_restocks jsonb default null
) returns jsonb language plpgsql as $$
declare
  v_status order_status_t;
  v_pay payment_status_t;
  v_total int;
  v_shipping int;
  v_fee int;
  v_amount int;
  v_item record;
  v_ml int := 0;
  v_note text := 'Төлбөр буцаагдсан';
  v_req jsonb;
  v_line order_items;
  v_new int;
  v_restocked int := 0;
begin
  select status, payment_status, total, coalesce(shipping_fee, 0)
    into v_status, v_pay, v_total, v_shipping
    from orders where id = p_order for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;

  -- ── Нөөцөд буцаах бараа ──────────────────────────────────────────
  if p_extra_restocks is not null and jsonb_array_length(p_extra_restocks) > 0 then
    if v_status <> 'delivered' or v_pay not in ('paid', 'refunded') then
      return jsonb_build_object('ok', false, 'reason', 'RESTOCK_NOT_DELIVERED');
    end if;
    perform 1 from extra_variants
     where id in (select i.extra_variant_id from order_items i
                   where i.order_id = p_order and i.extra_variant_id is not null)
     order by id for update;
    for v_req in
      select r from jsonb_array_elements(p_extra_restocks) r
       order by r->>'order_item_id'
    loop
      select * into v_line from order_items
       where id = nullif(v_req->>'order_item_id', '')::uuid and order_id = p_order
       for update;
      v_new := (v_req->>'restocked_qty')::int;
      if v_line.id is null or v_line.line_kind <> 'extra'
         or v_line.extra_inventory_mode <> 'local_quantity'
         or v_line.extra_state <> 'committed'
         or v_new is null or v_new < v_line.restocked_qty or v_new > v_line.qty then
        raise exception 'RESTOCK_INVALID:%', coalesce(v_req->>'order_item_id', '')
          using errcode = 'check_violation';
      end if;
      if v_new > v_line.restocked_qty then
        perform extra_stock_move(v_line.extra_variant_id, 'restock',
          v_new - v_line.restocked_qty, 0,
          v_line.id || ':extra:restock:' || v_new, v_line.id, 'Буцаалт', p_by);
        update order_items set restocked_qty = v_new where id = v_line.id;
        v_restocked := v_restocked + (v_new - v_line.restocked_qty);
      end if;
    end loop;
    if v_restocked > 0 then
      insert into order_status_history (order_id, status, note, changed_by)
        values (p_order, v_status,
          'Нэмэлт бараа нөөцөд буцсан (' || v_restocked || ' ширхэг)', p_by);
    end if;
  end if;

  -- Хоёр дахь даралт нь түүхэнд давхар мөр үлдээхгүй.
  if v_pay = 'refunded' then
    return jsonb_build_object('ok', true, 'already', true, 'restocked', v_restocked);
  end if;
  if v_pay <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'NOT_PAID');
  end if;
  if v_status not in ('cancelled', 'delivered') then
    return jsonb_build_object('ok', false, 'reason', 'NOT_CANCELLED');
  end if;

  if v_status = 'delivered' then
    if p_restock is null then
      return jsonb_build_object('ok', false, 'reason', 'RESTOCK_REQUIRED');
    end if;

    perform reverse_order_loyalty(p_order);
    perform release_order_coupons(p_order);
    perform revoke_order_reward_coupon(p_order);

    for v_item in
      select product_id, ml, qty from order_items
       where order_id = p_order and line_kind = 'perfume'
       order by product_id
    loop
      v_ml := v_ml + v_item.ml * v_item.qty;
      if p_restock and v_item.product_id is not null then
        update inventory
           set on_hand_ml = on_hand_ml + v_item.ml * v_item.qty
         where product_id = v_item.product_id;
        update inventory
           set is_sold_out = (on_hand_ml - reserved_ml) <= 0
         where product_id = v_item.product_id;
        insert into restock_log (product_id, delta_ml, reason, created_by, cost, order_id)
          values (v_item.product_id, v_item.ml * v_item.qty, 'refund_return', p_by, 0, p_order);
      end if;
    end loop;

    v_fee := 0;
    v_amount := greatest(v_total - least(v_shipping, v_total), 0);

    v_note := v_note || case when p_restock
      then ' — декант нөөцөд буцсан (' || v_ml || 'ml)'
      else ' — декант зарах боломжгүй, ' || v_ml || 'ml нөөцөд буцаагүй' end;
    if v_shipping > 0 then
      v_note := v_note || ', хүргэлтийн ' || v_shipping || '₮ буцаагүй';
    end if;
  else
    v_fee := least(greatest(coalesce(p_fee, 0), 0), v_total);
    v_amount := v_total - v_fee;
  end if;

  update orders
     set payment_status = 'refunded',
         refunded_at = now(),
         refund_fee = v_fee,
         refund_amount = v_amount,
         refund_restocked = case when v_status = 'delivered' then p_restock end
   where id = p_order;
  insert into order_status_history (order_id, status, note, changed_by)
    values (p_order, v_status, v_note, p_by);

  return jsonb_build_object('ok', true, 'amount', v_amount, 'restocked', v_restocked);
end $$;

------------------------------------------------------------------------------
-- 6. Мөнгөний invariant (§5.4) — хуучин өгөгдөл цэвэр бол шууд VALIDATE
------------------------------------------------------------------------------

do $$
declare
  v_bad int;
begin
  if exists (select 1 from pg_constraint where conname = 'orders_total_chk') then
    return;
  end if;
  select count(*) into v_bad from orders
   where not (total = subtotal + shipping_fee - discount - loyalty_used
              and discount <= subtotal
              and loyalty_used <= subtotal - discount);
  if v_bad = 0 then
    alter table orders add constraint orders_total_chk
      check (total = subtotal + shipping_fee - discount - loyalty_used
             and discount <= subtotal
             and loyalty_used <= subtotal - discount);
  else
    raise notice 'orders_total_chk: % зөрчилтэй захиалга — нэмсэнгүй', v_bad;
  end if;
end $$;

------------------------------------------------------------------------------
-- 7. Эрх
------------------------------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'gift_entitlement(bigint)',
    'perfume_vial_style(uuid, int)',
    'vial_label(text, int)',
    'order_summary(uuid)',
    'order_lock_stock(uuid)',
    'order_stock_release(uuid, int)',
    'order_stock_commit(uuid, int)',
    'order_stock_reserve(uuid, int)',
    'place_order(jsonb, jsonb)',
    'update_order_status(uuid, order_status_t, text, uuid)',
    'auto_deliver_orders()',
    'mark_order_paid(uuid, uuid, text)',
    'mark_order_refunded(uuid, uuid, int, boolean, jsonb)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
