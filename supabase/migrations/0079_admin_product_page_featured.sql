-- Админы барааны жагсаалтад «Онцлох» шүүлт (0055-ын `products.is_featured`).
--
-- Нүүрийн «Онцлох» хэсэг тэр тэмдгээр бүрддэг ч админ «одоо аль нь онцлох
-- байна вэ» гэдгийг харах арга байгаагүй — жагсаалтаа бүхэлд нь гүйлгэж
-- мөр бүрийн тэмдгийг харах л үлдэж байв.
--
-- Шинэ параметр нь харагдац (`p_visibility`)-аас ХАМААРАЛГҮЙ: «идэвхтэй ба
-- онцлох» гэж асуух нь бодит хэрэгцээ тул хоёрыг нэг параметрт нийлүүлээгүй.
--
-- Гарын үсэг өөрчлөгдөж байгаа тул хуучин хувилбарыг ЭХЛЭЭД устгана:
-- `create or replace` нь өөр аргументийн жагсаалттай үед ХОЁР ДАХЬ функц
-- үүсгэдэг бөгөөд нэрлэсэн аргументаар дуудахад аль нь ч тохирч «function is
-- not unique» алдаа өгнө.
drop function if exists admin_product_page(text[], text, text, text, int, int);

create or replace function admin_product_page(
  -- Хэвийн болсон хайлтын үгс (TS-ийн `searchTerms()`). Мөр нь БҮХ үгийг
  -- агуулж байх ёстой — дэлгүүрийн хайлттай ижил дүрэм.
  p_terms      text[]  default null,
  -- 'active' | 'hidden' | null(бүгд)
  p_visibility text    default null,
  -- 'ok' | 'low' | 'soldout' | null(бүгд) — stock-state.ts-ийн дүрэм.
  p_stock      text    default null,
  -- 'brand' | 'price-asc' | 'price-desc' | 'stock' | null(нэрээр)
  p_sort       text    default null,
  p_page       int     default 1,
  p_per_page   int     default 50,
  -- true бол зөвхөн «Онцлох» тэмдэгтэй бараа; null/false бол бүгд.
  p_featured   boolean default null
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
           or (p_visibility = 'active' and p.is_active)
           or (p_visibility = 'hidden' and not p.is_active))
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

comment on function admin_product_page is
  'Админы барааны жагсаалтын нэг хуудас: шүүлт (хайлт, харагдац, үлдэгдэл, '
  'онцлох), эрэмбэ, хуудаслалт SQL дээр. Зөвхөн id-уудыг эрэмбийн дарааллаар '
  'ба таарсан нийт тоог буцаана.';

-- Эрхийг 0060-тай ижил: `anon`-оос хасаж, нэвтэрсэн хэрэглэгчид (ажилтны
-- шалгалт нь RLS дээр) олгоно.
revoke all on function admin_product_page(text[], text, text, text, int, int, boolean) from public;
revoke execute on function admin_product_page(text[], text, text, text, int, int, boolean) from anon;
grant execute on function admin_product_page(text[], text, text, text, int, int, boolean) to authenticated;
