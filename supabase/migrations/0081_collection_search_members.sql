-- Багцыг ГИШҮҮДЭЭР нь хайх (H1 үргэлжлэл).
--
-- Өмнөх байдал: `collections.search_text` нь зөвхөн багцын НЭР + тайлбараас
-- бүрддэг generated column байв. Тиймээс «Gentleman» нэртэй preset багц дотор
-- Creed-ийн үнэртэн байсан ч «creed» гэж хайхад тэр багц огт олдохгүй —
-- хэрэглэгч брэндээ бичээд зөвхөн дан савнуудыг хардаг.
--
-- Шийдэл: багцын хайлтын текстэд гишүүн барааны НЭР + БРЭНД-ийг нэмнэ. Өөр
-- хүснэгтээс уншдаг тул generated column байж чадахгүй — `products`-той адил
-- энгийн багана + trigger болгов. Гурван эх сурвалж:
--   1. багц өөрөө (нэр / тайлбар),
--   2. гишүүдийн жагсаалт (`collection_items`),
--   3. гишүүн барааны нэр / брэнд өөрчлөгдөх (`products`).
--
-- UI-ийн дараалал (бараа → багц → брэнд) `SEARCH_KINDS`-д аль хэдийн зөв тул
-- энд өөрчлөхгүй: «creed» гэхэд эхэнд Creed-ийн үнэртэн, дараа нь Creed орсон
-- багцууд, төгсгөлд нь брэнд өөрөө гарна.

------------------------------------------------------------------------------
-- 1. Generated column → энгийн багана.
------------------------------------------------------------------------------

drop index if exists collections_search_trgm_idx;
alter table public.collections drop column if exists search_text;
alter table public.collections
  add column search_text text not null default '';

create or replace function collections_search_text(
  p_id uuid,
  p_name text,
  p_description text
)
returns text
language sql
stable
set search_path = public
as $$
  select search_normalize(
    coalesce(p_name, '') || ' ' || coalesce(p_description, '') || ' ' ||
    coalesce(
      (select string_agg(p.name || ' ' || p.brand, ' ')
         from collection_items ci
         join products p on p.id = ci.product_id
        where ci.collection_id = p_id),
      ''
    )
  );
$$;

comment on function collections_search_text(uuid, text, text) is
  'Багцын хайлтын текст: нэр + тайлбар + гишүүн барааны нэр/брэнд.';

------------------------------------------------------------------------------
-- 2. Trigger-үүд.
------------------------------------------------------------------------------

create or replace function collections_search_text_sync()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.search_text := collections_search_text(new.id, new.name, new.description);
  return new;
end;
$$;

drop trigger if exists collections_search_text_sync on public.collections;
create trigger collections_search_text_sync
  before insert or update of name, description on public.collections
  for each row execute function collections_search_text_sync();

-- Гишүүн нэмэх/хасах/солих. `search_text`-ийг ШУУД бичдэг тул дээрх
-- `update of name, description` trigger дахин ажиллахгүй.
create or replace function collection_items_search_sync()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ids uuid[];
begin
  -- DELETE үед `new` огт оноогддоггүй (PL/pgSQL) тул TG_OP-оор салгана.
  if tg_op = 'DELETE' then
    v_ids := array[old.collection_id];
  elsif tg_op = 'INSERT' then
    v_ids := array[new.collection_id];
  else
    v_ids := array[old.collection_id, new.collection_id];
  end if;
  update public.collections c
     set search_text = collections_search_text(c.id, c.name, c.description)
   where c.id = any (v_ids);
  return null;
end;
$$;

drop trigger if exists collection_items_search_sync on public.collection_items;
create trigger collection_items_search_sync
  after insert or update or delete on public.collection_items
  for each row execute function collection_items_search_sync();

-- Барааны нэр/брэнд өөрчлөгдөхөд түүнийг агуулсан багцуудыг дахин бодно.
create or replace function products_collection_search_sync()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.collections c
     set search_text = collections_search_text(c.id, c.name, c.description)
   where c.id in (
     select ci.collection_id from collection_items ci where ci.product_id = new.id
   );
  return null;
end;
$$;

drop trigger if exists products_collection_search_sync on public.products;
create trigger products_collection_search_sync
  after update of name, brand on public.products
  for each row
  when (old.name is distinct from new.name or old.brand is distinct from new.brand)
  execute function products_collection_search_sync();

------------------------------------------------------------------------------
-- 3. Дүүргэлт + индекс.
------------------------------------------------------------------------------

update public.collections c
   set search_text = collections_search_text(c.id, c.name, c.description);

create index if not exists collections_search_trgm_idx
  on public.collections using gin (search_text gin_trgm_ops);

------------------------------------------------------------------------------
-- 4. Хажуугийн засвар: 0057-гийн таг trigger DELETE дээр унадаг байсан.
--
--    `coalesce(new.product_id, old.product_id)` нь DELETE trigger дотор
--    «record new is not assigned yet» алдаа өгнө — өөрөөр хэлбэл бараанаас таг
--    хасах бүр амжилтгүй болно. TG_OP-оор салгаж засав.
------------------------------------------------------------------------------

create or replace function products_search_text_retag()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_product uuid;
begin
  if tg_op = 'DELETE' then
    v_product := old.product_id;
  else
    v_product := new.product_id;
  end if;
  update public.products p
     set search_text = products_search_text(p.id, p.name, p.brand)
   where p.id = v_product;
  return null;
end;
$$;

------------------------------------------------------------------------------
-- 5. `global_search()` дахин — багцын дэд гарчигт гишүүдийн брэндийг гаргана.
--    Бусад хэсэг нь 0057-гийнхтэй адил.
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
      (select string_agg(distinct p.brand, ' · ')
         from collection_items ci
         join products p on p.id = ci.product_id
        where ci.collection_id = c.id) as subtitle,
      c.image_url,
      null::int as price,
      false as sold_out,
      (select count(*)::int from collection_items ci where ci.collection_id = c.id) as item_count,
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

