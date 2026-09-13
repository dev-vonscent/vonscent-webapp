-- Хайлтын багцад гишүүдийн НЭР + жижиг зураг (0081 үргэлжлэл).
--
-- 0081 нь багцын дэд гарчигт гишүүдийн БРЭНД-ийг гаргадаг байв — «Creed · Dior»
-- гэдэг нь дотор нь яг ямар үнэртэн байгааг хэлж чадахгүй. Одоо:
--   • subtitle — гишүүн барааны нэр (`Aventus · Sauvage · …`),
--   • member_images — эхний 4 гишүүний зураг; UI дээр багцын карттай ижил
--     давхарласан дугуй «савны зурвас» болж харагдана.
--
-- Буцаах баганын жагсаалт өөрчлөгдсөн тул функцийг эхлээд буулгана.

drop function if exists global_search(text[], int);

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
-- `similarity()` нь pg_trgm-ийнх — Supabase дээр `extensions` схемд байдаг.
set search_path = public, extensions
as $$
  with args as (
    select
      -- Бүх үг агуулагдах нөхцөл: LIKE ALL('%үг%', …) — GIN trgm индекс дэмжинэ.
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
          pv.is_active
            and not coalesce(inv.is_sold_out, false)
            and coalesce(inv.available_ml, 0) >= pv.ml as sellable
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
      -- Гишүүдийн брэнд — «яагаад энэ багц гарч ирэв?» гэдэг нь шууд харагдана.
      -- Дотор нь ЯМАР үнэртэн байгаа нь «яагаад энэ багц гарч ирэв?» гэдгийг
      -- шууд хариулна — брэндийн нэр биш, барааны нэрээр.
      (select string_agg(p.name, ' · ' order by ci.sort_order, p.name)
         from collection_items ci
         join products p on p.id = ci.product_id
        where ci.collection_id = c.id) as subtitle,
      c.image_url,
      null::int as price,
      false as sold_out,
      (select count(*)::int from collection_items ci where ci.collection_id = c.id) as item_count,
      -- Гишүүдийн жижиг зураг (эхний 4) — багцын карттай ижил «савны зурвас».
      -- Багц нь p_limit (≤20) мөр, гишүүн бүр индексээр нэг мөр уншина.
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
  )
  select * from products_hit
  union all select * from collections_hit
  union all select * from posts_hit
  union all select * from brands_hit;
$$;


comment on function global_search(text[], int) is
  'Глобал хайлт: бараа / багц / блог / брэнд. p_terms нь TS-ийн '
  'normalizeSearchText()-ээр хэвийн болсон үгс. Багц нь гишүүдийнхээ нэр/'
  'брэндээр ч олдох ба гишүүдийн нэр/зургийг хамт буцаана.';

revoke all on function global_search(text[], int) from public;
grant execute on function global_search(text[], int) to anon, authenticated;
