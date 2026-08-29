-- The admin sidebar's "out of stock" badge pulled up to 10,000 inventory rows
-- on every admin navigation and counted them in JS, because PostgREST cannot
-- compare two columns in a filter. A stored generated column makes the
-- comparison a plain predicate, so the badge becomes a `count` query.
--
-- `available_ml` is the same expression the app has always used
-- (0004_inventory.sql:21) — now materialised and indexed.

alter table inventory
  add column if not exists available_ml int
  generated always as (on_hand_ml - reserved_ml) stored;

-- Partial index: the only question ever asked of this column is "which active
-- products have run out", so index just that end of the range.
create index if not exists inventory_available_ml_empty_idx
  on inventory (product_id)
  where available_ml <= 0;

comment on column inventory.available_ml is
  'on_hand_ml - reserved_ml. Generated; never write to it.';

-- ── Dashboard revenue ────────────────────────────────────────────────────────
-- The three revenue figures were summed in JS from a `select(...)` that had no
-- explicit limit, so PostgREST's db-max-rows silently capped them: past ~1000
-- paid orders in the window the dashboard was quietly wrong. Summing in SQL
-- removes the cap and the round-trip.
--
-- Борлуулалт = subtotal - discount - loyalty_used, floored at 0, shipping
-- excluded (requirement_final.md «Борлуулалт бодох арга»).

create or replace function admin_revenue_windows(
  p_today timestamptz,
  p_7d timestamptz,
  p_30d timestamptz
)
returns table (sales_today bigint, sales_7d bigint, sales_30d bigint)
language sql
stable
security definer
set search_path = public
as $$
  -- SECURITY DEFINER bypasses RLS, and `authenticated` includes every customer.
  -- Without this gate any signed-in shopper could read the shop's revenue.
  select
    coalesce(sum(rev) filter (where created_at >= p_today), 0)::bigint,
    coalesce(sum(rev) filter (where created_at >= p_7d), 0)::bigint,
    coalesce(sum(rev) filter (where created_at >= p_30d), 0)::bigint
  from (
    select
      created_at,
      greatest(subtotal - discount - coalesce(loyalty_used, 0), 0) as rev
    from orders
    where payment_status = 'paid'
      and created_at >= least(p_today, p_7d, p_30d)
      and is_staff()
  ) o;
$$;

revoke all on function admin_revenue_windows(timestamptz, timestamptz, timestamptz) from public;
grant execute on function admin_revenue_windows(timestamptz, timestamptz, timestamptz) to authenticated;

-- ── Report aggregates ────────────────────────────────────────────────────────
-- `getReportData` fetched every paid order_item, every order, every product
-- price and every restock row and summed them in JS, each with a limit (or
-- none, which means PostgREST's db-max-rows). The profit figures the shop
-- plans on were therefore capped. All four aggregates move into SQL.

create or replace function admin_report_totals()
returns table (total_revenue bigint, paid_orders bigint, total_cost bigint)
language sql
stable
security definer
set search_path = public
as $$
  -- `is_staff()` on every subquery: SECURITY DEFINER bypasses RLS and
  -- `authenticated` includes customers.
  select
    coalesce((
      select sum(greatest(subtotal - discount - coalesce(loyalty_used, 0), 0))
      from orders where payment_status = 'paid' and is_staff()
    ), 0)::bigint,
    coalesce((
      select count(*) from orders where payment_status = 'paid' and is_staff()
    ), 0)::bigint,
    -- Зардал: every bottle's purchase price + every restock's recorded cost.
    (coalesce((select sum(bottle_price) from products where is_staff()), 0)
     + coalesce((select sum(cost) from restock_log where is_staff()), 0))::bigint;
$$;

create or replace function admin_report_monthly()
returns table (month text, revenue bigint, orders bigint, ml bigint)
language sql
stable
security definer
set search_path = public
as $$
  with paid as (
    select id, created_at,
           greatest(subtotal - discount - coalesce(loyalty_used, 0), 0) as rev
    from orders where payment_status = 'paid' and is_staff()
  ),
  -- Source ml given up that month, counted from the line items.
  sold as (
    select o.id, sum(i.ml * i.qty) as ml
    from paid o join order_items i on i.order_id = o.id
    group by o.id
  )
  select to_char(p.created_at, 'YYYY-MM'),
         sum(p.rev)::bigint,
         count(*)::bigint,
         coalesce(sum(s.ml), 0)::bigint
  from paid p left join sold s on s.id = p.id
  group by 1
  order by 1 desc;
$$;

create or replace function admin_report_top_products(p_limit int default 10)
returns table (name text, brand text, qty bigint, revenue bigint)
language sql
stable
security definer
set search_path = public
as $$
  select i.product_name, i.brand, sum(i.qty)::bigint, sum(i.line_total)::bigint
  from order_items i join orders o on o.id = i.order_id
  where o.payment_status = 'paid' and is_staff()
  group by i.product_name, i.brand
  order by 4 desc
  limit p_limit;
$$;

create or replace function admin_report_top_brands()
returns table (brand text, revenue bigint)
language sql
stable
security definer
set search_path = public
as $$
  select i.brand, sum(i.line_total)::bigint
  from order_items i join orders o on o.id = i.order_id
  where o.payment_status = 'paid' and is_staff()
  group by i.brand
  order by 2 desc;
$$;

revoke all on function admin_report_totals() from public;
revoke all on function admin_report_monthly() from public;
revoke all on function admin_report_top_products(int) from public;
revoke all on function admin_report_top_brands() from public;
grant execute on function admin_report_totals() to authenticated;
grant execute on function admin_report_monthly() to authenticated;
grant execute on function admin_report_top_products(int) to authenticated;
grant execute on function admin_report_top_brands() to authenticated;
