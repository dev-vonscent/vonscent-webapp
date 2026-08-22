-- Best sellers ranked by actual paid sales (client decision, questions.md №26:
-- «автоматаар харуулна»). order_items/orders are RLS-protected, so the
-- storefront gets the ranking through a security-definer function that
-- exposes nothing but product ids and quantities.

create or replace function top_seller_products(p_limit int default 20)
returns table (product_id uuid, sold_qty bigint)
language sql
security definer
set search_path = public
stable
as $$
  select oi.product_id, sum(oi.qty)::bigint as sold_qty
  from order_items oi
  join orders o on o.id = oi.order_id
  where o.payment_status = 'paid'
    and oi.product_id is not null
    and oi.is_gift = false
  group by oi.product_id
  order by sold_qty desc
  limit greatest(coalesce(p_limit, 20), 1);
$$;

grant execute on function top_seller_products(int) to anon, authenticated;
