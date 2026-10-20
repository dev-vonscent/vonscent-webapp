-- Тайлан v5 — худалдан авалт авсан өдрөөр, нэмэлт бараа ба сав (extras-shop-plan
-- §18.6; PR15). Feature flag: `extras_shop`, `vial_inventory` — тайлангийн шинэ
-- хэсэг UI-д тугаар; хаалттай үед нэмэлт бараа/савны худалдан авалт 0 тул
-- ашгийн тоо өөрчлөгдөхгүй.
--
-- 0111-ийн загвар хэвээр: Ашиг = цэвэр борлуулалт − QPay шимтгэл − худалдан
-- авалт + буцаалтын шимтгэл. Худалдан авалт нь бэлэн мөнгөний зарлага — бараа
-- зарагдах/хэрэглэгдэхийг хүлээлгүй, **авсан өдрөөр** (УБ календарь) бүтэн
-- дүнгээр. Үнэртэнтэй хамт гарсан сав орлого авчрахгүй — өртөг нь авах
-- үедээ аль хэдийн зарлага болсон («бүтэн зарлага», §18.1 №1).
--
--   1. restock_inventory — `p_purchased_on date default null` (null → УБ
--      өнөөдөр). Default-тай тул prod-ийн хуучин код 5 нэртэй аргументаар
--      merge хүртэл дуудсаар ажиллана (0149-ийн mark_order_refunded-тэй ижил).
--   2. admin_report_finance — худалдан авалт = restock_log + нэмэлт бараа +
--      сав, `purchased_on`-оор; задаргааны гурван багана.
--   3. admin_report_extras / admin_report_vials — «Нэмэлт бараа» хэсэг.

------------------------------------------------------------------------------
-- 0. Мужийн хил → УБ огноо
--
-- `p_to` нь exclusive timestamptz (app `ubIsoEnd()` дараагийн минутыг өгнө).
-- Огноо болгохдоо 1 микросекунд хасна: «өнөөдөр 14:00 хүртэл» мужид өнөөдрийн
-- худалдан авалт орно, «сарын 31-ний 23:59 хүртэл» мужид дараагийн өдөр орохгүй.
------------------------------------------------------------------------------

create or replace function report_day_in_range(
  p_day date, p_from timestamptz, p_to timestamptz
) returns boolean language sql immutable as $$
  select (p_from is null
          or p_day >= (p_from at time zone 'Asia/Ulaanbaatar')::date)
     and (p_to is null
          or p_day <= ((p_to - interval '1 microsecond')
                       at time zone 'Asia/Ulaanbaatar')::date);
$$;

------------------------------------------------------------------------------
-- 1. restock_inventory (0112-ын бие) + авсан өдөр
------------------------------------------------------------------------------

drop function if exists restock_inventory(uuid, int, text, uuid, int);

create or replace function restock_inventory(
  p_product uuid, p_delta int, p_reason text, p_by uuid, p_cost int default 0,
  p_purchased_on date default null
) returns void language plpgsql as $$
declare
  v_on_hand int;
  v_reserved int;
  v_day date := (now() at time zone 'Asia/Ulaanbaatar')::date;
begin
  -- Өдрийг өгсөн бол нээлттэй сарын дотор байх ёстой (0153).
  if p_purchased_on is not null and p_delta > 0 then
    v_day := purchase_date_check(p_purchased_on);
  end if;

  insert into inventory (product_id, on_hand_ml)
    values (p_product, 0)
  on conflict (product_id) do nothing;

  select on_hand_ml, reserved_ml
    into v_on_hand, v_reserved
    from inventory
   where product_id = p_product
     for update;

  if v_on_hand + p_delta < v_reserved then
    raise exception
      'RESERVED_FLOOR: reserved=% on_hand=% delta=%', v_reserved, v_on_hand, p_delta
      using errcode = 'check_violation';
  end if;

  update inventory
     set on_hand_ml = v_on_hand + p_delta
   where product_id = p_product;

  -- Хасалт бол худалдан авалт биш — өртөг нь үргэлж 0.
  insert into restock_log (product_id, delta_ml, reason, created_by, cost,
    purchased_on)
    values (p_product, p_delta, coalesce(p_reason, ''), p_by,
            case when p_delta > 0 then greatest(coalesce(p_cost, 0), 0) else 0 end,
            v_day);

  update inventory
     set is_sold_out = (on_hand_ml - reserved_ml) <= 0
   where product_id = p_product;
end $$;

revoke all on function restock_inventory(uuid, int, text, uuid, int, date)
  from public, anon, authenticated;
grant execute on function restock_inventory(uuid, int, text, uuid, int, date)
  to service_role;

-- Эх савны үнэ ('initial', 0111) — бараа үүссэн өдрөөр (УБ). Column default
-- нь «өнөөдөр» тул импорт/хуучин огноотой барааны зардал өөр сард орох байв.
create or replace function products_initial_cost()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into restock_log (product_id, delta_ml, reason, cost, created_at,
      product_label, purchased_on)
    values (new.id, 0, 'initial', greatest(coalesce(new.bottle_price, 0), 0),
            new.created_at, new.brand || ' — ' || new.name,
            (new.created_at at time zone 'Asia/Ulaanbaatar')::date);
  elsif new.bottle_price is distinct from old.bottle_price then
    -- Эх савны үнийг засах = анх бичсэн үнийг засах (алдаа засвар).
    update restock_log set cost = greatest(coalesce(new.bottle_price, 0), 0)
     where product_id = new.id and reason = 'initial';
  end if;
  return new;
end $$;

------------------------------------------------------------------------------
-- 2. admin_report_finance (0146) — худалдан авалт авсан өдрөөр, гурван эх
------------------------------------------------------------------------------

drop function if exists admin_report_finance(timestamptz, timestamptz, numeric);
create function admin_report_finance(
  p_from     timestamptz default null,
  p_to       timestamptz default null,
  p_qpay_pct numeric default 1
)
returns table (
  goods bigint, coupon bigint, points bigint, refunds bigint, net_sales bigint,
  shipping bigint, qpay_fee bigint, refund_fee bigint, purchases bigint,
  profit bigint, sale_orders bigint, refund_orders bigint,
  pending_refund_orders bigint, pending_refund_amount bigint,
  extras_goods bigint,      -- 0146: goods-ийн нэмэлт барааны хэсэг (sale)
  perfume_purchases bigint, -- 0156: purchases-ийн задаргаа
  extras_purchases bigint,
  vial_purchases bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with e as (select * from admin_report_events(p_from, p_to, p_qpay_pct)),
  agg as (
    select
      coalesce(sum(goods)     filter (where kind = 'sale'), 0)   as goods,
      coalesce(sum(coupon)    filter (where kind = 'sale'), 0)   as coupon,
      coalesce(sum(points)    filter (where kind = 'sale'), 0)   as points,
      coalesce(-sum(net_goods) filter (where kind = 'refund'), 0) as refunds,
      coalesce(sum(net_goods), 0)                                as net_sales,
      coalesce(sum(shipping)  filter (where kind = 'sale'), 0)   as shipping,
      coalesce(sum(qpay_fee), 0)                                 as qpay_fee,
      coalesce(sum(refund_fee), 0)                               as refund_fee,
      count(*) filter (where kind = 'sale')                      as sale_orders,
      count(*) filter (where kind = 'refund')                    as refund_orders,
      coalesce(sum(extras_goods) filter (where kind = 'sale'), 0) as extras_goods
    from e
  ),
  buy as (
    select
      (select coalesce(sum(cost), 0) from restock_log
        where report_day_in_range(purchased_on, p_from, p_to)) as perfume,
      (select coalesce(sum(cost), 0) from extra_movements
        where kind = 'purchase'
          and report_day_in_range(purchased_on, p_from, p_to)) as extras,
      (select coalesce(sum(cost), 0) from vial_movements
        where kind = 'purchase'
          and report_day_in_range(purchased_on, p_from, p_to)) as vials
     where is_staff()
  ),
  -- Мэдээлэл: цуцлагдсан боловч мөнгө нь буцаагдаагүй (одоогийн байдлаар).
  -- Борлуулалтад тоологдсон хэвээр — буцаалт бүртгэгдсэн сард хасагдана.
  pend as (
    select count(*) as n,
           coalesce(sum(greatest(subtotal - discount - coalesce(loyalty_used, 0), 0)), 0) as amt
      from orders
     where is_staff() and status = 'cancelled' and payment_status = 'paid'
       and (p_from is null or created_at >= p_from)
       and (p_to   is null or created_at <  p_to)
  ),
  b as (
    select coalesce(perfume, 0) as perfume, coalesce(extras, 0) as extras,
           coalesce(vials, 0) as vials
      from (select 1) one left join buy on true
  )
  select agg.goods::bigint, agg.coupon::bigint, agg.points::bigint,
         agg.refunds::bigint, agg.net_sales::bigint, agg.shipping::bigint,
         agg.qpay_fee::bigint, agg.refund_fee::bigint,
         (b.perfume + b.extras + b.vials)::bigint,
         (agg.net_sales - agg.qpay_fee - (b.perfume + b.extras + b.vials)
          + agg.refund_fee)::bigint,
         agg.sale_orders::bigint, agg.refund_orders::bigint,
         pend.n::bigint, pend.amt::bigint, agg.extras_goods::bigint,
         b.perfume::bigint, b.extras::bigint, b.vials::bigint
    from agg, b, pend;
$$;

revoke all on function admin_report_finance(timestamptz, timestamptz, numeric) from public;
grant execute on function admin_report_finance(timestamptz, timestamptz, numeric) to authenticated;

------------------------------------------------------------------------------
-- 3. «Нэмэлт бараа» — ангилал бүрээр (§18.6)
--
-- Борлуулалт = мужид төлсөн (sale) захиалгын нэмэлт барааны мөрийн дүн,
-- купоноос өмнө (купон, оноо захиалгын түвшинд үлдэнэ — §6.1). Худалдан авалт =
-- тэр ангиллын `purchase` хөдөлгөөн, авсан өдрөөр. Зөрүү = борлуулалт −
-- худалдан авалт (бэлэн мөнгөний; нэг бүрчилсэн маржин биш).
------------------------------------------------------------------------------

create or replace function admin_report_extras(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns table (
  category_slug text, category_name text, sort int,
  sales bigint, sold_qty bigint, purchases bigint, purchased_qty bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with sold as (
    select p.category_id, sum(oi.line_total) as amt, sum(oi.qty) as qty
      from admin_report_events(p_from, p_to, 0) e
      join order_items oi on oi.order_id = e.order_id and oi.line_kind = 'extra'
      join extra_products p on p.id = oi.extra_product_id
     where e.kind = 'sale'
     group by p.category_id
  ),
  bought as (
    select p.category_id, sum(m.cost) as amt, sum(m.delta_on_hand) as qty
      from extra_movements m
      join extra_variants v on v.id = m.extra_variant_id
      join extra_products p on p.id = v.extra_id
     where m.kind = 'purchase'
       and report_day_in_range(m.purchased_on, p_from, p_to)
     group by p.category_id
  )
  select c.slug, c.name, c.sort,
         coalesce(s.amt, 0)::bigint, coalesce(s.qty, 0)::bigint,
         coalesce(b.amt, 0)::bigint, coalesce(b.qty, 0)::bigint
    from extra_categories c
    left join sold s on s.category_id = c.id
    left join bought b on b.category_id = c.id
   where is_staff()
     and (c.is_active or s.amt is not null or b.amt is not null)
   order by c.sort;
$$;

------------------------------------------------------------------------------
-- 4. Сав — өнгө × хэмжээ (§18.6)
--
-- Хэрэглээ = мужид хүргэгдсэн (`commit`) мөр: үнэртний декант, бэлгийн 1ml
-- дээж, дангаар зарсан сав тусдаа. Худалдан авалт авсан өдрөөр. Үлдэгдэл
-- одоогийнх (мужаас үл хамаарна).
------------------------------------------------------------------------------

create or replace function admin_report_vials(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns table (
  vial_id uuid, style text, ml int,
  purchased_qty bigint, purchases bigint,
  used_perfume bigint, used_gift bigint, sold_standalone bigint,
  on_hand int, reserved int
)
language sql
stable
security definer
set search_path = public
as $$
  with used as (
    select m.vial_id,
           sum(-m.delta_reserved) filter (
             where oi.line_kind = 'perfume'
               and not (oi.is_gift or oi.is_sample)) as perfume,
           sum(-m.delta_reserved) filter (
             where oi.line_kind = 'perfume'
               and (oi.is_gift or oi.is_sample)) as gift,
           sum(-m.delta_reserved) filter (where oi.line_kind = 'extra') as extra
      from vial_movements m
      join order_items oi on oi.id = m.order_item_id
     where m.kind = 'commit'
       and (p_from is null or m.created_at >= p_from)
       and (p_to   is null or m.created_at <  p_to)
     group by m.vial_id
  ),
  bought as (
    select vial_id, sum(delta_on_hand) as qty, sum(cost) as amt
      from vial_movements
     where kind = 'purchase'
       and report_day_in_range(purchased_on, p_from, p_to)
     group by vial_id
  )
  select v.id, v.style, v.ml,
         coalesce(b.qty, 0)::bigint, coalesce(b.amt, 0)::bigint,
         coalesce(u.perfume, 0)::bigint, coalesce(u.gift, 0)::bigint,
         coalesce(u.extra, 0)::bigint,
         v.on_hand, v.reserved
    from vials v
    left join used u on u.vial_id = v.id
    left join bought b on b.vial_id = v.id
   where is_staff()
   order by v.ml, v.style nulls first;
$$;

revoke all on function admin_report_extras(timestamptz, timestamptz) from public;
revoke all on function admin_report_vials(timestamptz, timestamptz) from public;
grant execute on function admin_report_extras(timestamptz, timestamptz) to authenticated;
grant execute on function admin_report_vials(timestamptz, timestamptz) to authenticated;
