-- «Үнэртний шил»-ийн каталог маягийн шүүлтүүр (extras-shop-plan §19.2).
-- Feature flag: `extras_shop`.
--
-- Expand only: шинэ функц. Бүтэн / үлдэгдэлтэй шилийг каталогтой ижил
-- хүйс, үнэрийн төрөл, улирлаар шүүхийн тулд холбогдсон үнэртний шинжийг
-- өгнө. `extras_catalog()`-ээр дамждаг тул туг хаалттай бол хоосон.

create or replace function extras_bottle_facets()
returns table (id uuid, gender text, scent_families text[], seasons text[])
language sql stable security definer set search_path = public as $$
  select e.id,
         pr.gender::text,
         coalesce(pr.scent_families::text[], '{}'),
         coalesce(pr.seasons::text[], '{}')
    from extras_catalog() e
    join extra_products p on p.id = e.id
    join products pr on pr.id = p.product_id
   where e.category_slug in ('bottled', 'empty-bottle');
$$;

comment on function extras_bottle_facets() is
  'Шилний эх үнэртний хүйс, үнэрийн төрөл, улирал — «Үнэртний шил»-ийн шүүлтүүр. '
  'Туг extras_shop хаалттай бол хоосон.';

revoke all on function extras_bottle_facets() from public;
grant execute on function extras_bottle_facets() to anon, authenticated, service_role;
