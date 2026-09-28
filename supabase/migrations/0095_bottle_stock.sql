-- Савны түгжээ (bottle lock) — `docs/planning/bottle-lock-plan.md`.
--
-- Декант цутгах ХООСОН сав нь ml бүрт гурван өнгөтэй ирдэг ба өнгө нь барааны
-- хүйсээр (`products.gender`) хуваарилагдана: эрэгтэй / эмэгтэй / unisex.
-- Нэг өнгө-хэмжээний сав дуусахад (ж: эрэгтэй 10ml) тэр хослолыг цутгах
-- боломжгүй болох ба өнөөдрийг хүртэл админ бараа бүрийн 10ml-ийг гараар
-- унтраахаас өөр аргагүй байв (70+ бараа).
--
-- Яагаад `product_variants.is_active`-ийг bulk-аар унтраадаггүй вэ: тэр багана
-- нь «энэ бараанд энэ хэмжээг зарахгүй» гэсэн АДМИНЫ ГАРЫН шийдвэр. Савны
-- түгжээг түүгээр илэрхийлбэл хоёр шалтгаан нэг баганад нийлж, сав ирэхэд
-- аль нь савнаас болж унтарсныг ялгах арга үлдэхгүй — өмнө нь зориуд
-- унтраасан хэмжээнүүд санамсаргүй нээгдэнэ. Тиймээс тусдаа хүснэгт.
--
-- Энэ нь захиалгын «Түгжигдсэн мл» (`inventory.reserved_ml`, 0075)-ээс тусдаа
-- ойлголт: тэр нь эх савны ШИНГЭН-ий нөөц, энэ нь ХООСОН савны байдал.

------------------------------------------------------------------------------
-- 1. bottle_stock — өнгө (хүйс) × хэмжээний 12 мөр.
------------------------------------------------------------------------------

create table if not exists bottle_stock (
  gender     gender_t    not null,
  ml         int         not null check (ml in (2, 5, 10, 20)),
  is_active  boolean     not null default true,
  -- «9/28-нд ирнэ» гэх мэт админы тэмдэглэл. Дэлгүүрт ХАРАГДАХГҮЙ.
  note       text        not null default '',
  updated_by uuid        references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (gender, ml)
);

drop trigger if exists bottle_stock_updated_at on bottle_stock;
create trigger bottle_stock_updated_at
  before update on bottle_stock
  for each row execute function set_updated_at();

-- 12 мөр: бүгд нээлттэй байдлаар эхэлнэ.
insert into bottle_stock (gender, ml)
select g::gender_t, m
  from unnest(array['male','female','unisex']) g
  cross join unnest(array[2, 5, 10, 20]) m
on conflict (gender, ml) do nothing;

alter table bottle_stock enable row level security;

-- `catalog_items` нь security_invoker тул anon уншиж чадах ёстой.
drop policy if exists "bottle read" on bottle_stock;
create policy "bottle read" on bottle_stock for select using (true);
drop policy if exists "bottle write" on bottle_stock;
create policy "bottle write" on bottle_stock for all
  using (is_staff()) with check (is_staff());

comment on table bottle_stock is
  'Хоосон декант савны байдал: өнгө (хүйс) × хэмжээ. is_active = false бол тэр '
  'хослолыг дэлгүүр дээр зарахгүй. Захиалгын reserved_ml-тэй огт хамаагүй.';

------------------------------------------------------------------------------
-- 2. Онцгой тохиолдол — нэг бараа/хэмжээг түгжээнээс чөлөөлөх.
--
--    Ховор тохиолдолд «эрэгтэй үнэрийг unisex саванд хийж явуулъя» гэж админ
--    шийдэж болно. Түгжээг бүхэлд нь нээвэл 30+ бараа зэрэг нээгдэх тул
--    ганц мөрийн чөлөөлөлт хэрэгтэй. Сав ирээд түгжээ нээгдэхэд админаас
--    эдгээрийг цуцлахыг асууна (UI тал).
------------------------------------------------------------------------------

alter table product_variants
  add column if not exists bottle_override boolean not null default false;

comment on column product_variants.bottle_override is
  'Савны түгжээнээс чөлөөлсөн эсэх — өөр өнгийн саванд цутгахаар админ гараар '
  'зөвшөөрсөн ганц бараа/хэмжээ. is_active-ийг ОРЛОХГҮЙ: гараар унтраасан '
  'хэмжээ энэ тэмдэгтэй ч зарагдахгүй.';

create index if not exists product_variants_bottle_override_idx
  on product_variants (ml) where bottle_override;

------------------------------------------------------------------------------
-- 3. Дүрэм — НЭГ газар.
------------------------------------------------------------------------------

create or replace function bottle_active(p_gender gender_t, p_ml int)
returns boolean language sql stable as $$
  -- Мөр байхгүй (шинэ хэмжээ нэмэгдсэн) бол хаагаагүй гэж үзнэ.
  select coalesce(
    (select bs.is_active from bottle_stock bs
      where bs.gender = p_gender and bs.ml = p_ml),
    true);
$$;

comment on function bottle_active is
  'Тухайн өнгө (хүйс) × хэмжээний сав байгаа эсэх. Мөр байхгүй бол true.';

-- Хэмжээ зарагдах эсэх — өмнө нь catalog_items, global_search,
-- product_variants_for, TS-ийн mapProduct() дөрвөн газар ХУУЛБАРЛАГДСАН
-- байсан дүрэм. Дөрвүүлээ эндээс уншина (TS тал нь толь хэвээр).
create or replace function variant_sellable(
  pv             product_variants,
  p_gender       gender_t,
  p_sold_out     boolean,
  p_available_ml int
)
returns boolean language sql stable as $$
  select pv.is_active
     and (bottle_active(p_gender, pv.ml) or coalesce(pv.bottle_override, false))
     and not coalesce(p_sold_out, false)
     and coalesce(p_available_ml, 0) >= pv.ml;
$$;

comment on function variant_sellable is
  'Хэмжээ өнөөдөр зарагдах уу: админ идэвхтэй үлдээсэн + сав байгаа (эсвэл '
  'чөлөөлсөн) + эх савны ml хүрэлцэнэ.';

------------------------------------------------------------------------------
-- 4. catalog_items (0059) — дүрмээ функцээс авдаг болов. Баганын жагсаалт,
--    эрэмбэ, үнийн логик бүгд ХЭВЭЭР.
------------------------------------------------------------------------------

create or replace view catalog_items with (security_invoker = true) as
  select
    p.id, p.slug, p.name, p.brand,
    p.gender::text as gender,
    p.concentration::text as concentration,
    p.scent_families,
    p.seasons::text[] as seasons,
    coalesce(p.is_featured, false) as is_featured,
    p.rating_avg, p.rating_count, p.created_at,
    p.search_text,
    (select pi.url from product_images pi
      where pi.product_id = p.id and pi.is_visible
      order by pi.sort_order limit 1) as image_url,
    (select coalesce(nullif(pi.alt, ''), p.name) from product_images pi
      where pi.product_id = p.id and pi.is_visible
      order by pi.sort_order limit 1) as image_alt,
    coalesce(tg.kinds, '{}') as tags,
    v.sellable_count,
    v.sellable_mls,
    coalesce(v.sell_price, v.active_price, 0) as starting_price,
    coalesce(v.sell_base, v.active_base, 0) as starting_base_price
  from products p
  left join inventory inv on inv.product_id = p.id
  join lateral (
    select
      count(*) filter (where c.sellable) as sellable_count,
      array_agg(distinct pv.ml) filter (where c.sellable) as sellable_mls,
      (array_agg(c.eff order by c.eff) filter (where c.sellable))[1] as sell_price,
      (array_agg(pv.price order by c.eff) filter (where c.sellable))[1] as sell_base,
      (array_agg(c.eff order by c.eff) filter (where pv.is_active))[1] as active_price,
      (array_agg(pv.price order by c.eff) filter (where pv.is_active))[1] as active_base
    from product_variants pv
    cross join lateral (
      select
        variant_price(pv.*) as eff,
        variant_sellable(pv.*, p.gender, inv.is_sold_out, inv.available_ml)
          as sellable
    ) c
    where pv.product_id = p.id
  ) v on true
  left join lateral (
    select array_agg(t.kind::text) as kinds
      from product_tags pt
      join tags t on t.id = pt.tag_id
     where pt.product_id = p.id
  ) tg on true
  where p.is_active;

comment on view catalog_items is
  'Каталогийн нэг мөр: үнэ («-аас эхлэх» ба зураастай), дууссан төлөв, зураг, '
  'таг. Зарагдах дүрэм нь variant_sellable() (0095) — савны түгжээг оруулна. '
  'src/features/products/api.ts дахь mapProduct()-ийн толь хувилбар.';

grant select on catalog_items to anon, authenticated;

------------------------------------------------------------------------------
-- 5. product_variants_for (0064) — багц угсрагчийн хэмжээнүүд.
--    `inStock` нь одооноос савны түгжээг ч агуулна (нэр хэвээр: UI-д
--    «энэ хэмжээг одоо авч болох уу» гэсэн ганц утга).
------------------------------------------------------------------------------

create or replace function product_variants_for(p_ids uuid[])
returns table (
  product_id   uuid,
  available_ml int,
  variants     jsonb
)
language sql
stable
set search_path = public, extensions
as $$
  select
    p.id,
    coalesce(inv.available_ml, 0),
    coalesce((
      select jsonb_object_agg(
               pv.ml::text,
               jsonb_build_object(
                 'variantId', pv.id,
                 'price', variant_price(pv.*),
                 'inStock', variant_sellable(
                   pv.*, p.gender, inv.is_sold_out, inv.available_ml)
               )
             )
        from product_variants pv
       where pv.product_id = p.id and pv.is_active
    ), '{}'::jsonb)
  from products p
  left join inventory inv on inv.product_id = p.id
  where p.is_active
    and p_ids is not null
    and cardinality(p_ids) > 0
    and p.id = any (p_ids);
$$;

comment on function product_variants_for is
  'Өгсөн барааны идэвхтэй хэмжээнүүд (variantId, үнэ, захиалж болох эсэх) ба '
  'боломжит үлдэгдэл. Зарагдах дүрэм: variant_sellable() (0095).';

revoke all on function product_variants_for(uuid[]) from public;
grant execute on function product_variants_for(uuid[]) to anon, authenticated;

------------------------------------------------------------------------------
-- 6. global_search (0082) — зөвхөн products_hit-ийн `sellable` мөр өөрчлөгдөв.
--    Гарын үсэг, оноо, эрэмбэ, бусад гурван эх бүгд ХЭВЭЭР.
------------------------------------------------------------------------------

create or replace function global_search(p_terms text[], p_limit int default 5)
returns table (
  kind text,
  id uuid,
  slug text,
  title text,
  subtitle text,
  image_url text,
  price int,
  sold_out boolean,
  item_count int,
  member_images text[],
  score real
)
language sql
stable
set search_path = public, extensions
as $$
  with args as (
    select
      (select array_agg('%' || t || '%') from unnest(p_terms) t) as patterns,
      coalesce(p_terms[1], '') as head,
      array_to_string(p_terms, ' ') as joined
  ),
  products_hit as (
    select
      'product'::text as kind,
      p.id, p.slug, p.name as title, p.brand as subtitle,
      (select pi.url
         from product_images pi
        where pi.product_id = p.id and pi.is_visible
        order by pi.sort_order
        limit 1) as image_url,
      v.starting_price as price,
      (v.sellable_count = 0) as sold_out,
      null::int as item_count,
      null::text[] as member_images,
      (case
         when p.search_text like a.head || '%' then 2
         when p.search_text like '% ' || a.head || '%' then 1
         else 0
       end
       + similarity(p.search_text, a.joined)
       - case when v.sellable_count = 0 then 0.5 else 0 end)::real as score
    from products p
    cross join args a
    left join inventory inv on inv.product_id = p.id
    join lateral (
      select
        count(*) filter (where sellable) as sellable_count,
        coalesce(
          min(eff_price) filter (where sellable),
          min(eff_price) filter (where pv.is_active),
          0
        )::int as starting_price
      from product_variants pv
      cross join lateral (
        select
          variant_price(pv.*) as eff_price,
          variant_sellable(pv.*, p.gender, inv.is_sold_out, inv.available_ml)
            as sellable
      ) c
      where pv.product_id = p.id
    ) v on true
    where p.is_active
      and p.search_text like all (a.patterns)
    order by score desc, p.name
    limit greatest(coalesce(p_limit, 5), 1)
  ),
  collections_hit as (
    select
      'collection'::text as kind,
      c.id, c.slug, c.name as title,
      (select string_agg(p.name, ' · ' order by ci.sort_order, p.name)
         from collection_items ci
         join products p on p.id = ci.product_id
        where ci.collection_id = c.id) as subtitle,
      c.image_url,
      null::int as price,
      false as sold_out,
      (select count(*)::int from collection_items ci where ci.collection_id = c.id) as item_count,
      (select array_agg(img order by ord)
         from (
           select ci.sort_order as ord,
                  (select pi.url
                     from product_images pi
                    where pi.product_id = ci.product_id and pi.is_visible
                    order by pi.sort_order
                    limit 1) as img
             from collection_items ci
            where ci.collection_id = c.id
            order by ci.sort_order
            limit 4
         ) m
        where img is not null) as member_images,
      (case
         when c.search_text like a.head || '%' then 2
         when c.search_text like '% ' || a.head || '%' then 1
         else 0
       end + similarity(c.search_text, a.joined))::real as score
    from collections c
    cross join args a
    where c.is_active
      and c.type = 'base'
      and c.user_id is null
      and c.search_text like all (a.patterns)
    order by score desc, c.name
    limit greatest(coalesce(p_limit, 5), 1)
  ),
  posts_hit as (
    select
      'post'::text as kind,
      b.id, b.slug, b.title, nullif(b.category, '') as subtitle,
      b.cover_url as image_url,
      null::int as price,
      false as sold_out,
      null::int as item_count,
      null::text[] as member_images,
      (case
         when b.search_text like a.head || '%' then 2
         when b.search_text like '% ' || a.head || '%' then 1
         else 0
       end + similarity(b.search_text, a.joined))::real as score
    from blog_posts b
    cross join args a
    where b.is_published
      and b.search_text like all (a.patterns)
    order by score desc, b.published_at desc
    limit greatest(coalesce(p_limit, 5), 1)
  ),
  brands_hit as (
    select
      'brand'::text as kind,
      br.id, br.slug, br.name as title, null::text as subtitle,
      br.logo_url as image_url,
      null::int as price,
      false as sold_out,
      (select count(*)::int from products p
        where p.is_active and lower(p.brand) = lower(br.name)) as item_count,
      null::text[] as member_images,
      (case
         when br.search_text like a.head || '%' then 2
         when br.search_text like '% ' || a.head || '%' then 1
         else 0
       end + similarity(br.search_text, a.joined))::real as score
    from brands br
    cross join args a
    where br.is_active
      and br.search_text like all (a.patterns)
    order by score desc, br.name
    limit greatest(coalesce(p_limit, 5), 1)
  )
  select * from products_hit
  union all select * from collections_hit
  union all select * from posts_hit
  union all select * from brands_hit;
$$;

comment on function global_search(text[], int) is
  'Глобал хайлт: бараа / багц / блог / брэнд. Барааны «дууссан» төлөв нь '
  'variant_sellable() (0095) — савны түгжээг ч агуулна.';

revoke all on function global_search(text[], int) from public;
grant execute on function global_search(text[], int) to anon, authenticated;

------------------------------------------------------------------------------
-- 7. place_order (0032) — савны түгжээг сүүлийн шатанд шалгана.
--
--    Сагс нь браузарын localStorage-д долоо хоногоор суудаг тул хаагдсаны
--    дараа ч хуучин мөр checkout хүртэл ирж болно. UI ба checkout-ийн
--    шалгалтууд нь эхний хамгаалалт, энэ нь ХАМГИЙН СҮҮЛИЙНХ.
--
--    0052-ын биетэй ЯГ адил (deliver_on орсон), зөвхөн эхний давталтад
--    шалгалт нэмэгдэв (шинэ хувьсагч: v_gender, v_override).
--
--    1ml бэлгийн sample нь bottle_stock-д мөргүй тул bottle_active() true
--    буцаана — бэлгийн урсгал хөндөгдөхгүй.
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
  v_gender gender_t;
  v_override boolean;
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
  update orders set subtotal = v_subtotal, discount = v_discount,
    loyalty_used = v_loyalty, total = v_total where id = v_order_id;

  insert into order_status_history (order_id, status, note, changed_by)
    values (v_order_id, 'pending', 'Захиалга үүсгэгдсэн', v_user);

  return jsonb_build_object('order_id', v_order_id, 'order_no', v_order_no, 'total', v_total);
end $$;

comment on function place_order(jsonb, jsonb) is
  'Захиалга үүсгэх: савны түгжээ (0095) → нөөц түгжих → мөр бичих → купон / '
  'V point. 0032-ын биет, савны шалгалт нэмэгдсэн.';
