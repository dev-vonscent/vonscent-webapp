-- Бэлэн багцын үнэлгээ/сэтгэгдэл ба хүслийн жагсаалт (клиент, 2026-09 UG).
--
-- 1. `reviews` нь polymorphic болно: мөр бүр ЯГ НЭГ зорилттой — ус
--    (`product_id`) эсвэл багц (`collection_id`). Тусдаа хүснэгт биш нэг
--    хүснэгт: RLS (0009/0033), биеийн урт (0072), `updated_at` (0071),
--    админы устгал, нийтийн харагдац бүгд хэвээр хоёуланд үйлчилнэ.
--    `unique (collection_id, user_id)` нь `unique (product_id, user_id)`-ийн
--    толь — NULL нь давхцдаггүй тул хоёр төрлийн мөр бие биедээ саад болохгүй,
--    PostgREST-ийн `onConflict`-д бүрэн (partial биш) constraint хэрэгтэй.
-- 2. `collections.rating_avg / rating_count` + trigger нь ус, багц хоёуланг
--    бодно (0070-ийн загвар).
-- 3. `public_reviews` (0071) нь `products`-тэй LEFT JOIN болж, багцын
--    баганууд ТӨГСГӨЛД нэмэгдэнэ (`create or replace view` нь баганын
--    дарааллыг өөрчлөхийг зөвшөөрдөггүй). `product_is_active` нь багцын мөрөнд
--    NULL тул нүүрний «сүүлийн сэтгэгдэл» (`.eq(product_is_active, true)`)
--    өөрчлөгдөхгүй.
-- 4. `collection_wishlists` — `wishlists`-ийн PK нь (user_id, product_id)
--    бөгөөд product-д FK-тэй тул багцад тусдаа, ижил хэлбэрийн хүснэгт.

-- ── 1. reviews → ус эсвэл багц ─────────────────────────────────────────
alter table reviews
  add column if not exists collection_id uuid references collections(id) on delete cascade;
alter table reviews alter column product_id drop not null;

alter table reviews drop constraint if exists reviews_one_target;
alter table reviews add constraint reviews_one_target
  check (num_nonnulls(product_id, collection_id) = 1);

alter table reviews drop constraint if exists reviews_collection_user_key;
alter table reviews add constraint reviews_collection_user_key
  unique (collection_id, user_id);

create index if not exists reviews_collection_created_idx
  on reviews (collection_id, created_at desc, id desc)
  where collection_id is not null;

-- ── 2. Багцын үнэлгээний нийлбэр ──────────────────────────────────────
alter table collections
  add column if not exists rating_avg numeric(2,1) not null default 0,
  add column if not exists rating_count int not null default 0;

create or replace function recompute_collection_rating(p_collection uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_avg numeric; v_cnt int;
begin
  select coalesce(round(avg(rating)::numeric, 1), 0), count(*)
    into v_avg, v_cnt from reviews where collection_id = p_collection;
  update collections set rating_avg = v_avg, rating_count = v_cnt
    where id = p_collection;
end $$;

revoke execute on function recompute_collection_rating(uuid)
  from public, anon, authenticated;

create or replace function reviews_rating_sync()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    if old.product_id is not null then perform recompute_rating(old.product_id); end if;
    if old.collection_id is not null then perform recompute_collection_rating(old.collection_id); end if;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    -- UPDATE-д ижил зорилтыг хоёр дахин бодохгүй.
    if new.product_id is not null
       and (tg_op = 'INSERT' or new.product_id is distinct from old.product_id) then
      perform recompute_rating(new.product_id);
    end if;
    if new.collection_id is not null
       and (tg_op = 'INSERT' or new.collection_id is distinct from old.collection_id) then
      perform recompute_collection_rating(new.collection_id);
    end if;
  end if;
  return null;
end $$;
-- Trigger (0070) нь функцийг нэрээр нь дууддаг тул дахин үүсгэх шаардлагагүй.

-- ── 3. Нийтийн харагдац ───────────────────────────────────────────────
create or replace view public_reviews as
  select
    r.id,
    r.product_id,
    r.user_id,
    r.rating,
    r.body,
    r.created_at,
    r.updated_at,
    nullif(btrim(pf.full_name), '') as author_name,
    pf.avatar_url as author_avatar,
    p.name as product_name,
    p.slug as product_slug,
    p.brand as product_brand,
    p.is_active as product_is_active,
    (select pi.url from product_images pi
      where pi.product_id = p.id and pi.is_visible
      order by pi.sort_order limit 1) as product_image,
    r.collection_id,
    c.name as collection_name,
    c.slug as collection_slug,
    c.is_active as collection_is_active
  from reviews r
  left join products p on p.id = r.product_id
  left join collections c on c.id = r.collection_id
  left join profiles pf on pf.id = r.user_id;

grant select on public_reviews to anon, authenticated;

-- ── 4. Багцын хүслийн жагсаалт ────────────────────────────────────────
create table if not exists collection_wishlists (
  user_id uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, collection_id)
);

alter table collection_wishlists enable row level security;
drop policy if exists "collection wish owner" on collection_wishlists;
create policy "collection wish owner" on collection_wishlists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
