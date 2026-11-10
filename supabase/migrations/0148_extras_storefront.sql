-- Нэмэлт бараа — дэлгүүр (extras-shop-plan §9; PR4). Feature flag: `extras_shop`.
--
-- Дэлгүүрт хэрэгтэй «одоо зарагдах уу» гэдэг нь staff-only хүснэгтүүдээс
-- (`vials`, `leftover_liquid_locks`) хамаардаг тул anon-д шууд уншуулахгүй —
-- security definer функцууд тооцоолсон дүнг л буцаана:
--   extra_variant_available()  — нэг хувилбарын зарах боломжтой тоо
--   extras_catalog()           — каталогийн карт (таб, ангилал, хайлт, sitemap)
--   extra_detail(slug)         — барааны хуудас (хувилбар бүрийн боломжит тоо)
-- Туг хаалттай бол бүгд хоосон — хуудас 404, хайлтад ч гарахгүй.
--
-- `global_search` (0095-ын бие) — «extra» төрөл нэмэгдэв, бусад нь ХЭВЭЭР.

------------------------------------------------------------------------------
-- 1. Хувилбарын зарах боломжтой тоо. null = хязгааргүй (тоолж эхлээгүй сав).
------------------------------------------------------------------------------

create or replace function extra_variant_available(v extra_variants)
returns int language sql stable security definer set search_path = public as $$
  select case
    when not v.is_active then 0
    when v.inventory_mode = 'local_quantity'
      then greatest(v.on_hand_qty - v.reserved_qty, 0)
    when v.inventory_mode = 'shared_vial'
      -- Грамын савыг зөвхөн тугтай үед зарна (`vial_inventory`).
      then case when feature_enabled('vial_inventory')
                then vial_available_qty(v.vial_id) else 0 end
    else
      -- Үлдэгдэлтэй шил: жагсаалтад байгаа (listed) л бол 1.
      case when exists (select 1 from leftover_liquid_locks l
                         where l.extra_product_id = v.extra_id
                           and l.state = 'listed')
                and v.on_hand_qty - v.reserved_qty > 0
           then 1 else 0 end
  end;
$$;

------------------------------------------------------------------------------
-- 2. Каталог
------------------------------------------------------------------------------

create or replace function extras_catalog()
returns table (
  id uuid,
  slug text,
  name text,
  category_id uuid,
  category_slug text,
  category_name text,
  category_sort int,
  mode extra_inventory_mode_t,
  image_url text,
  images text[],
  capacity int,
  sort int,
  from_price int,
  sold_out boolean,
  leftover_brand text,
  leftover_product text,
  remaining_ml int,
  full_ml int,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select
    p.id, p.slug, p.name, c.id, c.slug, c.name, c.sort, p.inventory_mode,
    coalesce(p.images[1], lp.image) as image_url,
    p.images,
    case when jsonb_typeof(p.attrs->'capacity') = 'number'
         then (p.attrs->>'capacity')::int end,
    p.sort,
    -- Зарагдах хувилбарын хамгийн бага үнэ; бүгд дууссан бол идэвхтэй бүхний.
    coalesce(min(v.price) filter (where v.avail is null or v.avail > 0),
             min(v.price), 0)::int,
    not coalesce(bool_or(v.avail is null or v.avail > 0), false),
    lp.brand, lp.name, p.remaining_ml, p.full_ml,
    p.created_at, p.updated_at
  from extra_products p
  join extra_categories c on c.id = p.category_id and c.is_active
  left join lateral (
    select ev.price, extra_variant_available(ev) as avail
      from extra_variants ev
     where ev.extra_id = p.id and ev.is_active and ev.price > 0
  ) v on true
  left join lateral (
    select pr.brand, pr.name,
           (select pi.url from product_images pi
             where pi.product_id = pr.id and pi.is_visible
             order by pi.sort_order limit 1) as image
      from products pr where pr.id = p.product_id
  ) lp on true
  where feature_enabled('extras_shop')
    and p.status = 'published'
    -- Грамын сав нь савны тоон нөөцгүйгээр утгагүй.
    and (p.inventory_mode <> 'shared_vial' or feature_enabled('vial_inventory'))
  group by p.id, c.id, lp.brand, lp.name, lp.image;
$$;

comment on function extras_catalog() is
  'Дэлгүүрийн нэмэлт барааны карт: хамгийн бага үнэ, дууссан эсэх. Туг '
  'extras_shop хаалттай бол хоосон.';

------------------------------------------------------------------------------
-- 3. Барааны хуудас
------------------------------------------------------------------------------

create or replace function extra_detail(p_slug text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'card', to_jsonb(e),
    'description', p.description,
    'product_slug', (select pr.slug from products pr where pr.id = p.product_id),
    'product_id', p.product_id,
    'variants', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', v.id,
               'label', v.label,
               'price', v.price,
               'available', extra_variant_available(v),
               'vial_style', vl.style,
               'vial_ml', vl.ml
             ) order by v.sort, vl.ml, vl.style, v.label)
        from extra_variants v
        left join vials vl on vl.id = v.vial_id
       where v.extra_id = p.id and v.is_active and v.price > 0
    ), '[]'::jsonb)
  )
  from extras_catalog() e
  join extra_products p on p.id = e.id
  where e.slug = p_slug;
$$;

revoke all on function extra_variant_available(extra_variants) from public;
revoke all on function extras_catalog() from public;
revoke all on function extra_detail(text) from public;
grant execute on function extra_variant_available(extra_variants)
  to anon, authenticated, service_role;
grant execute on function extras_catalog() to anon, authenticated, service_role;
grant execute on function extra_detail(text) to anon, authenticated, service_role;

------------------------------------------------------------------------------
-- 4. global_search — 0095-ын бие + extras_hit
------------------------------------------------------------------------------

create or replace function global_search(p_terms text[], p_limit int default 5)
returns table (
  kind text,
  id uuid,
  slug text,
  title text,
  subtitle text,
  image_url text,
  price int,
  sold_out boolean,
  item_count int,
  member_images text[],
  score real
)
language sql
stable
set search_path = public, extensions
as $$
  with args as (
    select
      (select array_agg('%' || t || '%') from unnest(p_terms) t) as patterns,
      coalesce(p_terms[1], '') as head,
      array_to_string(p_terms, ' ') as joined
  ),
  products_hit as (
    select
      'product'::text as kind,
      p.id, p.slug, p.name as title, p.brand as subtitle,
      (select pi.url
         from product_images pi
        where pi.product_id = p.id and pi.is_visible
        order by pi.sort_order
        limit 1) as image_url,
      v.starting_price as price,
      (v.sellable_count = 0) as sold_out,
      null::int as item_count,
      null::text[] as member_images,
      (case
         when p.search_text like a.head || '%' then 2
         when p.search_text like '% ' || a.head || '%' then 1
         else 0
       end
       + similarity(p.search_text, a.joined)
       - case when v.sellable_count = 0 then 0.5 else 0 end)::real as score
    from products p
    cross join args a
    left join inventory inv on inv.product_id = p.id
    join lateral (
      select
        count(*) filter (where sellable) as sellable_count,
        coalesce(
          min(eff_price) filter (where sellable),
          min(eff_price) filter (where pv.is_active),
          0
        )::int as starting_price
      from product_variants pv
      cross join lateral (
        select
          variant_price(pv.*) as eff_price,
          variant_sellable(pv.*, p.gender, inv.is_sold_out, inv.available_ml)
            as sellable
      ) c
      where pv.product_id = p.id
    ) v on true
    where p.is_active
      and p.search_text like all (a.patterns)
    order by score desc, p.name
    limit greatest(coalesce(p_limit, 5), 1)
  ),
  collections_hit as (
    select
      'collection'::text as kind,
      c.id, c.slug, c.name as title,
      (select string_agg(p.name, ' · ' order by ci.sort_order, p.name)
         from collection_items ci
         join products p on p.id = ci.product_id
        where ci.collection_id = c.id) as subtitle,
      c.image_url,
      null::int as price,
      false as sold_out,
      (select count(*)::int from collection_items ci where ci.collection_id = c.id) as item_count,
      (select array_agg(img order by ord)
         from (
           select ci.sort_order as ord,
                  (select pi.url
                     from product_images pi
                    where pi.product_id = ci.product_id and pi.is_visible
                    order by pi.sort_order
                    limit 1) as img
             from collection_items ci
            where ci.collection_id = c.id
            order by ci.sort_order
            limit 4
         ) m
        where img is not null) as member_images,
      (case
         when c.search_text like a.head || '%' then 2
         when c.search_text like '% ' || a.head || '%' then 1
         else 0
       end + similarity(c.search_text, a.joined))::real as score
    from collections c
    cross join args a
    where c.is_active
      and c.type = 'base'
      and c.user_id is null
      and c.search_text like all (a.patterns)
    order by score desc, c.name
    limit greatest(coalesce(p_limit, 5), 1)
  ),
  posts_hit as (
    select
      'post'::text as kind,
      b.id, b.slug, b.title, nullif(b.category, '') as subtitle,
      b.cover_url as image_url,
      null::int as price,
      false as sold_out,
      null::int as item_count,
      null::text[] as member_images,
      (case
         when b.search_text like a.head || '%' then 2
         when b.search_text like '% ' || a.head || '%' then 1
         else 0
       end + similarity(b.search_text, a.joined))::real as score
    from blog_posts b
    cross join args a
    where b.is_published
      and b.search_text like all (a.patterns)
    order by score desc, b.published_at desc
    limit greatest(coalesce(p_limit, 5), 1)
  ),
  brands_hit as (
    select
      'brand'::text as kind,
      br.id, br.slug, br.name as title, null::text as subtitle,
      br.logo_url as image_url,
      null::int as price,
      false as sold_out,
      (select count(*)::int from products p
        where p.is_active and lower(p.brand) = lower(br.name)) as item_count,
      null::text[] as member_images,
      (case
         when br.search_text like a.head || '%' then 2
         when br.search_text like '% ' || a.head || '%' then 1
         else 0
       end + similarity(br.search_text, a.joined))::real as score
    from brands br
    cross join args a
    where br.is_active
      and br.search_text like all (a.patterns)
    order by score desc, br.name
    limit greatest(coalesce(p_limit, 5), 1)
  ),
  extras_hit as (
    -- 0148: нэмэлт бараа (туг `extras_shop`). Хүснэгт жижиг тул индексгүй
    -- нэр + ангиллаар шууд шүүнэ. «Дууссан» нь дэлгүүрийн каталогийн дүрэм
    -- (`extras_catalog`) — нэг эх сурвалж.
    select
      'extra'::text as kind,
      e.id, e.slug, e.name as title, e.category_name as subtitle,
      e.image_url,
      e.from_price as price,
      e.sold_out,
      null::int as item_count,
      null::text[] as member_images,
      (case
         when search_normalize(e.name) like a.head || '%' then 2
         when search_normalize(e.name) like '% ' || a.head || '%' then 1
         else 0
       end
       + similarity(search_normalize(e.name || ' ' || e.category_name), a.joined)
       - case when e.sold_out then 0.5 else 0 end)::real as score
    from extras_catalog() e
    cross join args a
    where search_normalize(e.name || ' ' || e.category_name || ' '
                           || coalesce(e.leftover_brand, '') || ' '
                           || coalesce(e.leftover_product, ''))
          like all (a.patterns)
    order by score desc, e.name
    limit greatest(coalesce(p_limit, 5), 1)
  )
  select * from products_hit
  union all select * from collections_hit
  union all select * from posts_hit
  union all select * from brands_hit
  union all select * from extras_hit;
$$;

comment on function global_search(text[], int) is
  'Глобал хайлт: бараа / багц / блог / брэнд / нэмэлт бараа (0148). Барааны '
  '«дууссан» төлөв нь variant_sellable() (0095) — савны түгжээг ч агуулна.';

revoke all on function global_search(text[], int) from public;
grant execute on function global_search(text[], int) to anon, authenticated;
