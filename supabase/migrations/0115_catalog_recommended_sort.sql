-- Каталогийн анхны эрэмбэ «Санал болгох» (клиент, 2026-10-04).
--
-- Өмнө нь анхны эрэмбэ нэрээр (А-Я) байсан тул каталог «нэг хэвийн» харагдана
-- гэсэн санал ирэв. Клиентийн хүссэн дараалал:
--
--   1. Эрэлттэй — `hot` таг (0101, борлуулалтаар автомат)
--   2. Шинээр ирсэн — `new` таг (0100, сүүлд нэмэгдсэн 12)
--   3. Онцлох — `products.is_featured` (админ гараар)
--   4. Бусад
--
-- Эрэлттэй бүлэг дотроо борлуулалтаар, бусад бүлэг нэрээр (А-Я); дууссан
-- бараа бүгдээс ард. App талын толь:
-- `sortProducts()` (src/features/products/api.ts), анхны утга нь
-- `DEFAULT_CATALOG_SORT` (src/lib/constants.ts).
--
-- «Эрэлттэй» эрэмбэ (`popular`) мөн борлуулалтад шилжив: өмнө нь үнэлгээний
-- тоогоор (`rating_count`) эрэмбэлдэг байсан ч үнэлгээ одоохондоо ашиглагдахгүй.
-- Одоо нүүрний «Эрэлттэй» хэсэгтэй ижил `top_seller_products()` (0034) —
-- төлөгдсөн, бэлэг биш захиалгын ширхэгийн нийлбэр. Борлуулалтгүй ус ард,
-- дотроо шинэ нь түрүүлж.
--
-- Гарын үсэг (параметр, буцах багана) 0059-тэй ижил тул `create or replace`
-- хангалттай, эрх хэвээр үлдэнэ.

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
    created_at desc
  limit greatest(coalesce(p_per_page, 12), 1)
  offset greatest(coalesce(p_page, 1) - 1, 0) * greatest(coalesce(p_per_page, 12), 1);
$$;
