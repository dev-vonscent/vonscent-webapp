-- Глобал хайлтыг өгөгдлийн сан руу зөөх (backlog H1, H2).
--
-- Өмнөх байдал: хайлт бүр `fetchProducts()`-оор БҮХ идэвхтэй барааг nested
-- select-ээр (зураг, хэмжээ, үлдэгдэл, таг) татаж аваад JS дотор
-- `matchesSearch()`-ээр шүүдэг байв. Гурван сул тал:
--   1. бараа нэмэгдэх тусам хайлт бүр илүү их өгөгдөл татна (H2);
--   2. зөвхөн бараа олддог — багц, блог, брэнд хайгдахгүй (H1);
--   3. эрэмбэ гэж байхгүй — "to" гэж бичихэд Tom Ford эхэнд гарах баталгаагүй.
--
-- Шийдэл: тухайн мөрийн хайлтын текстийг ХЭВИЙНХ болгож (transliteration),
-- багана болгон хадгалж, pg_trgm GIN индекс тавина. Дараа нь `global_search()`
-- нэг дуудлагаар дөрвөн төрлийн үр дүнг эрэмбэлж буцаана.

-- Supabase дээр өргөтгөлүүд `extensions` схемд суудаг; өөр орчинд байхгүй бол
-- өгөгдмөл схемд.
do $ext$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then
    if exists (select 1 from pg_namespace where nspname = 'extensions') then
      execute 'create extension pg_trgm with schema extensions';
    else
      execute 'create extension pg_trgm';
    end if;
  end if;
end $ext$;

------------------------------------------------------------------------------
-- 1. Хэвийн болгох функц — `src/lib/search.ts`-ийн ТОЛЬ ХУВИЛБАР.
--
--    Хоёр тал ЯГ ижил үр дүн өгөх ёстой: багана нь энэ функцээр бичигдэж,
--    хайлтын үг нь браузар/сервер дээр TS-ийн `normalizeSearchText()`-ээр
--    хэвийн болгож ирнэ. Зөрүү гарвал "диор" гэж бичихэд Dior олдохоо болино,
--    тиймээс алхмууд нь TS-тэйгээ мөр мөрөөрөө таарч байна:
--
--      TS: lower() → normalize("NFKD") → \p{Mn} устгах → кирилл→латин
--      SQL: lower() → normalize(nfkd)  → нийлмэл тэмдэг устгах → кирилл→латин
--
--    NFKD задлалт нь өргөлтийг (é→e, Hermès) ба нийлмэл кирилл үсгийг
--    (ё→е, й→и) аль хэдийн шийддэг тул доорх хүснэгтэд зөвхөн ҮЛДСЭН кирилл
--    үсгүүд орно — TS-ийн `CYRILLIC_TO_LATIN`-тэй адилхан.
--
--    Паритетыг `scripts/check-search-parity.ts` бодит сангийн текст дээр
--    шалгана (PR-ийн өмнө ажиллуулна).
------------------------------------------------------------------------------

create or replace function search_normalize(txt text)
returns text
language sql
immutable
strict
parallel safe
as $$
  -- 4. Латин үсгийг жижигрүүлнэ (кирилл нь энэ үед аль хэдийн латин болсон).
  --    `lower()` нь ASCII дээр locale-аас хамаарахгүй.
  select lower(
    -- 3. Үлдсэн кирилл → латин, 1:1. Мөрийн ТӨГСГӨЛД байгаа ЪЬъь нь `to`-д
    --    хос байхгүй тул `translate()` тэднийг УСТГАНА (TS-ийн "" утга).
    translate(
      -- 2. Олон үсэг болж хувирдгууд — `translate()` 1:1 тул тусад нь.
      replace(replace(replace(replace(replace(replace(replace(
        -- 1. Том үсгээ жижигрүүлнэ. `lower()`-ыг ашиглахгүй байгаа шалтгаан:
        --    кирилл дээр locale-оос хамаардаг (C locale-тай санд ажиллахгүй).
        translate(folded, 'ХЦЧШЩЮЯ', 'хцчшщюя'),
        'х', 'kh'), 'ц', 'ts'), 'ч', 'ch'), 'ш', 'sh'),
        'щ', 'sh'), 'ю', 'yu'), 'я', 'ya'),
      'АБВГДЕЖЗИЙКЛМНОПРСТУФӨҮЫЭабвгдежзийклмнопрстуфөүыэ'
      -- Задардаггүй, `lower()` нь зөвхөн UTF-8 locale дээр зөв боддог
      -- латин үсгүүд (Æther, Ørjan …) — locale-ээс хамааруулахгүйн тулд.
      || 'ÆØÞÐĐĦŁŊŒŦ' || 'ЪЬъь',
      'ABVGDEJZIIKLMNOPRSTUFUUIEabvgdejziiklmnoprstufuuie'
      || 'æøþðđħłŋœŧ'
    )
  )
  from (
    -- 0. NFKD задлалт + нийлмэл тэмдэг устгах = TS-ийн normalize("NFKD") +
    --    /\p{Mn}/ устгалт. Өргөлт (Hermès→Hermes) ба нийлмэл кирилл
    --    (ё→е, й→и) энд шийдэгдэнэ.
    select regexp_replace(
             normalize(txt, nfkd),
             '[\u0300-\u036f\u0483-\u0489\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20f0\ufe20-\ufe2f]',
             '', 'g'
           ) as folded
  ) s;
$$;

comment on function search_normalize(text) is
  'Хайлтын текстийг хэвийн болгоно (жижиг үсэг, өргөлт хасах, кирилл→латин). '
  'src/lib/search.ts дахь normalizeSearchText()-ийн толь хувилбар — хоёуланг '
  'нь зэрэг өөрчилнө.';

------------------------------------------------------------------------------
-- 2. Бараа — нэр + брэнд + нэмэлт таг (одоогийн JS haystack-тай ижил).
--
--    Нэмэлт таг өөр хүснэгтэд байдаг тул generated column болохгүй; trigger-ээр
--    арчилна. Гурван эх сурвалж тус бүрдээ trigger-тэй: бараа өөрөө,
--    бараа↔таг холбоос, тагийн нэр өөрчлөгдөх.
------------------------------------------------------------------------------

alter table public.products
  add column if not exists search_text text not null default '';

create or replace function products_search_text(p_id uuid, p_name text, p_brand text)
returns text
language sql
stable
set search_path = public
as $$
  select search_normalize(
    coalesce(p_name, '') || ' ' || coalesce(p_brand, '') || ' ' ||
    coalesce(
      (select string_agg(ct.name, ' ')
         from product_custom_tags pct
         join custom_tags ct on ct.id = pct.tag_id
        where pct.product_id = p_id),
      ''
    )
  );
$$;

create or replace function products_search_text_sync()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.search_text := products_search_text(new.id, new.name, new.brand);
  return new;
end;
$$;

drop trigger if exists products_search_text_sync on public.products;
create trigger products_search_text_sync
  before insert or update of name, brand on public.products
  for each row execute function products_search_text_sync();

-- Таг нэмэх/хасах: тухайн барааны мөрийг л дахин бодно. `search_text`-ийг
-- шууд бичдэг тул дээрх `update of name, brand` trigger дахин дуудагдахгүй.
create or replace function products_search_text_retag()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_product uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
     set search_text = products_search_text(p.id, p.name, p.brand)
   where p.id = v_product;
  return null;
end;
$$;

drop trigger if exists product_custom_tags_search_sync on public.product_custom_tags;
create trigger product_custom_tags_search_sync
  after insert or delete on public.product_custom_tags
  for each row execute function products_search_text_retag();

create or replace function custom_tags_search_rename()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.products p
     set search_text = products_search_text(p.id, p.name, p.brand)
   where p.id in (select product_id from product_custom_tags where tag_id = new.id);
  return null;
end;
$$;

drop trigger if exists custom_tags_search_rename on public.custom_tags;
create trigger custom_tags_search_rename
  after update of name on public.custom_tags
  for each row execute function custom_tags_search_rename();

-- Брэнд нэрлэлт өөрчлөгдөхөд 0050-ийн trigger `products.brand`-ыг бичдэг тул
-- дээрх `update of name, brand` trigger өөрөө хөөцөлдөнө.

update public.products p
   set search_text = products_search_text(p.id, p.name, p.brand)
 where search_text = '';

create index if not exists products_search_trgm_idx
  on public.products using gin (search_text gin_trgm_ops);

------------------------------------------------------------------------------
-- 3. Багц / блог / брэнд — H1: хайлтад эдгээр нь ч орно.
--
--    Эдгээрийн эх текст нь нэг мөрөндөө байдаг тул generated column хангалттай
--    (`search_normalize` нь immutable).
------------------------------------------------------------------------------

alter table public.collections
  add column if not exists search_text text
  generated always as (search_normalize(name || ' ' || coalesce(description, ''))) stored;

create index if not exists collections_search_trgm_idx
  on public.collections using gin (search_text gin_trgm_ops);

alter table public.blog_posts
  add column if not exists search_text text
  generated always as (
    search_normalize(title || ' ' || coalesce(excerpt, '') || ' ' || coalesce(category, ''))
  ) stored;

create index if not exists blog_posts_search_trgm_idx
  on public.blog_posts using gin (search_text gin_trgm_ops);

alter table public.brands
  add column if not exists search_text text
  generated always as (search_normalize(name)) stored;

create index if not exists brands_search_trgm_idx
  on public.brands using gin (search_text gin_trgm_ops);

------------------------------------------------------------------------------
-- 4. `global_search()` — нэг дуудлага, дөрвөн төрөл, төрөл бүрдээ эрэмбэтэй.
--
--    `p_terms` нь аль хэдийн хэвийн болсон үгс (TS тал нь бэлдэнэ). Мөр нь
--    БҮХ үгийг агуулж байх ёстой — JS-ийн `matchesSearch()`-тэй ижил дүрэм.
--
--    Оноо: эхний үг мөрийн эхэнд байвал 2, үгийн эхэнд байвал 1, дунд нь бол
--    0; дээр нь trigram төстэй байдал нэмэгдэнэ. Дууссан бараа хойшилно.
--
--    SECURITY INVOKER (өгөгдмөл) — RLS хэвээр үйлчилнэ; функц дотор мөн
--    ил тод шүүлт (is_active / is_published / type='base') давхар тавьсан:
--    хэрэглэгчийн хувийн багц хайлтад гарах ёсгүй.
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
      c.id, c.slug, c.name as title, null::text as subtitle,
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

comment on function global_search(text[], int) is
  'Глобал хайлт: бараа / багц / блог / брэнд. p_terms нь TS-ийн '
  'normalizeSearchText()-ээр хэвийн болсон үгс.';

revoke all on function global_search(text[], int) from public;
grant execute on function global_search(text[], int) to anon, authenticated;
