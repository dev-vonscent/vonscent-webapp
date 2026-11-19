-- Сэтгэгдлийн зохиогчийн verified тэмдэг (туг `profile_info`).
--
-- Нүүрний сэтгэгдлийн хэсэг тэмдгийг бүх зохиогчид нөхцөлгүй харуулдаг
-- байв. Одоо «Миний мэдээлэл»-ийг бүрэн бөглөсөн (`profile_info_complete`,
-- 0163 — V point олгох нөхцөлтэй адил) зохиогчид л.
--
-- Expand only: 0162-ийн view-ийн төгсгөлд нэг багана. Туг хаалттай үед
-- үргэлж false — хэн мэдээллээ бөглөсөн нь ил гарахгүй. View нь owner
-- эрхээр ажилладаг тул `profile_info_complete`-ийн revoke-д хамаарахгүй.

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
    (feature_enabled('profile_info') and profile_info_complete(r.user_id))
      as author_verified
  from reviews r
  left join products p on p.id = r.product_id
  left join collections c on c.id = r.collection_id
  left join profiles pf on pf.id = r.user_id
  where r.status = 'approved' and r.is_visible;

grant select on public_reviews to anon, authenticated;
