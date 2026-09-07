-- Барааны «сонгогч» жагсаалт (picker) — бэлгийн сан, нүүрийн хэсэг, багцын форм.
--
-- Өмнөх байдал: гурвуулаа `getAdminProducts()` / `getAllProducts()`-оор БҮХ
-- каталогийг (зураг, хэмжээ, таг, AI-зургийн түүх) сервер дээр татаж аваад,
-- түүнийгээ БҮТНЭЭР нь браузар руу props болгон илгээж, хайлтыг санах ойд
-- хийдэг байв. Бараа 500 болоход эдгээр хуудсууд шууд хүндэрнэ.
--
-- Энэ функц нь сонгогчид ҮНЭХЭЭР хэрэгтэй талбаруудыг л, хайлтаараа шүүсэн
-- эхний p_limit мөрөөр буцаана. Сонгогдсон мөрүүдийг p_ids-ээр нэрлэж авна
-- (хайлтаас хамаарахгүй — сонгосон бараа үргэлж нэрээрээ харагдах ёстой).
--
-- SECURITY INVOKER: RLS хэвээр — нуусан бараа зөвхөн ажилтанд.

create or replace function admin_product_options(
  -- Хэвийн болсон хайлтын үгс (TS-ийн `searchTerms()`).
  p_terms text[] default null,
  -- Тодорхой id-ууд (сонгогдсон бараа). Өгсөн бол хайлт хэрэглэгдэхгүй.
  p_ids   uuid[] default null,
  p_limit int    default 20
)
returns table (
  id           uuid,
  name         text,
  brand        text,
  is_active    boolean,
  available_ml int,
  -- {"5": 19000, "10": 32000} — багцын формын үнийн хүснэгтэд. Зөвхөн
  -- ИДЭВХТЭЙ хэмжээ, бодитоор төлөгдөх үнээр (0054).
  price_by_ml  jsonb
)
language sql
stable
set search_path = public, extensions
as $$
  select
    p.id, p.name, p.brand, p.is_active,
    coalesce(inv.available_ml, 0) as available_ml,
    coalesce((
      select jsonb_object_agg(pv.ml::text, variant_price(pv.*))
        from product_variants pv
       where pv.product_id = p.id and pv.is_active
    ), '{}'::jsonb) as price_by_ml
  from products p
  left join inventory inv on inv.product_id = p.id
  where case
          when p_ids is not null and cardinality(p_ids) > 0 then p.id = any (p_ids)
          else p_terms is null or cardinality(p_terms) = 0
               or p.search_text like all (array(select '%' || t || '%' from unnest(p_terms) t))
        end
  order by p.name, p.id
  limit greatest(coalesce(p_limit, 20), 1);
$$;

comment on function admin_product_options is
  'Админы барааны сонгогчид зориулсан хөнгөн жагсаалт: хайлтаар эсвэл id-гаар, '
  'ихдээ p_limit мөр.';

revoke all on function admin_product_options(text[], uuid[], int) from public;
revoke execute on function admin_product_options(text[], uuid[], int) from anon;
grant execute on function admin_product_options(text[], uuid[], int) to authenticated;
