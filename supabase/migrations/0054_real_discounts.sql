-- Бодит хямдрал: хэмжээ (variant) тус бүр өөрийн хямдарсан үнэтэй болно
-- (backlog B1–B6, клиентийн 2026-09-02-ны шийдвэр №1).
--
-- Өмнө нь хямдрал нь ЗӨВХӨН ХАРАГДАЦ байсан: `products.sale_pct` (0038) нь
-- төлөх үнийг огт хөдөлгөдөггүй, зөвхөн зураастай «хуучин үнэ»-г
-- `price / (1 - pct)` гэж ЗОХИОМЛООР ухраан боддог байв. Одоо эсрэгээрээ:
--   * `product_variants.price`      = үндсэн (зураастай харагдах) үнэ;
--   * `product_variants.sale_price` = хямдарсан, БОДИТООР төлөх үнэ (null бол
--     хямдрал байхгүй).
-- Ингэснээр хямдрал нь сагс, захиалга, тайлан бүхэнд бодитоор буурна.

------------------------------------------------------------------------------
-- 1. Хэмжээ тус бүрийн хямдарсан үнэ.
------------------------------------------------------------------------------

alter table public.product_variants
  add column if not exists sale_price int;

do $$
begin
  alter table public.product_variants
    add constraint product_variants_sale_price_range
    check (sale_price is null or (sale_price >= 0 and sale_price <= price));
exception
  when duplicate_object then null;
end $$;

------------------------------------------------------------------------------
-- 2. Хуучин `sale_pct`-ийг хэмжээний түвшинд нүүлгэнэ (B2).
--
--    Одоо худалдан авагчийн ХАРЖ БАЙГАА зураг яг хэвээрээ үлдэх ёстой:
--    өнөөдөр төлж буй үнэ нь хямдарсан үнэ болно, харин зохиомлоор бодогдож
--    байсан «хуучин үнэ» нь эндээс хойш жинхэнэ багана болж хадгалагдана.
--    100₮-руу дугуйрсан нь storefront-ын өмнөх тооцоотой ижил.
------------------------------------------------------------------------------

update public.product_variants pv
   set sale_price = pv.price,
       price = greatest(
                 pv.price,
                 (round(pv.price / (1 - p.sale_pct / 100.0) / 100) * 100)::int
               )
  from public.products p
 where p.id = pv.product_id
   and p.sale_pct > 0
   and p.sale_pct < 100
   and pv.price > 0
   and pv.sale_price is null;

alter table public.products drop column if exists sale_pct;

------------------------------------------------------------------------------
-- 3. Төлбөр тооцох цорын ганц цэг.
--
--    Захиалгын бүх RPC (0008/0015/0020/0025/0032/0052) үнээ `variant_price()`
--    -ээр авдаг тул энэ функцийг дахин тодорхойлоход сервер тал бүхэлдээ
--    хямдарсан үнээр тооцох болно (B3).
------------------------------------------------------------------------------

create or replace function variant_price(v product_variants)
returns int language sql immutable as $$
  select coalesce(v.sale_price, v.price);
$$;

------------------------------------------------------------------------------
-- 4. Preset багцын тогтмол үнэ (B6).
--
--    Багцын үнэ өнөөг хүртэл «гишүүдийн үнийн нийлбэрээс хувь хасах» гэж
--    АМЬДААР бодогддог. Гишүүн барааны хямдрал шууд багцын үнийг өөрчилнө —
--    энэ нь шинэ шаардлагатай зөрчилдөнө. Тиймээс хэмжээ бүрт админ тогтмол
--    үнэ бичиж болно: тогтмол үнэ = эцсийн үнэ, гишүүдийн нийлбэр нь зөвхөн
--    «хэмнэлт» харуулахад үлдэнэ.
--
--    Хүснэгтийн нэр (`collection_ml_discounts`) хэвээр — 0051-ийн мөрүүд ба
--    RLS бодлого нь хэвээрээ үйлчилнэ, зөвхөн `price` багана нэмэгдэв.
------------------------------------------------------------------------------

alter table public.collection_ml_discounts
  add column if not exists price int;

do $$
begin
  alter table public.collection_ml_discounts
    add constraint collection_ml_discounts_price_range
    check (price is null or price >= 0);
exception
  when duplicate_object then null;
end $$;

-- Тухайн хэмжээнд ЗӨВХӨН тогтмол үнэ өгөх боломжтой болгохын тулд хувь нь
-- сонголттой болов (null бол багцын үндсэн хувь үйлчилнэ).
alter table public.collection_ml_discounts
  alter column discount_pct drop not null;

do $$
begin
  alter table public.collection_ml_discounts
    add constraint collection_ml_discounts_not_empty
    check (price is not null or discount_pct is not null);
exception
  when duplicate_object then null;
end $$;
