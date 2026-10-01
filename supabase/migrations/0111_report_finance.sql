-- Санхүүгийн тайлан: борлуулалт ба ашгийг гэрээний тодорхойлолтоор
-- (docs/planning/report-audit.md §5, клиент/хөгжүүлэгч 2026-10-01).
--
-- ## Тодорхойлолт
--
-- **Цэвэр борлуулалт** — хөгжүүлэгчийн сарын хөлс (12%) үүнээс бодогдоно:
--
--   Σ (subtotal − купон − V-point)  тухайн мужид ҮҮССЭН төлсөн захиалгаар
--   − Σ (subtotal − купон − V-point)  тухайн мужид БУЦААГДСАН захиалгаар
--
--   Хүргэлт огт орохгүй. Буцаалт нь БУЦААСАН сардаа хасагдана — өнгөрсөн,
--   цалин нь бодогдсон сарын тоо хэзээ ч өөрчлөгдөхгүй. (Өмнө нь `refunded`
--   болсон захиалга үүссэн сараасаа ретроактиваар алга болдог байв — F6.)
--
-- **Ашиг** — клиент өөрөө харна:
--
--   цэвэр борлуулалт − QPay шимтгэл − барааны худалдан авалт + буцаалтын шимтгэл
--
--   * QPay шимтгэл = QPay-ээр төлөх захиалгын НИЙТ дүнгийн (хүргэлт орсон)
--     `p_qpay_pct` %. Хувийг app дамжуулна (`QPAY_FEE_PCT`, constants.ts).
--   * Хүргэлтийн төлбөр клиентийн дансанд орох ч клиент тэр чигээр нь
--     хүргэлтийн компанид төлдөг — дамжин өнгөрөх мөнгө, ашигт орохгүй.
--   * Худалдан авалт = `restock_log.cost` (эх сав + restock), бүртгэсэн огноогоор.
--   * Буцаалтын шимтгэл = хэрэглэгчийн хүсэлтээр цуцалсан захиалгын буцаалтаас
--     суутгасан 1% (refund.ts) — дэлгүүрт үлдэх мөнгө.
--
-- ## Бусад засвар
--
-- * Мужийн дээд хил EXCLUSIVE (`< p_to`) боллоо. `to = 23:59` үед
--   23:59:00–23:59:59 хооронд үүссэн захиалга ямар ч мужид ордоггүй байв (F13).
--   App нь `ubIsoEnd()`-ээр дараагийн минутыг дамжуулна.
-- * Зардлын түүх устахгүй (F10): эх савны үнэ нь `restock_log`-т 'initial'
--   мөр болж бичигдэнэ, бараа устгахад log үлдэнэ (`on delete set null`).

------------------------------------------------------------------------------
-- 1. Буцаалтын огноо ба суутгал
------------------------------------------------------------------------------

alter table orders add column if not exists refunded_at timestamptz;
alter table orders add column if not exists refund_fee int
  check (refund_fee is null or refund_fee >= 0);

comment on column orders.refunded_at is
  'Төлбөр буцаагдсан мөч. Тайлан буцаалтыг энэ огноогоор (захиалгын огноогоор биш) хасна.';
comment on column orders.refund_fee is
  'Буцаалтаас суутгасан шимтгэл (₮) — дэлгүүрт үлдсэн. Буцаасан дүн = total − refund_fee.';

-- Хуучин буцаалтууд: огноо нь түүхийн «Төлбөр буцаагдсан» мөрөөс. Суутгал
-- нь хадгалагдаагүй тул 0 — бүтэн дүн буцсан гэж үзнэ.
update orders o
   set refunded_at = coalesce(
         (select max(h.created_at) from order_status_history h
           where h.order_id = o.id and h.note = 'Төлбөр буцаагдсан'),
         o.updated_at),
       refund_fee = coalesce(o.refund_fee, 0)
 where o.payment_status = 'refunded' and o.refunded_at is null;

create index if not exists orders_refunded_at_idx
  on orders (refunded_at) where refunded_at is not null;

-- mark_order_refunded: 0094-ийн бие + огноо, суутгал. Суутгалыг route
-- `refundBreakdown()`-ээр бодож дамжуулна (нэг дүрэм, нэг газар).
drop function if exists mark_order_refunded(uuid, uuid);

create or replace function mark_order_refunded(
  p_order uuid, p_by uuid, p_fee int default 0
) returns jsonb language plpgsql as $$
declare
  v_status order_status_t;
  v_pay payment_status_t;
  v_total int;
begin
  select status, payment_status, total into v_status, v_pay, v_total
    from orders where id = p_order for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;

  -- Хоёр дахь даралт нь түүхэнд давхар мөр үлдээхгүй.
  if v_pay = 'refunded' then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  if v_pay <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'NOT_PAID');
  end if;
  if v_status not in ('cancelled', 'delivered') then
    return jsonb_build_object('ok', false, 'reason', 'NOT_CANCELLED');
  end if;

  update orders
     set payment_status = 'refunded',
         refunded_at = now(),
         refund_fee = least(greatest(coalesce(p_fee, 0), 0), v_total)
   where id = p_order;
  insert into order_status_history (order_id, status, note, changed_by)
    values (p_order, v_status, 'Төлбөр буцаагдсан', p_by);

  return jsonb_build_object('ok', true);
end $$;

-- 0088-ийн lockdown: мөнгөний RPC зөвхөн service_role.
revoke all on function mark_order_refunded(uuid, uuid, int) from public, anon, authenticated;
do $$ begin
  grant execute on function mark_order_refunded(uuid, uuid, int) to service_role;
exception when undefined_object then null; end $$;

------------------------------------------------------------------------------
-- 2. Зардлын түүх: эх сав нь restock_log-т, бараа устгахад үлдэнэ
------------------------------------------------------------------------------

alter table restock_log alter column product_id drop not null;

do $$
declare v_name text;
begin
  select conname into v_name from pg_constraint
   where conrelid = 'restock_log'::regclass and contype = 'f'
     and confrelid = 'products'::regclass;
  if v_name is not null then
    execute format('alter table restock_log drop constraint %I', v_name);
  end if;
  alter table restock_log add constraint restock_log_product_id_fkey
    foreign key (product_id) references products(id) on delete set null;
end $$;

-- Бараа устгагдсан ч тайлан/түүхэнд юу байсныг хэлнэ.
alter table restock_log add column if not exists product_label text;

-- 'initial' мөр: эх савны худалдан авалт. `delta_ml = 0` — анхны ml нь
-- `inventory.on_hand_ml`-д шууд ордог (бараа үүсгэх route), энд давхар
-- нэмбэл үлдэгдлийн түүх худлаа болно. Мөр нь зөвхөн ӨРТӨГИЙГ барина.
create or replace function products_initial_cost()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into restock_log (product_id, delta_ml, reason, cost, created_at, product_label)
    values (new.id, 0, 'initial', greatest(coalesce(new.bottle_price, 0), 0),
            new.created_at, new.brand || ' — ' || new.name);
  elsif new.bottle_price is distinct from old.bottle_price then
    -- Эх савны үнийг засах = анх бичсэн үнийг засах (алдаа засвар).
    update restock_log set cost = greatest(coalesce(new.bottle_price, 0), 0)
     where product_id = new.id and reason = 'initial';
  end if;
  return new;
end $$;

drop trigger if exists products_initial_cost on products;
create trigger products_initial_cost
  after insert or update of bottle_price on products
  for each row execute function products_initial_cost();

-- restock_inventory зэрэг бусад бичигч нэр дамжуулдаггүй тул нэрийг энд тавина.
create or replace function restock_log_label()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.product_label is null and new.product_id is not null then
    select p.brand || ' — ' || p.name into new.product_label
      from products p where p.id = new.product_id;
  end if;
  return new;
end $$;

drop trigger if exists restock_log_label on restock_log;
create trigger restock_log_label
  before insert on restock_log
  for each row execute function restock_log_label();

-- Хуучин мөрүүдэд нэр.
update restock_log r set product_label = p.brand || ' — ' || p.name
  from products p where p.id = r.product_id and r.product_label is null;

-- Одоо байгаа бараанд 'initial' мөр (өмнө нь зардал `products.bottle_price`-аас
-- шууд уншигддаг байсан — тоо өөрчлөгдөхгүй).
insert into restock_log (product_id, delta_ml, reason, cost, created_at, product_label)
select p.id, 0, 'initial', greatest(p.bottle_price, 0), p.created_at, p.brand || ' — ' || p.name
  from products p
 where not exists (
   select 1 from restock_log r where r.product_id = p.id and r.reason = 'initial'
 );

------------------------------------------------------------------------------
-- 3. Тайлан
------------------------------------------------------------------------------

drop function if exists admin_report_totals(timestamptz, timestamptz);
drop function if exists admin_report_monthly();
drop function if exists admin_report_series(timestamptz, timestamptz, text);

-- Мөнгөний үйл явдал: захиалга бүр «sale» мөр (үүссэн огноогоор), буцаагдсан
-- бол нэмж «refund» мөр (буцаасан огноогоор, тэмдэг нь урвуу). Бүх тоо —
-- totals, series, CSV — энэ НЭГ жагсаалтын нийлбэр тул хоорондоо зөрөхгүй.
create or replace function admin_report_events(
  p_from     timestamptz default null,
  p_to       timestamptz default null,
  p_qpay_pct numeric default 1
)
returns table (
  order_id     uuid,
  order_no     text,
  kind         text,
  at           timestamptz,
  contact_name text,
  status       text,
  payment_method text,
  goods        int,   -- барааны дүн (купоноос өмнө, sale/багцын үнэ орсон)
  coupon       int,
  points       int,
  net_goods    int,   -- goods − coupon − points  (цэвэр борлуулалт)
  shipping     int,   -- дамжин өнгөрөх, ашигт орохгүй
  cash         int,   -- дансанд орсон (+) / буцаасан (−)
  qpay_fee     int,
  refund_fee   int,
  ml           int
)
language sql
stable
security definer
set search_path = public
as $$
  with o as (
    select o.*,
           greatest(o.subtotal - o.discount - coalesce(o.loyalty_used, 0), 0) as net,
           (select coalesce(sum(i.ml * i.qty), 0) from order_items i where i.order_id = o.id) as ml_sold
      from orders o
     where is_staff() and o.payment_status in ('paid', 'refunded')
  )
  select o.id, o.order_no, 'sale', o.created_at, o.contact_name,
         o.status::text, o.payment_method::text,
         o.subtotal, o.discount, coalesce(o.loyalty_used, 0), o.net,
         o.shipping_fee, o.total,
         case when o.payment_method = 'qpay'
              then round(o.total * p_qpay_pct / 100)::int else 0 end,
         0, o.ml_sold::int
    from o
   where (p_from is null or o.created_at >= p_from)
     and (p_to   is null or o.created_at <  p_to)
  union all
  select o.id, o.order_no, 'refund', o.refunded_at, o.contact_name,
         o.status::text, o.payment_method::text,
         -o.subtotal, -o.discount, -coalesce(o.loyalty_used, 0), -o.net,
         -o.shipping_fee, -(o.total - coalesce(o.refund_fee, 0)),
         0, coalesce(o.refund_fee, 0), 0
    from o
   where o.payment_status = 'refunded' and o.refunded_at is not null
     and (p_from is null or o.refunded_at >= p_from)
     and (p_to   is null or o.refunded_at <  p_to)
  order by 4 desc, 3;
$$;

create or replace function admin_report_finance(
  p_from     timestamptz default null,
  p_to       timestamptz default null,
  p_qpay_pct numeric default 1
)
returns table (
  goods bigint, coupon bigint, points bigint, refunds bigint, net_sales bigint,
  shipping bigint, qpay_fee bigint, refund_fee bigint, purchases bigint,
  profit bigint, sale_orders bigint, refund_orders bigint,
  pending_refund_orders bigint, pending_refund_amount bigint
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
      count(*) filter (where kind = 'refund')                    as refund_orders
    from e
  ),
  buy as (
    select coalesce(sum(cost), 0) as purchases from restock_log
     where is_staff()
       and (p_from is null or created_at >= p_from)
       and (p_to   is null or created_at <  p_to)
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
  )
  select agg.goods::bigint, agg.coupon::bigint, agg.points::bigint,
         agg.refunds::bigint, agg.net_sales::bigint, agg.shipping::bigint,
         agg.qpay_fee::bigint, agg.refund_fee::bigint, buy.purchases::bigint,
         (agg.net_sales - agg.qpay_fee - buy.purchases + agg.refund_fee)::bigint,
         agg.sale_orders::bigint, agg.refund_orders::bigint,
         pend.n::bigint, pend.amt::bigint
    from agg, buy, pend;
$$;

create or replace function admin_report_series(
  p_from     timestamptz default null,
  p_to       timestamptz default null,
  p_bucket   text default 'month',
  p_qpay_pct numeric default 1
)
returns table (bucket text, revenue bigint, orders bigint, ml bigint)
language sql
stable
security definer
set search_path = public
as $$
  select to_char(e.at at time zone 'Asia/Ulaanbaatar',
                 case when p_bucket = 'day' then 'YYYY-MM-DD' else 'YYYY-MM' end),
         sum(e.net_goods)::bigint,
         count(*) filter (where e.kind = 'sale')::bigint,
         coalesce(sum(e.ml), 0)::bigint
    from admin_report_events(p_from, p_to, p_qpay_pct) e
   group by 1
   order by 1 desc;
$$;

-- Дээд хил exclusive — бусад тайлангийн функцууд ч ижил гэрээтэй.
create or replace function admin_report_top_products(
  p_limit int default 10,
  p_from  timestamptz default null,
  p_to    timestamptz default null
)
returns table (name text, brand text, qty bigint, revenue bigint)
language sql
stable
security definer
set search_path = public
as $$
  select i.product_name, i.brand, sum(i.qty)::bigint, sum(i.line_total)::bigint
  from order_items i join orders o on o.id = i.order_id
  where o.payment_status = 'paid' and is_staff()
    and (p_from is null or o.created_at >= p_from)
    and (p_to   is null or o.created_at <  p_to)
  group by i.product_name, i.brand
  order by 4 desc
  limit p_limit;
$$;

create or replace function admin_report_top_brands(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns table (brand text, revenue bigint)
language sql
stable
security definer
set search_path = public
as $$
  select i.brand, sum(i.line_total)::bigint
  from order_items i join orders o on o.id = i.order_id
  where o.payment_status = 'paid' and is_staff()
    and (p_from is null or o.created_at >= p_from)
    and (p_to   is null or o.created_at <  p_to)
  group by i.brand
  order by 2 desc;
$$;

create or replace function admin_report_status(
  p_from timestamptz default null,
  p_to   timestamptz default null
)
returns table (status text, count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select o.status::text, count(*)::bigint
  from orders o
  where is_staff()
    and (p_from is null or o.created_at >= p_from)
    and (p_to   is null or o.created_at <  p_to)
  group by 1;
$$;

revoke all on function admin_report_events(timestamptz, timestamptz, numeric) from public;
revoke all on function admin_report_finance(timestamptz, timestamptz, numeric) from public;
revoke all on function admin_report_series(timestamptz, timestamptz, text, numeric) from public;
grant execute on function admin_report_events(timestamptz, timestamptz, numeric) to authenticated;
grant execute on function admin_report_finance(timestamptz, timestamptz, numeric) to authenticated;
grant execute on function admin_report_series(timestamptz, timestamptz, text, numeric) to authenticated;
