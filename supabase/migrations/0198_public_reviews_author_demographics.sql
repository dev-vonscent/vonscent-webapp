-- Сэтгэгдлийн зохиогчийн нэрийн доор хүйс, насны ангиллын chip
-- (туг `profile_info`).
--
-- Төрсөн өдрийг ил гаргахгүй — зөвхөн ангиллын түлхүүр. Ангилал
-- (`REVIEW_AGE_GROUPS`, src/lib/constants.ts-тэй таарах ёстой), доод хил
-- орно, дээд хил орохгүй: 13-18 · 18-25 · 25-30 · 30-40 · 40-50 · 50+.
-- 13-аас доош бол null.
--
-- Expand only: `public_reviews`-ийн төгсгөлд хоёр багана. Туг хаалттай үед
-- хоёулаа null — профайлын өгөгдөл ил гарахгүй. Функц нь security definer
-- (0197-ийн сургамж: view доторх функцийн эрхийг anon эзэмших ёстой).

create or replace function review_author_age_group(p_birthday date)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_birthday is null then null
    else (
      select case
        when a >= 50 then '50+'
        when a >= 40 then '40-50'
        when a >= 30 then '30-40'
        when a >= 25 then '25-30'
        when a >= 18 then '18-25'
        when a >= 13 then '13-18'
      end
      from (
        select extract(year from age(
          (now() at time zone 'Asia/Ulaanbaatar')::date, p_birthday))::int as a
      ) x
    )
  end;
$$;

grant execute on function review_author_age_group(date)
  to anon, authenticated, service_role;

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
    r.is_featured,
    review_author_verified(r.user_id) as author_verified,
    case when feature_enabled('profile_info') then pf.gender end
      as author_gender,
    case when feature_enabled('profile_info')
      then review_author_age_group(pf.birthday) end
      as author_age_group
  from reviews r
  left join products p on p.id = r.product_id
  left join collections c on c.id = r.collection_id
  left join profiles pf on pf.id = r.user_id
  where r.status = 'approved' and r.is_visible;

grant select on public_reviews to anon, authenticated;
