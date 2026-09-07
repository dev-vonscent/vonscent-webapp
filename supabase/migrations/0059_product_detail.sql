-- Барааны дэлгэрэнгүй хуудсыг өгөгдлийн сан руу зөөх (backlog H2).
--
-- Өмнөх байдал: `/products/[slug]` хуудас нэг барааг харуулахын тулд
-- `fetchProducts()`-оор БҮХ идэвхтэй барааг (зураг, хэмжээ, үлдэгдэл, таг)
-- татаж аваад JS дотор `find()` хийж, дараа нь «Төстэй бараа»-г мөн бүх
-- каталог дээр гүйж оноо бодож байв. Өөрөөр хэлбэл хамгийн их хандалттай
-- хуудас нь каталогийн хэмжээнээс шууд хамаарч удаашрах бүтэцтэй байсан.
--
-- Одоо:
--   * дэлгэрэнгүй өөрөө нэг мөрийн уншилт болов (TS тал, PostgREST шүүлтээр);
--   * «Төстэй бараа» нь `related_products()` дотор SQL дээр бодогдоно.
--
-- Оноог бодохын тулд каталогийн мөр бүрийн ҮНЭ / ДУУССАН эсэх хэрэгтэй бөгөөд
-- тэр логик 0058-д `catalog_search()` дотор шууд бичигдсэн байв. Хоёр газар
-- хуулбарлавал хэзээ нэгэн цагт зөрөх тул түүнийг `catalog_items` VIEW болгож
-- гаргаад, `catalog_search()` ба `related_products()` хоёул түүнээс уншина —
-- үнийн дүрэм цаашид ганц газарт үлдэнэ.

------------------------------------------------------------------------------
-- 1. `catalog_items` — каталогийн нэг мөр, үнэ/дууссан төлөв нь бодогдсон.
--
--    Дүрэм нь `mapProduct()` (TS)-тэй ЯГ ижил:
--      * зарагдах хэмжээ = идэвхтэй + эх сав нь тухайн ml-ийг гүйцээж чадна;
--      * «-аас эхлэх» үнэ = зарагдах хэмжээнүүдийн хамгийн хямд нь, аль нь ч
--        байхгүй бол зүгээр идэвхтэй хэмжээнүүдийн хамгийн хямд нь;
--      * зураастай үнэ = ЯГ ТЭР хэмжээний үндсэн үнэ (0054);
--      * дууссан = зарагдах хэмжээ огт байхгүй.
--
--    `security_invoker` — RLS нь дуудагчийн эрхээр үйлчилнэ (products-ийн
--    "products read" бодлого: `is_active or is_staff()`); доорх `p.is_active`
--    нь давхар баталгаа.
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
    -- Эхний ХАРАГДАХ зураг (0049) — админы сонгоогүй зураг дэлгүүрт гарахгүй.
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
        pv.is_active
          and not coalesce(inv.is_sold_out, false)
          and coalesce(inv.available_ml, 0) >= pv.ml as sellable
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
  'таг. src/features/products/api.ts дахь mapProduct()-ийн толь хувилбар — '
  'catalog_search() ба related_products() хоёул эндээс уншина.';

grant select on catalog_items to anon, authenticated;

------------------------------------------------------------------------------
-- 2. `catalog_search()` — 0058-ийнхтэй ЯГ ИЖИЛ гаралт, зөвхөн үнийн логикоо
--    дээрх view-ээс авдаг болов (гарын үсэг, эрэмбэ, шүүлт бүгд хэвээр).
------------------------------------------------------------------------------

create or replace function catalog_search(
  p_terms      text[]  default null,
  p_ids        uuid[]  default null,
  p_brands     text[]  default null,
  p_genders    text[]  default null,
  p_families   text[]  default null,
  p_seasons    text[]  default null,
  p_tags       text[]  default null,
  p_featured   boolean default null,
  p_mls        int[]   default null,
  p_min_price  int     default null,
  p_max_price  int     default null,
  p_sort       text    default 'new',
  p_page       int     default 1,
  p_per_page   int     default 12
)
returns table (
  total               bigint,
  id                  uuid,
  slug                text,
  name                text,
  brand               text,
  gender              text,
  concentration       text,
  scent_families      text[],
  seasons             text[],
  image_url           text,
  image_alt           text,
  starting_price      int,
  starting_base_price int,
  tags                text[],
  is_featured         boolean,
  sold_out            boolean,
  rating_avg          numeric,
  rating_count        int,
  created_at          timestamptz
)
language sql
stable
set search_path = public, extensions
as $$
  with matched as (
    select *
      from catalog_items c
     where (p_ids is null or cardinality(p_ids) = 0 or c.id = any (p_ids))
       and (p_terms is null or cardinality(p_terms) = 0
            or c.search_text like all (array(select '%' || t || '%' from unnest(p_terms) t)))
       and (p_brands is null or cardinality(p_brands) = 0 or c.brand = any (p_brands))
       and (p_genders is null or cardinality(p_genders) = 0 or c.gender = any (p_genders))
       and (p_families is null or cardinality(p_families) = 0 or c.scent_families && p_families)
       -- «all» = бүх улирал: аль ч улирлын шүүлтэд хариулна (JS-тэй ижил).
       and (p_seasons is null or cardinality(p_seasons) = 0
            or c.seasons && (p_seasons || array['all']))
       and (p_featured is not true or c.is_featured)
       and (p_tags is null or cardinality(p_tags) = 0 or c.tags && p_tags)
       -- «ml боломж» = ЯГ ОДОО захиалж болох хэмжээ.
       and (p_mls is null or cardinality(p_mls) = 0 or c.sellable_mls && p_mls)
       and (p_min_price is null or c.starting_price >= p_min_price)
       and (p_max_price is null or c.starting_price <= p_max_price)
  )
  select
    count(*) over () as total,
    id, slug, name, brand, gender, concentration, scent_families, seasons,
    image_url, image_alt, starting_price, starting_base_price, tags,
    is_featured, (sellable_count = 0) as sold_out,
    rating_avg, rating_count, created_at
  from matched
  order by
    -- «Онцлох» жагсаалт: дууссан бараа хамгийн ард (нүүрийн хэсэг).
    case when p_sort = 'featured'   then (sellable_count = 0) end asc,
    case when p_sort = 'price_asc'  then starting_price end asc,
    case when p_sort = 'price_desc' then starting_price end desc,
    case when p_sort = 'name'       then name end asc,
    case when p_sort = 'popular'    then rating_count end desc,
    created_at desc
  limit greatest(coalesce(p_per_page, 12), 1)
  offset greatest(coalesce(p_page, 1) - 1, 0) * greatest(coalesce(p_per_page, 12), 1);
$$;

------------------------------------------------------------------------------
-- 3. `related_products()` — «Төстэй бараа», оноо нь SQL дээр.
--
--    Оноо нь `getRelated()` (TS)-ийн ЯГ тэр жинтэй:
--      үнэрийн бүл ×4 · брэнд +3 · хүйс +2 · улирал ×2 · концентрац +1 ·
--      маркетингийн таг ×1 · админы нэмэлт таг ×2.
--    Оноогүй (0) бараа санал болгогдохгүй — санамсаргүй бараа зөвлөхөөс
--    хоосон байсан нь дээр.
------------------------------------------------------------------------------

create or replace function related_products(
  p_slug  text,
  p_limit int default 4
)
returns table (
  id                  uuid,
  slug                text,
  name                text,
  brand               text,
  gender              text,
  concentration       text,
  scent_families      text[],
  seasons             text[],
  image_url           text,
  image_alt           text,
  starting_price      int,
  starting_base_price int,
  tags                text[],
  is_featured         boolean,
  sold_out            boolean,
  rating_avg          numeric,
  rating_count        int,
  created_at          timestamptz
)
language sql
stable
set search_path = public, extensions
as $$
  with me as (
    select
      p.id,
      p.brand,
      p.gender::text as gender,
      p.concentration::text as concentration,
      coalesce(p.scent_families, '{}') as families,
      coalesce(p.seasons::text[], '{}') as seasons,
      coalesce((
        select array_agg(t.kind::text)
          from product_tags pt join tags t on t.id = pt.tag_id
         where pt.product_id = p.id), '{}') as tags,
      coalesce((
        select array_agg(ct.slug)
          from product_custom_tags pct join custom_tags ct on ct.id = pct.tag_id
         where pct.product_id = p.id), '{}') as ctags
    from products p
    where p.slug = p_slug and p.is_active
  ),
  scored as (
    select
      c.*,
      (
        -- Хуваалцсан бүл/улирал бүр тоологдоно: хоёр бүл нь таарсан үнэр нь
        -- нэг нь таарсанаас дээгүүр гарна.
        4 * (select count(*) from unnest(coalesce(c.scent_families, '{}')) f
              where f = any (me.families))
      + case when c.brand = me.brand then 3 else 0 end
      + case when c.gender = me.gender then 2 else 0 end
      + 2 * (select count(*) from unnest(coalesce(c.seasons, '{}')) s
              where s = any (me.seasons))
      + case when c.concentration = me.concentration then 1 else 0 end
      + (select count(*) from unnest(coalesce(c.tags, '{}')) t
          where t = any (me.tags))
      -- Админы нэмэлт таг (0044) нь хэрэглээ/шинжийг илэрхийлдэг тул хүнд.
      + 2 * (select count(*) from unnest(coalesce(ct.slugs, '{}')) x
              where x = any (me.ctags))
      ) as score
    from catalog_items c
    cross join me
    left join lateral (
      select array_agg(ct2.slug) as slugs
        from product_custom_tags pct
        join custom_tags ct2 on ct2.id = pct.tag_id
       where pct.product_id = c.id
    ) ct on true
    where c.id <> me.id
  )
  select
    id, slug, name, brand, gender, concentration, scent_families, seasons,
    image_url, image_alt, starting_price, starting_base_price, tags,
    is_featured, (sellable_count = 0) as sold_out,
    rating_avg, rating_count, created_at
  from scored
  where score > 0
  order by score desc, name
  limit greatest(coalesce(p_limit, 4), 1);
$$;

comment on function related_products(text, int) is
  'Төстэй бараа: хуваалцсан шинж чанараар оноолж эрэмбэлнэ. '
  'src/features/products/api.ts дахь getRelated()-ийн толь хувилбар.';

revoke all on function related_products(text, int) from public;
grant execute on function related_products(text, int) to anon, authenticated;
