-- Каталогийн «Хямдрал: их → бага» эрэмбэ (task 2.7).
--
-- `catalog_search` SQL дээр хуудаслагддаг тул эрэмбийн түлхүүр SQL-д байх
-- ёстой: `catalog_items`-ийн ТӨГСГӨЛД `sale_max_pct` (идэвхтэй хэмжээнүүдийн
-- хамгийн их хямдралын хувь) нэмж, `catalog_search`-д `p_sort = 'discount'`
-- мөр нэмнэ.
--
-- Хувь нь ЯГ одоо байгаа `eff` (= `variant_price`, 0181)-ээс — үнийн шинэ
-- дүрэм биш. TS-ийн толь: `salePct()` (src/features/products/sale.ts) —
-- round, хамгийн багадаа 1; хоёулаа зэрэг өөрчлөгдөх ёстой.
--
-- Expand only: view-д шинэ багана ТӨГСГӨЛД, функцийн гарын үсэг/буцаах
-- төрөл өөрчлөгдөхгүй (зөвхөн бие). Хуучин код `discount`-ийг илгээдэггүй →
-- зан төлөв хэвээр. Тугийн ард биш: уншилт л, юу ч хуримтлагдахгүй.
--
-- Бие нь 0181-ийнх; зөвхөн `sale_max_pct` ба `discount` мөр нэмэгдсэн.

create or replace view catalog_items with (security_invoker = true) as
  with ev as materialized (
    select product_id, ml, pct from live_event_discounts()
  )
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
    coalesce(v.sell_base, v.active_base, 0) as starting_base_price,
    -- 0193: ЗӨВХӨН төгсгөлд нэмнэ (create or replace view). Хямдралгүй = 0.
    coalesce(v.sale_max_pct, 0) as sale_max_pct
  from products p
  left join inventory inv on inv.product_id = p.id
  join lateral (
    select
      count(*) filter (where c.sellable) as sellable_count,
      array_agg(distinct pv.ml) filter (where c.sellable) as sellable_mls,
      (array_agg(c.eff order by c.eff) filter (where c.sellable))[1] as sell_price,
      (array_agg(pv.price order by c.eff) filter (where c.sellable))[1] as sell_base,
      (array_agg(c.eff order by c.eff) filter (where pv.is_active))[1] as active_price,
      (array_agg(pv.price order by c.eff) filter (where pv.is_active))[1] as active_base,
      -- 0193 (task 2.7): идэвхтэй хэмжээнүүдийн хамгийн их хямдралын хувь.
      max(case when c.eff < pv.price and pv.price > 0
               then greatest(1, round(100.0 * (pv.price - c.eff) / pv.price))::int
          end) filter (where pv.is_active) as sale_max_pct
    from product_variants pv
    left join ev on ev.product_id = pv.product_id and ev.ml = pv.ml
    cross join lateral (
      select
        least(pv.price,
              case when variant_manual_sale_active(pv.*) then pv.sale_price end,
              event_discount_price(pv.price, ev.pct)) as eff,
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
       and (p_featured is not true or c.is_featured)
       and (p_tags is null or cardinality(p_tags) = 0 or c.tags && p_tags)
       -- «ml боломж» = ЯГ ОДОО захиалж болох хэмжээ.
       and (p_mls is null or cardinality(p_mls) = 0 or c.sellable_mls && p_mls)
       and (p_min_price is null or c.starting_price >= p_min_price)
       and (p_max_price is null or c.starting_price <= p_max_price)
       -- Арга хэмжээ (0181): зөвхөн LIVE үеийн гишүүд; эс бөгөөс хоосон.
       and (p_event is null or p_event = ''
            or c.id in (select sale_event_product_ids(p_event)))
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
