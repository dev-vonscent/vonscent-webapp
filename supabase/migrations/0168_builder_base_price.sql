-- Багц угсрагчийн card-ууд хэмжээ тус бүрийн хямдралыг харуулна: RPC нь
-- бодитоор төлөх үнийн (`price`, variant_price()) хажуугаар үндсэн үнийг
-- (`basePrice`) буцаана. `basePrice > price` бол тэр хэмжээ хямдралтай.
--
-- Expand only: jsonb-д шинэ түлхүүр нэмэгдэнэ. Хуучин код түүнийг үл
-- тоомсорлоно; шинэ код түлхүүр байхгүй үед badge харуулахгүй.

create or replace function product_variants_for(p_ids uuid[])
returns table (
  product_id   uuid,
  available_ml int,
  variants     jsonb
)
language sql
stable
set search_path = public, extensions
as $$
  select
    p.id,
    coalesce(inv.available_ml, 0),
    coalesce((
      select jsonb_object_agg(
               pv.ml::text,
               jsonb_build_object(
                 'variantId', pv.id,
                 'price', variant_price(pv.*),
                 'basePrice', pv.price,
                 'inStock', variant_sellable(
                   pv.*, p.gender, inv.is_sold_out, inv.available_ml)
               )
             )
        from product_variants pv
       where pv.product_id = p.id and pv.is_active
    ), '{}'::jsonb)
  from products p
  left join inventory inv on inv.product_id = p.id
  where p.is_active
    and p_ids is not null
    and cardinality(p_ids) > 0
    and p.id = any (p_ids);
$$;
