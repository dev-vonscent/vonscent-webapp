-- «Тун удахгүй» төлөв: барааг ирэхээс нь өмнө зураг, мэдээлэл, үнэтэй нь
-- оруулж, сайтад харуулах боловч захиалуулахгүй.
--
-- Барааны амьдралын мөчлөг одоо `products.status`-д:
--   hidden      — сайтад огт харагдахгүй (хуучин `is_active = false`);
--   coming_soon — барааны хуудас, нүүрний «Тун удахгүй» хэсэгт харагдана,
--                 захиалж болохгүй;
--   active      — зарагдана (хуучин `is_active = true`).
--
-- `is_active` хэвээр үлдэнэ: каталог, хайлт, тагууд, захиалга зэрэг олон
-- газар үүгээр шүүдэг (SQL, TS хоёуланд). Generated багана болгоогүй нь
-- санаатай — RLS, index, view, функцүүд үүнээс хамаардаг тул prod дээр
-- drop/add хийх нь эрсдэлтэй. Оронд нь доорх trigger хоёрыг үргэлж нийцүүлж,
-- check constraint нь зөрөхийг хориглоно. Тиймээс «Тун удахгүй» бараа
-- `is_active = false` бөгөөд захиалга, сагс, багц, бэлэг, «Шинэ» таг бүгдээс
-- өөрөө хасагдана.
--
-- `launched_at` — бараа АНХ худалдаанд гарсан мөч, дараа нь хэзээ ч
-- өөрчлөгдөхгүй. Хоёр үүрэгтэй:
--   * «Шинэ» таг үүгээр эрэмбэлэгдэнэ (өмнө нь `created_at`). Урьдчилан
--     оруулсан бараа хэдэн долоо хоногийн дараа ирэхэд `created_at` нь хуучин
--     тул сүүлийн 12-т орохгүй байх байсан.
--   * Нэг удаа гарсан барааг дахин «Тун удахгүй» болгохыг хориглоно — админ
--     санамсаргүй сольж бараа каталогоос алга болохоос сэргийлнэ. Дахин
--     захиалсан ус «Дууссан» хэвээр байж, үлдэгдэл нэмэхэд л дахин зарагдана.

-- ── 1. Төлөв, баганууд ────────────────────────────────────────────────────
do $$ begin
  create type product_status_t as enum ('hidden', 'coming_soon', 'active');
exception when duplicate_object then null; end $$;

alter table products
  add column if not exists status product_status_t,
  add column if not exists launched_at timestamptz,
  add column if not exists coming_soon_note text;

-- Backfill. `launched_at`-ийг ОДОО БАЙГАА БҮХ бараанд `created_at`-аар
-- бөглөнө: нуусан бараа өмнө нь нийтлэгдэж байсан эсэхийг schema-аас таних
-- арга байхгүй тул болгоомжтой тал руу — хуучин бараа хэзээ ч «Тун удахгүй»
-- болохгүй. Ингэснээр одоогийн «Шинэ» 12 ус ч яг хэвээр үлдэнэ.
--
-- Зөвхөн анх удаа (доорх trigger үүсэхээс өмнө): дахин ажиллуулахад
-- «Тун удахгүй» бараанд `launched_at` бөглөгдөж ALREADY_LAUNCHED-аар унах ёсгүй.
do $$ begin
  if not exists (select 1 from pg_trigger
                  where tgname = 'products_status_sync'
                    and tgrelid = 'products'::regclass) then
    update products
       set status = case when is_active then 'active'::product_status_t
                         else 'hidden'::product_status_t end
     where status is null;
    update products set launched_at = created_at where launched_at is null;
  end if;
end $$;

alter table products alter column status set not null;

-- Хоёр баганын default-ыг авна: INSERT-ийн trigger аль нь ИЛГЭЭГДСЭНИЙГ
-- ялгах ёстой. `is_active default true` үлдвэл зөвхөн `status = 'coming_soon'`
-- илгээсэн мөр «хоёр зөрүүтэй утга» гэж харагдана. NOT NULL нь BEFORE
-- trigger-ийн ДАРАА шалгагддаг тул trigger бөглөж амжина.
alter table products alter column is_active drop default;
alter table products alter column status drop default;

do $$ begin
  alter table products
    add constraint products_status_is_active_check
    check (is_active = (status = 'active'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table products
    add constraint products_coming_soon_note_len
    check (coming_soon_note is null or char_length(coming_soon_note) <= 120);
exception when duplicate_object then null; end $$;

comment on column products.status is
  'Барааны амьдралын мөчлөг (0125). is_active = (status = ''active'') — trigger тохируулна.';
comment on column products.launched_at is
  'Анх худалдаанд гарсан мөч (0125). Өөрчлөгдөхгүй; «Шинэ» таг үүгээр эрэмбэлэгдэнэ.';
comment on column products.coming_soon_note is
  '«Тун удахгүй» үеийн ойролцоо хугацаа, ж: «10-р сарын сүүлээр» (0125).';

-- ── 2. status ↔ is_active, launched_at-ийн дүрэм ──────────────────────────
--
-- INSERT:
--   status өгсөн, is_active өгөөгүй  → is_active := status = 'active'
--   is_active өгсөн, status өгөөгүй  → true → active, false → hidden (хуучин код)
--   хоёуланг өгсөн, зөрүүтэй         → STATUS_ACTIVE_MISMATCH
--   аль нь ч өгөөгүй                 → active (хуучин `is_active default true`)
-- UPDATE:
--   зөвхөн status өөрчлөгдсөн        → is_active дагана
--   зөвхөн is_active өөрчлөгдсөн     → status дагана (хуучин код)
--   хоёулаа өөрчлөгдөж, зөрүүтэй     → STATUS_ACTIVE_MISMATCH
--   («өөрчлөгдсөн» = хуучин утгаас ялгаатай. SET-д хуучин утгаа давтсан
--   багана өөрчлөгдөөгүйтэй ижил — тэр үед status давуу.)
-- Хоёуланд:
--   active болж, launched_at хоосон  → launched_at бөглөнө
--   launched_at-тэй бараа coming_soon → ALREADY_LAUNCHED
--   launched_at-ийг өөрчлөх/арилгах  → LAUNCHED_AT_IMMUTABLE
create or replace function products_status_sync()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is null and new.is_active is null then
      new.status := 'active';
    elsif new.status is null then
      new.status := case when new.is_active then 'active'::product_status_t
                         else 'hidden'::product_status_t end;
    end if;
    if new.is_active is null then
      new.is_active := new.status = 'active';
    elsif new.is_active is distinct from (new.status = 'active') then
      raise exception 'STATUS_ACTIVE_MISMATCH'
        using errcode = 'check_violation';
    end if;
    if new.status = 'active' and new.launched_at is null then
      -- Импорт, clone нь түүхэн `created_at`-тай мөр оруулдаг — тэр мөч нь
      -- бодит нийтлэгдсэн огноонд хамгийн ойр.
      new.launched_at := coalesce(new.created_at, now());
    end if;
  else
    if new.status is distinct from old.status
       and new.is_active is not distinct from old.is_active then
      new.is_active := new.status = 'active';
    elsif new.is_active is distinct from old.is_active
          and new.status is not distinct from old.status then
      new.status := case when new.is_active then 'active'::product_status_t
                         else 'hidden'::product_status_t end;
    elsif new.is_active is distinct from (new.status = 'active') then
      raise exception 'STATUS_ACTIVE_MISMATCH'
        using errcode = 'check_violation';
    end if;
    if old.launched_at is not null
       and new.launched_at is distinct from old.launched_at then
      raise exception 'LAUNCHED_AT_IMMUTABLE'
        using errcode = 'check_violation';
    end if;
    if new.status = 'active' and new.launched_at is null then
      new.launched_at := now();
    end if;
  end if;

  if new.status = 'coming_soon' and new.launched_at is not null then
    raise exception 'ALREADY_LAUNCHED'
      using errcode = 'check_violation';
  end if;
  -- Ойролцоо хугацаа нь зөвхөн «Тун удахгүй» үед утгатай. Худалдаанд гарсны
  -- дараа үлдвэл хуучирсан огноо хаа нэгтээ дахин гарч ирэх эрсдэлтэй.
  if new.status = 'active' then
    new.coming_soon_note := null;
  end if;
  new.coming_soon_note := nullif(btrim(coalesce(new.coming_soon_note, '')), '');
  return new;
end;
$$;

drop trigger if exists products_status_sync on products;
create trigger products_status_sync
  before insert or update on products
  for each row execute function products_status_sync();

-- ── 3. «Шинэ» таг: launched_at-аар ────────────────────────────────────────
-- Бие нь 0100-ийнх, зөвхөн эрэмбэ солигдов. trg_refresh_new_tag() (0103-ийн
-- new + hot + sale нийлмэл хувилбар) өөрчлөгдөхгүй.
create or replace function refresh_new_tag()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tag uuid;
begin
  select id into v_tag from tags where kind = 'new' order by slug limit 1;
  if v_tag is null then
    return;
  end if;

  perform set_config('vonscent.new_tag_sync', 'on', true);

  delete from product_tags pt
   where pt.tag_id = v_tag
     and pt.product_id not in (
       select p.id from products p
        where p.status = 'active'
        order by p.launched_at desc, p.id desc
        limit 12);

  insert into product_tags (product_id, tag_id)
  select p.id, v_tag
    from products p
   where p.status = 'active'
   order by p.launched_at desc, p.id desc
   limit 12
  on conflict do nothing;

  perform set_config('vonscent.new_tag_sync', 'off', true);
end;
$$;

revoke all on function refresh_new_tag() from public, anon, authenticated;

-- `update of` нь UPDATE-ийн SET жагсаалтыг хардаг, BEFORE trigger-ийн
-- өөрчлөлтийг биш — зөвхөн `status` илгээсэн бичилт ч өдөөх ёстой.
drop trigger if exists products_refresh_new_tag on products;
create trigger products_refresh_new_tag
  after insert or delete or update of is_active, status, launched_at on products
  for each statement execute function trg_refresh_new_tag();

-- ── 3b. Каталогийн «Шинэ» эрэмбэ: launched_at-аар ─────────────────────────
-- Бие нь 0095-ынх, зөвхөн `created_at` багана нь худалдаанд гарсан мөч
-- болов. Дэлгүүрт энэ баганыг зөвхөн «Шинэ» эрэмбэ (catalog_search,
-- related_products, нүүрний «Шинэ» хэсэг) уншдаг — өөр утгаар харуулдаггүй.
-- Үгүй бол урьдчилан оруулсан ус «Шинэ» тагтай болсон ч жагсаалтынхаа ард
-- орно. View нь `is_active`-аар шүүдэг тул launched_at энд хоосон байхгүй;
-- coalesce нь зөвхөн хамгаалалт.
create or replace view catalog_items with (security_invoker = true) as
  select
    p.id, p.slug, p.name, p.brand,
    p.gender::text as gender,
    p.concentration::text as concentration,
    p.scent_families,
    p.seasons::text[] as seasons,
    coalesce(p.is_featured, false) as is_featured,
    p.rating_avg, p.rating_count,
    coalesce(p.launched_at, p.created_at) as created_at,
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

-- ── 4. RLS: «Тун удахгүй» бараа нийтэд уншигдана ─────────────────────────
-- Дэлгүүрийн бүх уншилт (`catalog_items`, RPC-үүд, TS query) `is_active`-аар
-- тусдаа шүүдэг тул каталог, хайлт, сагсанд орохгүй — зөвхөн тусгайлан
-- зөвшөөрсөн газар (барааны хуудас, «Тун удахгүй» хэсэг, wishlist).
drop policy if exists "products read" on products;
create policy "products read" on products for select
  using (status in ('active', 'coming_soon') or is_staff());

-- ── 5. Админы жагсаалт: «Тун удахгүй» шүүлтүүр ───────────────────────────
-- Бие нь 0079-ийнх. «Нуусан» нь одоо зөвхөн `hidden` (өмнө нь `not
-- is_active` — «Тун удахгүй»-г ч хамрах байсан).
create or replace function admin_product_page(
  p_terms text[] default null,
  p_visibility text default null,
  p_stock text default null,
  p_sort text default null,
  p_page int default 1,
  p_per_page int default 50,
  p_featured boolean default null
)
returns table (total bigint, id uuid)
language sql
stable
set search_path = public, extensions
as $$
  with rows_ as (
    select
      p.id,
      p.name,
      p.brand,
      coalesce(inv.available_ml, 0) as available_ml,
      -- Үлдэгдлийн босго: 0048-ын өгөгдмөл (DEFAULT_LOW_STOCK_ML = 50).
      coalesce(inv.low_stock_ml, 50) as low_stock_ml,
      -- Жагсаалтын «-аас» үнэ = ИДЭВХТЭЙ хэмжээнүүдийн бодитоор төлөх хамгийн
      -- хямд дүн (mapAdminProduct-тай ижил — үлдэгдэл энд оролцохгүй).
      coalesce((
        select min(variant_price(pv.*))::int
          from product_variants pv
         where pv.product_id = p.id and pv.is_active
      ), 0) as starting_price
    from products p
    left join inventory inv on inv.product_id = p.id
    where (p_visibility is null or p_visibility = ''
           or (p_visibility = 'active' and p.status = 'active')
           or (p_visibility = 'hidden' and p.status = 'hidden')
           or (p_visibility = 'coming_soon' and p.status = 'coming_soon'))
      and (p_featured is not true or p.is_featured)
      and (p_terms is null or cardinality(p_terms) = 0
           or p.search_text like all (array(select '%' || t || '%' from unnest(p_terms) t)))
  ),
  matched as (
    select *
      from rows_
     where p_stock is null or p_stock = ''
        -- stockState(): 0-оос доош = дууссан, босгондоо хүрсэн нь аль хэдийн бага.
        or (p_stock = 'soldout' and available_ml <= 0)
        or (p_stock = 'low'     and available_ml > 0 and available_ml <= low_stock_ml)
        or (p_stock = 'ok'      and available_ml > low_stock_ml)
  )
  select count(*) over () as total, id
    from matched
   order by
     case when p_sort = 'brand'       then brand end asc,
     case when p_sort = 'price-asc'   then starting_price end asc,
     case when p_sort = 'price-desc'  then starting_price end desc,
     case when p_sort = 'stock'       then available_ml end asc,
     name asc,
     -- Хуудаслалтын тогтвортой байдал: ижил нэр/үнэтэй хоёр бараа хуудас
     -- хооронд байраа солиод нэг нь ХОЁР УДАА, нөгөө нь огт харагдахгүй
     -- болохоос сэргийлнэ.
     id asc
   limit greatest(coalesce(p_per_page, 50), 1)
  offset greatest(coalesce(p_page, 1) - 1, 0) * greatest(coalesce(p_per_page, 50), 1);
$$;

-- ── 6. Худалдаанд гаргах ──────────────────────────────────────────────────
-- Засах хуудасны анхааруулга, нөөц нэмсний дараах асуулт, жагсаалтын мөрийн
-- үйлдэл гурвуулаа ЭНЭ ганц замаар явна. Нөхцөлтэй UPDATE тул хуучирсан
-- дэлгэцээс дарсан ч зөвхөн одоо «Тун удахгүй» байгаа барааг гаргана.
--   'launched'       — одоо гарлаа
--   'already_active' — аль хэдийн гарсан (давхар дарсан) — амжилт гэж үзнэ
--   'not_coming_soon'— өөр төлөвтэй (ж: хэн нэг нь нуусан)
--   'not_found'
create or replace function launch_product(p_id uuid)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_status product_status_t;
begin
  update products set status = 'active'
   where id = p_id and status = 'coming_soon';
  if found then
    return 'launched';
  end if;
  select status into v_status from products where id = p_id;
  if v_status is null then
    return 'not_found';
  elsif v_status = 'active' then
    return 'already_active';
  end if;
  return 'not_coming_soon';
end;
$$;

revoke all on function launch_product(uuid) from public, anon, authenticated;
grant execute on function launch_product(uuid) to service_role;

-- ── 7. place_order: мөр бүрийг өөрөө шалгана ─────────────────────────────
-- Бие нь 0104-ийнх; эхний давталтад шалгалт нэмэгдэв. Route нь серверт
-- үнэлсэн мөрүүдийг л илгээдэг (checkout/api.ts) — гэхдээ тэр шалгалт ба
-- энэ транзакцын хооронд админ барааг нууж/«Тун удахгүй» болгож болно. Бараа
-- мөрийг `for share`-ээр түгжсэн тул шалгасны дараа төлөв нь энэ захиалга
-- дуусталаа өөрчлөгдөхгүй.
--
-- Бүтэлгүйтвэл `ITEMS_UNAVAILABLE:<variant_id>` — route нь үүнийг одоо
-- байгаа 409 ITEMS_UNAVAILABLE хариу руу хөрвүүлнэ (бэлгийн мөрөнд хэмжээ
-- байхгүй тул id хоосон).
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
    if v_variant is not null then
      perform 1 from product_variants pv
        where pv.id = v_variant
          and pv.product_id = v_product
          and pv.ml = v_ml
          and pv.is_active;
      if not found then
        raise exception 'ITEMS_UNAVAILABLE:%', v_variant
          using errcode = 'check_violation';
      end if;
    elsif not v_gift then
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
