-- Нүүрний «Эрэлттэй» rail ус ба багцыг хольж харуулна — багцыг ч мөн
-- төлөгдсөн борлуулалтаар эрэмбэлэх хэрэгтэй (`top_seller_products`, 0034-ийн
-- ихэр).
--
-- Багц захиалгад гишүүн бүрээрээ тусдаа мөр болж ордог (0029b: мөр бүр
-- `collection_id`-тэй, ижил qty-тэй). Тиймээс нэг захиалга доторх тухайн
-- багцын мөрүүдийн хамгийн их qty = тэр захиалгад зарагдсан багцын тоо.
-- Зөвхөн админы идэвхтэй ('base') багц — хэрэглэгчийн өөрөө угсарсан
-- ('custom') багц нүүрэнд гарахгүй.

create or replace function top_seller_collections(p_limit int default 12)
returns table (collection_id uuid, sold_qty bigint)
language sql
security definer
set search_path = public
stable
as $$
  select per_order.collection_id, sum(per_order.qty)::bigint as sold_qty
  from (
    select oi.order_id, oi.collection_id, max(oi.qty) as qty
    from order_items oi
    join orders o on o.id = oi.order_id
    join collections c on c.id = oi.collection_id
    where o.payment_status = 'paid'
      and oi.is_gift = false
      and c.type = 'base'
      and c.is_active
    group by oi.order_id, oi.collection_id
  ) per_order
  group by per_order.collection_id
  order by sold_qty desc, per_order.collection_id
  limit greatest(coalesce(p_limit, 12), 1);
$$;

grant execute on function top_seller_collections(int) to anon, authenticated;
