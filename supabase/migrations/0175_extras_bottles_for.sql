-- «Энэ үнэрийн шил» (extras-shop-plan §19.4). Feature flag: `extras_shop`.
--
-- Expand only: шинэ функц. Үнэртний хуудас тухайн үнэртэнтэй `product_id`-аар
-- холбогдсон, нийтлэгдсэн бүх шилийг (бүтэн, үлдэгдэлтэй, хоосон) харуулна.
-- Картын бүх мэдээлэл `extras_catalog()`-д (cache-тэй) байгаа тул энд зөвхөн
-- id — TS тэр жагсаалтаас сонгоно. Туг хаалттай бол `extras_catalog()` хоосон
-- тул энэ ч хоосон. `extras_leftover_for` (0151) хуучин кодонд үлдэнэ.

create or replace function extras_bottles_for(p_product uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select e.id
    from extras_catalog() e
    join extra_products p on p.id = e.id
   where p.product_id = p_product
     and e.category_slug in ('bottled', 'empty-bottle');
$$;

comment on function extras_bottles_for(uuid) is
  'Үнэртэнтэй холбогдсон нийтлэгдсэн шилний id (бүтэн, үлдэгдэлтэй, хоосон). '
  'Туг extras_shop хаалттай бол хоосон.';

revoke all on function extras_bottles_for(uuid) from public;
grant execute on function extras_bottles_for(uuid) to anon, authenticated, service_role;
