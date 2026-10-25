-- Сэтгэгдлийн хяналт (клиент, 2026-10 «Сэтгэгдэл» даалгавар). Feature flag
-- `review_moderation` — хаалттай үед хуучин зан төлөв (шууд нийтлэгдэж, оноо
-- шууд олгогдоно, 0121) огт өөрчлөгдөхгүй.
--
-- Туг нээлттэй үед:
--   * Сэтгэгдэл `pending` төлөвтэй бичигдэж, админ батлах (`approved`) эсвэл
--     цуцлах (`rejected` + шалтгаан) хүртэл нийтэд харагдахгүй, үнэлгээний
--     дунджид орохгүй.
--   * Оноо (`settings.loyalty.reviewPoints`) зөвхөн батлагдах үед олгогдоно.
--   * Хэрэглэгч засах/устгах боломжгүй (нэг удаа бичнэ).
--   * Бүртгэл бүрэн (нэр + баталгаажсан утас), худалдаж авч хүлээн авсан
--     байх (бэлгийн мөр тооцогдохгүй). Base багцаар авсан бол сэтгэгдэл нь
--     багцад (`collection_id`) — багц доторх ус тус бүрт биш; тусад нь (эсвэл
--     custom багцаар — `collection_id` null) авсан ус бол усанд.
--   * Багцын сэтгэгдэл ч батлагдахад оноо авна (`collection_review_rewards`).
--   * Текст: зайг тооцохгүйгээр 100+ тэмдэгт (`REVIEW_MODERATED_BODY_MIN`).
--   * Админ батлагдсан сэтгэгдлийг нууж (`is_visible`), нүүр хуудсанд
--     сонгож (`is_featured`), бүрмөсөн устгаж болно — олгосон оноонд нөлөөгүй
--     (`review_rewards` тусдаа).
--
-- Expand only: шинэ баганууд default-тай тул хуучин код (upsert, status
-- дамжуулдаггүй) `approved` мөр бичсээр — өнөөгийн зан төлөвтэй ижил.

insert into feature_flags (key) values ('review_moderation')
  on conflict do nothing;

-- ── 1. Баганууд ───────────────────────────────────────────────────────
alter table reviews
  add column if not exists status text not null default 'approved',
  add column if not exists reject_reason text,
  add column if not exists is_visible boolean not null default true,
  add column if not exists is_featured boolean not null default false,
  add column if not exists moderated_at timestamptz,
  add column if not exists moderated_by uuid references profiles(id) on delete set null;

alter table reviews drop constraint if exists reviews_status_check;
alter table reviews add constraint reviews_status_check
  check (status in ('pending', 'approved', 'rejected'));

alter table reviews drop constraint if exists reviews_reject_reason_check;
alter table reviews add constraint reviews_reject_reason_check
  check (
    (status = 'rejected' and reject_reason in ('profanity', 'false_info', 'other'))
    or (status <> 'rejected' and reject_reason is null)
  );

-- 100+ тэмдэгт шаарддаг тул 200-гийн хязгаар (0072) багадна. Хуучин код
-- Zod-оор 200-г барьсаар; DB-ийн хязгаарыг сулруулах нь хуучин кодтой зөрчилгүй.
alter table reviews drop constraint if exists reviews_body_len;
alter table reviews add constraint reviews_body_len
  check (body is null or length(body) <= 1000);

create index if not exists reviews_status_created_idx
  on reviews (status, created_at desc);
create index if not exists reviews_featured_idx
  on reviews (created_at desc) where is_featured;

-- ── 2. Унших эрх ─────────────────────────────────────────────────────
-- Өмнө нь `using (true)` — шалгагдаж буй/цуцлагдсан мөр (шалтгаантай нь)
-- anon-д ил байх байв. Хуучин мөрүүд бүгд approved + visible тул өөрчлөлтгүй.
drop policy if exists "review read" on reviews;
create policy "review read" on reviews for select
  using (
    (status = 'approved' and is_visible)
    or user_id = auth.uid()
    or is_staff()
  );

-- ── 3. Бичих эрхийн шалгалт ──────────────────────────────────────────
/**
 * Хэрэглэгч энэ зорилтод сэтгэгдэл бичих боломжгүй шалтгаан, эсвэл null.
 * Route (`/api/reviews/eligibility`) болон доорх trigger хоёулаа үүнийг
 * дуудна — дүрэм нэг газар. Усны худалдан авалтын нөхцөл нь
 * `award_review_points`-тэй (0121) ижил.
 */
create or replace function review_block_reason(
  p_user uuid,
  p_product uuid,
  p_collection uuid default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_user is null then
    return 'unauthorized';
  end if;

  if not exists (
    select 1 from profiles
     where id = p_user
       and nullif(btrim(full_name), '') is not null
       and phone_verified
  ) then
    return 'profile_incomplete';
  end if;

  if p_product is not null and not exists (
    select 1
      from orders o
      join order_items oi on oi.order_id = o.id
     where o.user_id = p_user
       and o.status = 'delivered'
       and o.payment_status = 'paid'
       and oi.product_id = p_product
       and oi.collection_id is null
       and not coalesce(oi.is_gift, false)
       and not coalesce(oi.is_sample, false)
  ) then
    -- Зөвхөн base багц дотор авсан бол багцын хуудсанд бичнэ.
    if exists (
      select 1
        from orders o
        join order_items oi on oi.order_id = o.id
       where o.user_id = p_user
         and o.status = 'delivered'
         and o.payment_status = 'paid'
         and oi.product_id = p_product
         and oi.collection_id is not null
         and not coalesce(oi.is_gift, false)
    ) then
      return 'bought_in_bundle';
    end if;
    return 'not_purchased';
  end if;

  if p_collection is not null and not exists (
    select 1
      from orders o
      join order_items oi on oi.order_id = o.id
     where o.user_id = p_user
       and o.status = 'delivered'
       and o.payment_status = 'paid'
       and oi.collection_id = p_collection
       and not coalesce(oi.is_gift, false)
  ) then
    return 'not_purchased';
  end if;

  if exists (
    select 1 from reviews
     where user_id = p_user
       and (product_id = p_product or collection_id = p_collection)
  ) then
    return 'already_reviewed';
  end if;

  return null;
end;
$$;

revoke all on function review_block_reason(uuid, uuid, uuid)
  from public, anon, authenticated;

/**
 * Туг нээлттэй үед сайтаар (authenticated эрхээр, RLS-ээр route-ыг тойрсон ч)
 * хийсэн бичилтийг хязгаарлана. Ажилтан ч өөрийн сэтгэгдлийг сайтаар бичвэл
 * `pending` болно — эс бөгөөс админ account-аар туршихад шууд батлагдана.
 * Хяналтын update нь service-role-оор (`/api/admin/reviews`) тул чөлөөтэй.
 */
create or replace function reviews_moderation_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reason text;
begin
  if not feature_enabled('review_moderation') then
    return new;
  end if;
  if coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if is_staff() then
      return new;
    end if;
    raise exception 'REVIEW_LOCKED' using errcode = '42501';
  end if;

  v_reason := review_block_reason(new.user_id, new.product_id, new.collection_id);
  if v_reason is not null then
    raise exception 'REVIEW_BLOCKED:%', v_reason using errcode = '42501';
  end if;

  if length(regexp_replace(coalesce(new.body, ''), '\s', '', 'g')) < 100 then
    raise exception 'REVIEW_TOO_SHORT' using errcode = '23514';
  end if;

  new.status := 'pending';
  new.reject_reason := null;
  new.is_visible := true;
  new.is_featured := false;
  new.moderated_at := null;
  new.moderated_by := null;
  return new;
end;
$$;

drop trigger if exists reviews_moderation_guard on reviews;
create trigger reviews_moderation_guard
  before insert or update on reviews
  for each row execute function reviews_moderation_guard();

-- ── 4. Үнэлгээний дундаж: зөвхөн нийтэд харагдах сэтгэгдэл ─────────────
-- Хуучин мөрүүд бүгд approved + visible тул тоо өөрчлөгдөхгүй.
create or replace function recompute_rating(p_product uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_avg numeric; v_cnt int;
begin
  select coalesce(round(avg(rating)::numeric, 1), 0), count(*)
    into v_avg, v_cnt from reviews
   where product_id = p_product and status = 'approved' and is_visible;
  update products set rating_avg = v_avg, rating_count = v_cnt where id = p_product;
end $$;

create or replace function recompute_collection_rating(p_collection uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_avg numeric; v_cnt int;
begin
  select coalesce(round(avg(rating)::numeric, 1), 0), count(*)
    into v_avg, v_cnt from reviews
   where collection_id = p_collection and status = 'approved' and is_visible;
  update collections set rating_avg = v_avg, rating_count = v_cnt
    where id = p_collection;
end $$;

-- ── 5. Нийтийн харагдац ──────────────────────────────────────────────
-- 0107-той ижил баганууд + төгсгөлд `is_featured`; зөвхөн нийтлэгдсэн мөр.
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
    c.is_active as collection_is_active,
    r.is_featured
  from reviews r
  left join products p on p.id = r.product_id
  left join collections c on c.id = r.collection_id
  left join profiles pf on pf.id = r.user_id
  where r.status = 'approved' and r.is_visible;

grant select on public_reviews to anon, authenticated;

-- ── 6. Оноо: туг нээлттэй үед зөвхөн батлагдсан сэтгэгдэлд ─────────────
-- 0121-ийн бие; зөвхөн тэмдэглэсэн нөхцөл нэмэгдсэн.
create or replace function award_review_points(p_user uuid, p_product uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points int;
begin
  if p_user is null or p_product is null then
    return 0;
  end if;

  select coalesce((value->>'reviewPoints')::int, 0) into v_points
    from settings where key = 'loyalty';
  if coalesce(v_points, 0) <= 0 then
    return 0;
  end if;

  if not exists (
    select 1
      from orders o
      join order_items oi on oi.order_id = o.id
     where o.user_id = p_user
       and o.status = 'delivered'
       and o.payment_status = 'paid'
       and oi.product_id = p_product
       -- 0162: хяналттай үед багц доторх ус усны оноо авахгүй (багцынхыг авна)
       and (not feature_enabled('review_moderation') or oi.collection_id is null)
       and not coalesce(oi.is_gift, false)
       and not coalesce(oi.is_sample, false)
  ) then
    return 0;
  end if;

  if not exists (
    select 1 from reviews
     where user_id = p_user and product_id = p_product
       -- 0162: хяналттай үед зөвхөн батлагдсан
       and (not feature_enabled('review_moderation') or status = 'approved')
  ) then
    return 0;
  end if;

  insert into review_rewards (user_id, product_id, points)
    values (p_user, p_product, v_points)
    on conflict do nothing;
  if not found then
    return 0;
  end if;

  update profiles set loyalty_points = loyalty_points + v_points
    where id = p_user;
  insert into loyalty_ledger (user_id, delta, reason)
    values (p_user, v_points, 'review');
  return v_points;
end;
$$;

revoke all on function award_review_points(uuid, uuid)
  from public, anon, authenticated;
-- `reviews_award_points` trigger (0121) нь insert/update бүрт дууддаг тул
-- админ `approved` болгох update нь оноог өөрөө олгоно.

-- ── 7. Багцын сэтгэгдлийн оноо (зөвхөн туг нээлттэй үед) ──────────────
-- `review_rewards`-ийн PK нь (user_id, product_id) тул тусдаа, ижил хэлбэрийн
-- хүснэгт (expand only).
create table if not exists collection_review_rewards (
  user_id       uuid not null references auth.users(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  points        int  not null,
  created_at    timestamptz not null default now(),
  primary key (user_id, collection_id)
);

alter table collection_review_rewards enable row level security;
drop policy if exists "collection_review_rewards owner read" on collection_review_rewards;
create policy "collection_review_rewards owner read" on collection_review_rewards
  for select using (user_id = auth.uid() or is_staff());

create or replace function award_collection_review_points(
  p_user uuid,
  p_collection uuid
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_points int;
begin
  if p_user is null or p_collection is null
     or not feature_enabled('review_moderation') then
    return 0;
  end if;

  select coalesce((value->>'reviewPoints')::int, 0) into v_points
    from settings where key = 'loyalty';
  if coalesce(v_points, 0) <= 0 then
    return 0;
  end if;

  if not exists (
    select 1
      from orders o
      join order_items oi on oi.order_id = o.id
     where o.user_id = p_user
       and o.status = 'delivered'
       and o.payment_status = 'paid'
       and oi.collection_id = p_collection
       and not coalesce(oi.is_gift, false)
  ) then
    return 0;
  end if;

  if not exists (
    select 1 from reviews
     where user_id = p_user and collection_id = p_collection
       and status = 'approved'
  ) then
    return 0;
  end if;

  insert into collection_review_rewards (user_id, collection_id, points)
    values (p_user, p_collection, v_points)
    on conflict do nothing;
  if not found then
    return 0;
  end if;

  update profiles set loyalty_points = loyalty_points + v_points
    where id = p_user;
  insert into loyalty_ledger (user_id, delta, reason)
    values (p_user, v_points, 'review');
  return v_points;
end;
$$;

revoke all on function award_collection_review_points(uuid, uuid)
  from public, anon, authenticated;

-- 0121-ийн trigger функц + багц.
create or replace function trg_review_award_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.product_id is not null then
    perform award_review_points(new.user_id, new.product_id);
  elsif new.collection_id is not null then
    perform award_collection_review_points(new.user_id, new.collection_id);
  end if;
  return null;
end;
$$;
