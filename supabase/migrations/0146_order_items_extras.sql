-- Захиалгын мөр нэмэлт бараа хүлээн авахад бэлэн болно (extras-shop-plan §5.4,
-- §6.1; PR2). Feature flag: `extras_shop`.
--
-- Expand only. Энэ migration-ий дараа ч нэмэлт барааны мөр ҮҮСЭХГҮЙ —
-- `place_order` нь зөвхөн үнэртний мөр бичсээр (0144). Мөрийн төрөл,
-- хувилбарын хуулбар, нөөцийн төлөвийн баганууд, тайлангийн шинэ баганууд л
-- нэмэгдэнэ; харуулдаг бүх газар (`line_kind`-аар) урьдчилж бэлдэгдэнэ.
--
-- `orders_total_chk` (нийт дүнгийн invariant) энд НЭМЭГДЭХГҮЙ: 0144-ийн
-- `place_order` захиалгыг subtotal/total = 0-ээр оруулаад дараа нь
-- шинэчилдэг тул check нь хүргэлттэй захиалга бүрийг унагана. Шинэ
-- `place_order` (PR6) бүх дүнг insert-ээс өмнө боддог болсон үед тэнд нэмнэ.

------------------------------------------------------------------------------
-- 1. order_items
------------------------------------------------------------------------------

alter table order_items
  add column if not exists line_kind text not null default 'perfume'
    check (line_kind in ('perfume', 'extra')),
  add column if not exists extra_variant_id uuid,
  add column if not exists extra_product_id uuid,
  add column if not exists extra_inventory_mode extra_inventory_mode_t,
  -- Зарсан мөчийн хуулбар: «Хар», «18 / 100ml».
  add column if not exists variant_label text,
  add column if not exists image_url text,
  add column if not exists extra_state text
    check (extra_state in ('reserved', 'committed', 'released')),
  -- Энэ мөрөнд түгжсэн хоосон сав (үнэртэн ч, тусад нь зарсан грамын сав ч).
  add column if not exists vial_id uuid references vials(id),
  add column if not exists vial_state text
    check (vial_state in ('reserved', 'committed', 'released')),
  -- Хүргэгдсэний дараах буцаалтад нөөцөд буцаасан ширхэг (§6.5) — эцсийн нийт.
  add column if not exists restocked_qty int not null default 0;

alter table order_items alter column ml drop not null;

do $$
begin
  alter table order_items add constraint order_items_restocked_qty_chk
    check (restocked_qty >= 0 and restocked_qty <= qty);
exception when duplicate_object then null;
end $$;

-- Хувилбар нь snapshot-ийн бараанд, горимд үнэхээр харьяалагдана.
do $$
begin
  alter table order_items add constraint order_items_extra_fk
    foreign key (extra_variant_id, extra_product_id, extra_inventory_mode)
    references extra_variants (id, extra_id, inventory_mode);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table order_items add constraint order_items_kind_chk check (
    (line_kind = 'perfume'
       and ml is not null and extra_variant_id is null
       and extra_product_id is null and extra_inventory_mode is null
       and extra_state is null and restocked_qty = 0)
    or
    (line_kind = 'extra'
       and ml is null and product_id is null and variant_id is null
       and collection_id is null and not is_gift and not is_sample
       and extra_variant_id is not null and extra_product_id is not null
       and extra_inventory_mode is not null and extra_state is not null
       and ((extra_inventory_mode = 'shared_vial') = (vial_id is not null)))
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table order_items add constraint order_items_vial_chk
    check ((vial_id is null) = (vial_state is null));
exception when duplicate_object then null;
end $$;

-- Мөнгөний invariant (§6.1). Хуучин өгөгдөл зөрчилгүй бол шууд VALIDATE —
-- `not valid` нь шинэ, ШИНЭЧЛЭГДЭХ мөр бүрийг шалгадаг тул зөрчилтэй хуучин
-- мөр байхад update бүр унах байсан. Зөрчилтэй бол нэмэхгүй, NOTICE өгнө —
-- reconciliation (§14) тэдгээрийг харуулна.
do $$
declare
  v_bad int;
begin
  if exists (select 1 from pg_constraint
              where conname = 'order_items_line_total_chk') then
    return;
  end if;
  select count(*) into v_bad from order_items
   where line_total <> unit_price * qty;
  if v_bad = 0 then
    alter table order_items add constraint order_items_line_total_chk
      check (line_total = unit_price * qty);
  else
    raise notice 'order_items_line_total_chk: % зөрчилтэй мөр — нэмсэнгүй', v_bad;
  end if;
end $$;

create index if not exists order_items_extra_variant_idx
  on order_items (extra_variant_id) where extra_variant_id is not null;
create index if not exists order_items_vial_reserved_idx
  on order_items (vial_id) where vial_state = 'reserved';

comment on column order_items.line_kind is
  'perfume = декант (ml-тэй), extra = нэмэлт бараа (ml null, extra_* бөглөгдсөн).';
comment on column order_items.extra_state is
  'Нэмэлт барааны нөөцийн төлөв: reserved → committed (хүргэгдэх) | released.';
comment on column order_items.vial_state is
  'Хоосон савны нөөцийн төлөв: reserved → committed (хүргэгдэх) | released.';

------------------------------------------------------------------------------
-- 2. orders
------------------------------------------------------------------------------

-- `cancelled → pending` сэргээлт бүрт нэмэгдэнэ — хөдөлгөөний event_key-д
-- орж, сэргээлтийн дараах дахин reserve нь шинэ түлхүүртэй болно (§6.3).
alter table orders
  add column if not exists lifecycle_cycle int not null default 0
    check (lifecycle_cycle >= 0);

-- Захиалах мөчид хасагдсан бэлэг: [{product_id, reason: 'threshold'|'vial'}].
-- Reload / retry үед сангаас ижил харагдана (§6.2).
alter table orders add column if not exists omitted_gifts jsonb
  check (omitted_gifts is null or jsonb_typeof(omitted_gifts) = 'array');

------------------------------------------------------------------------------
-- 3. mark_order_refunded — 0114-ийн бие; ml-ийн нийлбэр зөвхөн үнэртнийх
--
-- Нэмэлт барааны мөр ml-гүй тул `v_ml + null` бүх тэмдэглэлийг null болгох
-- байсан. Signature хэвээр — мөр бүрийн restock (§6.5) нь PR6-д.
------------------------------------------------------------------------------

create or replace function mark_order_refunded(
  p_order uuid, p_by uuid, p_fee int default 0, p_restock boolean default null
) returns jsonb language plpgsql as $$
declare
  v_status order_status_t;
  v_pay payment_status_t;
  v_total int;
  v_shipping int;
  v_fee int;
  v_amount int;
  v_item record;
  v_ml int := 0;
  v_note text := 'Төлбөр буцаагдсан';
begin
  select status, payment_status, total, coalesce(shipping_fee, 0)
    into v_status, v_pay, v_total, v_shipping
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

  if v_status = 'delivered' then
    -- Декантын хувь заяаг админ заавал шийднэ — эс бөгөөс ml-ийн хасалт
    -- тайлбаргүй үлдэнэ.
    if p_restock is null then
      return jsonb_build_object('ok', false, 'reason', 'RESTOCK_REQUIRED');
    end if;

    -- Цуцлалттай ижил: ашигласан V point ба купон буцна, олсон V point ба
    -- урамшууллын купон хүчингүй.
    perform reverse_order_loyalty(p_order);
    perform release_order_coupons(p_order);
    perform revoke_order_reward_coupon(p_order);

    for v_item in
      select product_id, ml, qty from order_items
       where order_id = p_order and line_kind = 'perfume'  -- 0146
    loop
      v_ml := v_ml + v_item.ml * v_item.qty;
      if p_restock and v_item.product_id is not null then
        update inventory
           set on_hand_ml = on_hand_ml + v_item.ml * v_item.qty
         where product_id = v_item.product_id;
        update inventory
           set is_sold_out = (on_hand_ml - reserved_ml) <= 0
         where product_id = v_item.product_id;
        -- Өртөггүй: худалдан авалт биш, буцаж ирсэн бараа.
        insert into restock_log (product_id, delta_ml, reason, created_by, cost, order_id)
          values (v_item.product_id, v_item.ml * v_item.qty, 'refund_return', p_by, 0, p_order);
      end if;
    end loop;

    -- Шимтгэлгүй, хүргэлтгүй.
    v_fee := 0;
    v_amount := greatest(v_total - least(v_shipping, v_total), 0);

    v_note := v_note || case when p_restock
      then ' — декант нөөцөд буцсан (' || v_ml || 'ml)'
      else ' — декант зарах боломжгүй, ' || v_ml || 'ml нөөцөд буцаагүй' end;
    if v_shipping > 0 then
      v_note := v_note || ', хүргэлтийн ' || v_shipping || '₮ буцаагүй';
    end if;
  else
    v_fee := least(greatest(coalesce(p_fee, 0), 0), v_total);
    v_amount := v_total - v_fee;
  end if;

  update orders
     set payment_status = 'refunded',
         refunded_at = now(),
         refund_fee = v_fee,
         refund_amount = v_amount,
         refund_restocked = case when v_status = 'delivered' then p_restock end
   where id = p_order;
  insert into order_status_history (order_id, status, note, changed_by)
    values (p_order, v_status, v_note, p_by);

  return jsonb_build_object('ok', true, 'amount', v_amount);
end $$;

------------------------------------------------------------------------------
-- 4. Тайлан (§6.1): захиалга бүрт НЭГ event хэвээр + мөрийн төрлийн задаргаа
--
-- `perfume_goods + extras_goods = goods`. Купон, оноо, хүргэлт, QPay шимтгэл
-- захиалгын түвшинд үлдэнэ — мөрийн төрөлд хуваахгүй. `ml` = зөвхөн
-- үнэртний декант ml (нэмэлт бараа ml-гүй).
--
-- Буцах төрөл өөрчлөгдөж буй тул DROP → CREATE. `admin_report_finance`,
-- `admin_report_series` нь events-ийг нэрээр нь уншдаг (language sql,
-- хамаарал бүртгэгддэггүй) — finance-ийн буцах төрөл ч өөрчлөгдөнө.
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
  perfume_goods int,  -- 0146: goods-ийн үнэртний хэсэг
  extras_goods  int   -- 0146: goods-ийн нэмэлт барааны хэсэг
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
           li.ml_sold, li.extras
      from orders o
      cross join lateral (
        select coalesce(sum(i.ml * i.qty) filter (where i.line_kind = 'perfume'), 0) as ml_sold,
               coalesce(sum(i.line_total) filter (where i.line_kind = 'extra'), 0) as extras
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
         (o.subtotal - o.extras)::int, o.extras::int
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
         -(o.subtotal - o.extras)::int, -o.extras::int
    from o
   where o.payment_status = 'refunded' and o.refunded_at is not null
     and (p_from is null or o.refunded_at >= p_from)
     and (p_to   is null or o.refunded_at <  p_to)
  order by 4 desc, 3;
$$;

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
  extras_goods bigint  -- 0146: goods-ийн нэмэлт барааны хэсэг (sale)
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
         pend.n::bigint, pend.amt::bigint, agg.extras_goods::bigint
    from agg, buy, pend;
$$;

-- Топ бараа, брэнд — зөвхөн үнэртэн (§11). Нэмэлт барааны мөрийн `brand` нь
-- ангиллын нэр тул «брэнд»-ийн жагсаалтыг бохирдуулна.
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
    and i.line_kind = 'perfume'  -- 0146
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
    and i.line_kind = 'perfume'  -- 0146
    and (p_from is null or o.created_at >= p_from)
    and (p_to   is null or o.created_at <  p_to)
  group by i.brand
  order by 2 desc;
$$;

revoke all on function admin_report_events(timestamptz, timestamptz, numeric) from public;
revoke all on function admin_report_finance(timestamptz, timestamptz, numeric) from public;
grant execute on function admin_report_events(timestamptz, timestamptz, numeric) to authenticated;
grant execute on function admin_report_finance(timestamptz, timestamptz, numeric) to authenticated;

do $$
begin
  revoke all on function mark_order_refunded(uuid, uuid, int, boolean)
    from public, anon, authenticated;
  grant execute on function mark_order_refunded(uuid, uuid, int, boolean)
    to service_role;
end $$;
