-- Каталогийн «Таг» бүлэг дотроо OR (dev QA, A).
--
-- Өмнө нь `catalog_search`-д «Онцлох» (`p_featured`), таг (`p_tags`), арга
-- хэмжээ (`p_event`) гурав тус бүр AND байв: «Хямдралтай + Black Friday» →
-- зөвхөн BF, «Онцлох + Шинэ» → 0. Одоо нэг бүлэг: сонгосон аль нэгэнд орсон
-- бараа. Бусад бүлэг (брэнд, хүйс, үнэрийн төрөл, улирал, ml, үнэ, хайлт)
-- хоорондоо AND хэвээр.
--
-- TS-ийн толь: `matchesTagGroup` (src/features/products/tag-group.ts) —
-- DEMO зам ба багцын шүүлтүүр; хоёулаа зэрэг өөрчлөгдөх ёстой.
--
-- Expand only: гарын үсэг/буцаах төрөл өөрчлөгдөхгүй (зөвхөн бие). Бие нь
-- 0193-ийнх; зөвхөн бүлгийн нөхцөл өөрчлөгдсөн. Тугийн ард биш: уншилтын
-- шүүлт л, юу ч хуримтлагдахгүй.

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
  p_per_page   int     default 12,
  p_event      text    default null
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
    select c.*, coalesce(s.sold_qty, 0) as sold_qty
      from catalog_items c
      -- anon-д нээлттэй (0034); limit-гүй байхаар хамгийн их int.
      left join top_seller_products(2147483647) s on s.product_id = c.id
     where (p_ids is null or cardinality(p_ids) = 0 or c.id = any (p_ids))
       and (p_terms is null or cardinality(p_terms) = 0
            or c.search_text like all (array(select '%' || t || '%' from unnest(p_terms) t)))
       and (p_brands is null or cardinality(p_brands) = 0 or c.brand = any (p_brands))
       and (p_genders is null or cardinality(p_genders) = 0 or c.gender = any (p_genders))
       and (p_families is null or cardinality(p_families) = 0 or c.scent_families && p_families)
       -- «all» = бүх улирал: аль ч улирлын шүүлтэд хариулна (JS-тэй ижил).
       and (p_seasons is null or cardinality(p_seasons) = 0
            or c.seasons && (p_seasons || array['all']))
       -- 0194: «Таг» бүлэг (Онцлох, таг, арга хэмжээ) — бүлэг дотроо OR.
       -- Өгөгдөөгүй гишүүн «тааралгүй»; гурвуулаа өгөгдөөгүй бол шүүлтгүй.
       and (
         (coalesce(cardinality(p_tags), 0) = 0
          and p_featured is not true
          and coalesce(p_event, '') = '')
         or (coalesce(cardinality(p_tags), 0) > 0 and c.tags && p_tags)
         or (p_featured is true and c.is_featured)
         -- Арга хэмжээ (0181): зөвхөн LIVE үеийн гишүүд; эс бөгөөс хоосон.
         or (coalesce(p_event, '') <> ''
             and c.id in (select sale_event_product_ids(p_event)))
       )
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
    -- «Онцлох» жагсаалт ба «Санал болгох»: дууссан бараа хамгийн ард.
    case when p_sort in ('featured', 'recommended') then (sellable_count = 0) end asc,
    -- «Санал болгох»: Эрэлттэй → Шинэ → Онцлох → бусад. Нэг ус хэд хэдэн
    -- бүлэгт орвол хамгийн өндөрт нь харагдана.
    case when p_sort = 'recommended' then
      case
        when 'hot' = any (tags) then 0
        when 'new' = any (tags) then 1
        when is_featured        then 2
        else 3
      end
    end asc,
    case when p_sort = 'recommended' and 'hot' = any (tags) then sold_qty end desc,
    case when p_sort = 'recommended' then name end asc,
    case when p_sort = 'price_asc'  then starting_price end asc,
    case when p_sort = 'price_desc' then starting_price end desc,
    case when p_sort = 'name'       then name end asc,
    case when p_sort = 'popular'    then sold_qty end desc,
    -- 0193 (task 2.7): «Хямдрал: их → бага» — барааны хамгийн их хувиар.
    case when p_sort = 'discount'   then sale_max_pct end desc,
    created_at desc
  limit greatest(coalesce(p_per_page, 12), 1)
  offset greatest(coalesce(p_page, 1) - 1, 0) * greatest(coalesce(p_per_page, 12), 1);
$$;
