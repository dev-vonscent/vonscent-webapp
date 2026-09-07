-- Тодорхой барааны ХЭМЖЭЭНҮҮДИЙГ багцаар нь унших (багц угсрах хуудас).
--
-- Өмнөх байдал: `/collections/build` нь `getBuilderProducts()`-оор БҮХ идэвхтэй
-- барааг хэмжээ бүрийнх нь үнэ, үлдэгдлийн хамт татаж аваад, шүүлт, эрэмбэ,
-- хуудаслалтыг браузарт JS-ээр хийдэг байв — 75 бараатай үед л хуудас 405 KB.
-- Каталог өсөх тусам энэ нь худалдан авагчийн утсан дээр шууд хүндэрнэ.
--
-- Одоо шүүлт/эрэмбэ/хуудаслалт нь `catalog_search()`-д (нэг эх сурвалж хэвээр)
-- үлдэж, энэ функц нь ТЭР ХУУДСАНД харагдах барааны хэмжээнүүдийг л нэмж өгнө.
-- Шүүлтийн логикийг хоёр дахин бичихээс зайлсхийж байгаа нь санаатай: зөрвөл
-- каталог ба багц угсрагч өөр өөр бараа харуулж эхэлнэ.

create or replace function product_variants_for(p_ids uuid[])
returns table (
  product_id   uuid,
  available_ml int,
  -- {"5": {"variantId": "...", "price": 19000, "inStock": true}, ...}
  -- Зөвхөн ИДЭВХТЭЙ хэмжээ; `price` нь бодитоор төлөгдөх дүн (0054).
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
                 -- «Захиалж болох уу» нь mapProduct()-тэй ижил дүрэм.
                 'inStock', not coalesce(inv.is_sold_out, false)
                            and coalesce(inv.available_ml, 0) >= pv.ml
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
  'боломжит үлдэгдэл. Багц угсрах хуудсын нэг хуудсанд хэрэглэнэ.';

revoke all on function product_variants_for(uuid[]) from public;
grant execute on function product_variants_for(uuid[]) to anon, authenticated;
