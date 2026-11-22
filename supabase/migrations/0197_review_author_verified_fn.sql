-- 0196-ийн засвар: view доторх функцийн EXECUTE эрхийг view-ийн эзэн биш,
-- асууж буй хэрэглэгч (anon) эзэмших ёстой. `profile_info_complete` нь
-- anon/authenticated-аас revoke хийгдсэн (0163) тул `public_reviews`-ийн
-- бүх query «permission denied» болж, сэтгэгдэл харагдахгүй болсон.
--
-- `profile_info_complete`-ийг нээхийн оронд зөвхөн тэмдгийн хариуг (туг
-- хаалттай бол үргэлж false) буцаах нарийн wrapper-ийг нийтэд нээнэ.

create or replace function review_author_verified(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select feature_enabled('profile_info') and profile_info_complete(p_user);
$$;

revoke all on function review_author_verified(uuid) from public;
grant execute on function review_author_verified(uuid)
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
    review_author_verified(r.user_id) as author_verified
  from reviews r
  left join products p on p.id = r.product_id
  left join collections c on c.id = r.collection_id
  left join profiles pf on pf.id = r.user_id
  where r.status = 'approved' and r.is_visible;

grant select on public_reviews to anon, authenticated;
