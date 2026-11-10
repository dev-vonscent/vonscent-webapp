-- Бэлгийн карт: сануулга, товлосон илгээлтийн баримт, тайлан
-- (docs/planning/gift-cards-plan.md §6.3, §7). Feature flag: `gift_cards`.
--
-- Expand only: nullable багана, check өргөтгөл, тайлангийн функцэд шинэ
-- багана (хуучин багануудын нэр, утга хэвээр). Туг хаалттай prod дээр
-- `order_type = 'gift_card'` мөр байхгүй тул тайлангийн тоо өөрчлөгдөхгүй.

------------------------------------------------------------------------------
-- 1. Сануулга, худалдан авагчийн баримт — нэг удаа явснаа тэмдэглэх
------------------------------------------------------------------------------

alter table gift_cards
  -- Худалдан авагчийн баримт (товлосон картад хүлээн авагчийн имэйлээс
  -- тусдаа, төлбөр орсон даруйд).
  add column if not exists buyer_notified_at timestamptz,
  -- Илгээгдсэнээс 7 хоног болоход ашиглаагүй бол нэг удаа.
  add column if not exists reminded_unused_at timestamptz,
  -- Хугацаа дуусахаас 30 / 7 хоногийн өмнө.
  add column if not exists reminded_expiry_30_at timestamptz,
  add column if not exists reminded_expiry_7_at timestamptz;

alter table gift_card_events drop constraint if exists gift_card_events_kind_check;
alter table gift_card_events add constraint gift_card_events_kind_check
  check (kind in (
    'issued', 'sent', 'send_failed', 'resent', 'email_changed',
    'redeemed', 'expired', 'voided',
    'reminded', 'buyer_notified'));

create index if not exists gift_cards_reminder_idx on gift_cards (sent_at)
  where status = 'active' and recipient_email is not null;

------------------------------------------------------------------------------
-- 2. Тайлан (§7): «Бэлгийн карт» борлуулалтаас тусдаа мөр
--
-- `goods` нь `subtotal` хэвээр (карт орно) — Цэвэр борлуулалт, QPay шимтгэл,
-- ашгийн томьёо өөрчлөгдөхгүй: карт зарагдсан сардаа бүтэн дүнгээр орлого
-- (K9), дараа нь оноогоор төлсөн хэсэг `points`-оор хасагдана (K10).
-- Шинэ `gift_card_goods` нь `goods`-ийн картын хэсэг; `perfume_goods` нь
-- картыг ч хасна (perfume + extras + gift_card = goods).
------------------------------------------------------------------------------

drop function if exists admin_report_events(timestamptz, timestamptz, numeric);
create function admin_report_events(
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
  goods        int,
  coupon       int,
  points       int,
  net_goods    int,
  shipping     int,
  cash         int,
  qpay_fee     int,
  refund_fee   int,
  ml           int,
  perfume_goods int,
  extras_goods  int,
  gift_card_goods int   -- 0180
)
language sql
stable
security definer
set search_path = public
as $$
  with o as (
    select o.*,
           greatest(o.subtotal - o.discount - coalesce(o.loyalty_used, 0), 0) as net,
           coalesce(o.refund_amount, o.total - coalesce(o.refund_fee, 0)) as refunded_cash,
           li.ml_sold, li.extras, li.gift
      from orders o
      cross join lateral (
        select coalesce(sum(i.ml * i.qty) filter (where i.line_kind = 'perfume'), 0) as ml_sold,
               coalesce(sum(i.line_total) filter (where i.line_kind = 'extra'), 0) as extras,
               coalesce(sum(i.line_total) filter (where i.line_kind = 'gift_card'), 0) as gift
          from order_items i where i.order_id = o.id
      ) li
     where is_staff() and o.payment_status in ('paid', 'refunded')
  )
  select o.id, o.order_no, 'sale', o.created_at, o.contact_name,
         o.status::text, o.payment_method::text,
         o.subtotal, o.discount, coalesce(o.loyalty_used, 0), o.net,
         o.shipping_fee, o.total,
         case when o.payment_method = 'qpay'
              then round(o.total * p_qpay_pct / 100)::int else 0 end,
         0, o.ml_sold::int,
         (o.subtotal - o.extras - o.gift)::int, o.extras::int, o.gift::int
    from o
   where (p_from is null or o.created_at >= p_from)
     and (p_to   is null or o.created_at <  p_to)
  union all
  select o.id, o.order_no, 'refund', o.refunded_at, o.contact_name,
         o.status::text, o.payment_method::text,
         -o.subtotal, -o.discount, -coalesce(o.loyalty_used, 0), -o.net,
         -least(greatest(o.refunded_cash + coalesce(o.refund_fee, 0) - o.net, 0),
                o.shipping_fee),
         -o.refunded_cash,
         0, coalesce(o.refund_fee, 0), -o.ml_sold::int,
         -(o.subtotal - o.extras - o.gift)::int, -o.extras::int, -o.gift::int
    from o
   where o.payment_status = 'refunded' and o.refunded_at is not null
     and (p_from is null or o.refunded_at >= p_from)
     and (p_to   is null or o.refunded_at <  p_to)
  order by 4 desc, 3;
$$;

revoke all on function admin_report_events(timestamptz, timestamptz, numeric) from public;
grant execute on function admin_report_events(timestamptz, timestamptz, numeric) to authenticated;

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
  extras_goods bigint,
  perfume_purchases bigint,
  extras_purchases bigint,
  vial_purchases bigint,
  -- 0180: бэлгийн карт
  gift_card_goods bigint,       -- мужид зарагдсан (goods-ийн хэсэг)
  gift_card_sold bigint,        -- зарагдсан картын тоо
  gift_card_redeemed bigint,    -- мужид оноо болсон дүн (мэдээлэл)
  gift_card_expired bigint,     -- мужид хугацаа нь дууссан дүн (мэдээлэл)
  gift_card_outstanding bigint  -- одоогийн ашиглагдаагүй үлдэгдэл (өр төлбөр)
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
      coalesce(sum(extras_goods) filter (where kind = 'sale'), 0) as extras_goods,
      coalesce(sum(gift_card_goods) filter (where kind = 'sale'), 0) as gift_goods,
      count(*) filter (where kind = 'sale' and gift_card_goods > 0) as gift_sold
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
  pend as (
    select count(*) as n,
           coalesce(sum(greatest(subtotal - discount - coalesce(loyalty_used, 0), 0)), 0) as amt
      from orders
     where is_staff() and status = 'cancelled' and payment_status = 'paid'
       and (p_from is null or created_at >= p_from)
       and (p_to   is null or created_at <  p_to)
  ),
  gc as (
    select
      coalesce(sum(amount) filter (
        where status = 'redeemed'
          and (p_from is null or redeemed_at >= p_from)
          and (p_to   is null or redeemed_at <  p_to)), 0) as redeemed,
      coalesce(sum(amount) filter (
        where status = 'expired'
          and (p_from is null or expires_at >= p_from)
          and (p_to   is null or expires_at <  p_to)), 0) as expired,
      coalesce(sum(amount) filter (where status = 'active'), 0) as outstanding
      from gift_cards
     where is_staff()
  ),
  b as (
    select coalesce(perfume, 0) as perfume, coalesce(extras, 0) as extras,
           coalesce(vials, 0) as vials
      from (select 1) one left join buy on true
  ),
  g as (
    select coalesce(redeemed, 0) as redeemed, coalesce(expired, 0) as expired,
           coalesce(outstanding, 0) as outstanding
      from (select 1) one left join gc on true
  )
  select agg.goods::bigint, agg.coupon::bigint, agg.points::bigint,
         agg.refunds::bigint, agg.net_sales::bigint, agg.shipping::bigint,
         agg.qpay_fee::bigint, agg.refund_fee::bigint,
         (b.perfume + b.extras + b.vials)::bigint,
         (agg.net_sales - agg.qpay_fee - (b.perfume + b.extras + b.vials)
          + agg.refund_fee)::bigint,
         agg.sale_orders::bigint, agg.refund_orders::bigint,
         pend.n::bigint, pend.amt::bigint, agg.extras_goods::bigint,
         b.perfume::bigint, b.extras::bigint, b.vials::bigint,
         agg.gift_goods::bigint, agg.gift_sold::bigint,
         g.redeemed::bigint, g.expired::bigint, g.outstanding::bigint
    from agg, b, pend, g;
$$;

revoke all on function admin_report_finance(timestamptz, timestamptz, numeric) from public;
grant execute on function admin_report_finance(timestamptz, timestamptz, numeric) to authenticated;
