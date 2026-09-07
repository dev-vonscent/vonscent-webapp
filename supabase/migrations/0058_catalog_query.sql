-- Каталогийн шүүлт, эрэмбэ, хуудаслалтыг өгөгдлийн сан руу зөөх (backlog H2).
--
-- Өмнөх байдал: каталогийн хуудас бүр `fetchProducts()`-оор БҮХ идэвхтэй
-- барааг зураг/хэмжээ/үлдэгдэл/тагийн хамт татаж аваад JS дотор шүүж, эрэмбэлж,
-- 12-оор нь зүсдэг байв. Өөрөөр хэлбэл 2-р хуудсыг харуулахын тулд ч бүх
-- каталогийг сүлжээгээр дамжуулна — бараа нэмэгдэх тусам шууд удаашрах бүтэц.
--
-- Одоо нэг RPC: шүүлт индекс дээр, эрэмбэ SQL-д, хуудас нь LIMIT/OFFSET-ээр,
-- нийт тоо нь `count(*) over ()`-ээр нэг л удаагийн уншилтаас гарна.
--
-- Үнэ бодох дүрэм нь JS-тэй ЯГ ижил байх ёстой (`mapProduct`):
--   * зарагдах хэмжээ = идэвхтэй + эх сав нь тухайн ml-ийг гүйцээж чадна;
--   * «-аас эхлэх» үнэ = зарагдах хэмжээнүүдийн хамгийн хямд нь, аль нь ч
--     байхгүй бол зүгээр идэвхтэй хэмжээнүүдийн хамгийн хямд нь;
--   * зураастай үнэ = ЯГ ТЭР хэмжээний үндсэн үнэ (0054);
--   * дууссан = зарагдах хэмжээ огт байхгүй.

------------------------------------------------------------------------------
-- 1. Каталогийн хуудас — шүүлт + эрэмбэ + хуудаслалт.
--
--    Хоосон массив нь «шүүлтгүй» гэсэн үг (null-тай адил) — клиент талаас
--    хоосон сонголт ирэхэд бүх бараа хэвээр харагдана.
--
--    SECURITY INVOKER (өгөгдмөл): RLS хэвээр үйлчилнэ, `is_active` шүүлт нь
--    зөвхөн давхар баталгаа.
------------------------------------------------------------------------------

create or replace function catalog_search(
  p_terms      text[]  default null,
  -- Тодорхой id-ууд (нүүрийн «Эрэлттэй» зэрэг эрэмбэлэгдсэн жагсаалт).
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
  with priced as (
    select
      p.id, p.slug, p.name, p.brand,
      p.gender::text as gender,
      p.concentration::text as concentration,
      p.scent_families,
      p.seasons::text[] as seasons,
      coalesce(p.is_featured, false) as is_featured,
      p.rating_avg, p.rating_count, p.created_at,
      -- Эхний ХАРАГДАХ зураг (0049) — админы сонгоогүй зураг дэлгүүрт гарахгүй.
      (select pi.url from product_images pi
        where pi.product_id = p.id and pi.is_visible
        order by pi.sort_order limit 1) as image_url,
      (select coalesce(nullif(pi.alt, ''), p.name) from product_images pi
        where pi.product_id = p.id and pi.is_visible
        order by pi.sort_order limit 1) as image_alt,
      coalesce(tg.kinds, '{}') as tags,
      v.sellable_count, v.sellable_mls,
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
    where p.is_active
      and (p_ids is null or cardinality(p_ids) = 0 or p.id = any (p_ids))
      and (p_terms is null or cardinality(p_terms) = 0
           or p.search_text like all (array(select '%' || t || '%' from unnest(p_terms) t)))
      and (p_brands is null or cardinality(p_brands) = 0 or p.brand = any (p_brands))
      and (p_genders is null or cardinality(p_genders) = 0 or p.gender::text = any (p_genders))
      and (p_families is null or cardinality(p_families) = 0 or p.scent_families && p_families)
      -- «all» = бүх улирал: аль ч улирлын шүүлтэд хариулна (JS-тэй ижил).
      and (p_seasons is null or cardinality(p_seasons) = 0
           or p.seasons::text[] && (p_seasons || array['all']))
      and (p_featured is not true or coalesce(p.is_featured, false))
  ),
  matched as (
    select *
      from priced
     where (p_tags is null or cardinality(p_tags) = 0 or tags && p_tags)
       -- «ml боломж» = ЯГ ОДОО захиалж болох хэмжээ.
       and (p_mls is null or cardinality(p_mls) = 0 or sellable_mls && p_mls)
       and (p_min_price is null or starting_price >= p_min_price)
       and (p_max_price is null or starting_price <= p_max_price)
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

comment on function catalog_search is
  'Каталогийн нэг хуудас: шүүлт, эрэмбэ, хуудаслалт бүгд SQL дээр. `total` нь '
  'шүүлтэд таарсан НИЙТ тоо (хуудасны тоо биш).';

revoke all on function catalog_search(text[], uuid[], text[], text[], text[], text[], text[], boolean, int[], int, int, text, int, int) from public;
grant execute on function catalog_search(text[], uuid[], text[], text[], text[], text[], text[], boolean, int[], int, int, text, int, int) to anon, authenticated;

------------------------------------------------------------------------------
-- 2. Шүүлтийн хажуугийн утгууд — брэндийн жагсаалт ба үнийн муж.
--
--    Хоёулаа өмнө нь бүх каталогийг санах ойд ачаалж бодогддог байв. Хоёр
--    тоог нэг дуудлагаар авна — каталогийн хуудсанд нэмэлт round-trip
--    үүсгэхгүй.
------------------------------------------------------------------------------

create or replace function catalog_facets()
returns table (brands text[], min_price int, max_price int)
language sql
stable
set search_path = public, extensions
as $$
  with priced as (
    select
      p.brand,
      coalesce(v.sell_price, v.active_price, 0) as starting_price
    from products p
    left join inventory inv on inv.product_id = p.id
    join lateral (
      select
        (array_agg(c.eff order by c.eff) filter (where c.sellable))[1] as sell_price,
        (array_agg(c.eff order by c.eff) filter (where pv.is_active))[1] as active_price
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
    where p.is_active
  )
  select
    coalesce((select array_agg(distinct brand order by brand) from priced), '{}'),
    coalesce((select min(starting_price)::int from priced where starting_price > 0), 0),
    coalesce((select max(starting_price)::int from priced where starting_price > 0), 0);
$$;

comment on function catalog_facets is
  'Каталогийн шүүлтэд хэрэгтэй хоёр утга: бараатай брэндүүд ба «-аас эхлэх» '
  'үнийн доод/дээд хязгаар.';

revoke all on function catalog_facets() from public;
grant execute on function catalog_facets() to anon, authenticated;
