-- Нэмэлт барааны тайлан, нөөцийн гурван засвар (extras-shop-plan §18.6,
-- клиент 2026-11-10). Feature flag: `extras_shop` — хаалттай үед нэмэлт
-- барааны мөр, хөдөлгөөн байхгүй тул prod-ийн тоо өөрчлөгдөхгүй.
-- Expand-only: шинэ trigger, функцийн бие солих.
--
--   A. Хоосон шил өртөггүй — зөвхөн UI хамгаалдаг байсан тул шууд RPC
--      (`extras_purchase`, `extras_save`-ийн `initial_purchase`) 5,000₮ г.м.
--      өртөг бичиж ашгийг бууруулж чадаж байв. Одоо `extra_movements`-ийн
--      trigger `empty-bottle` ангиллын худалдан авалтын өртгийг 0 болгоно
--      (бүх замд). Өмнө бичигдсэнийг ч 0 болгоно.
--   B. `admin_report_extras` (ангиллын хүснэгт) буцаалтыг хасдаггүй байв —
--      буцаасан захиалгын нэмэлт бараа борлуулалтад тоологдсоор. Одоо
--      `admin_report_events`-ийн `refund` мөрөөр (буцаасан өдрөөр) хасна —
--      нийт «Цэвэр борлуулалт»-тай ижил дүрэм.
--   D. «Хүргэсэн → Хүргэлтэд → Цуцалсан» нь хүргэгдсэн (committed) нэмэлт
--      бараа, савыг нөөцөд буцаадаггүй байв (декантын ml буцдаг). Ийм
--      захиалгыг цуцлахыг хориглоно — «Хүргэсэн» болгоод буцаалт хийнэ:
--      `mark_order_refunded` нь хүргэгдсэн барааг нөөцөд буцаах сонголттой.

------------------------------------------------------------------------------
-- A. Хоосон шилний худалдан авалт өртөггүй
------------------------------------------------------------------------------

create or replace function extra_movements_costless()
returns trigger language plpgsql as $$
begin
  if new.kind = 'purchase' and exists (
       select 1 from extra_variants v
         join extra_products p on p.id = v.extra_id
         join extra_categories c on c.id = p.category_id
        where v.id = new.extra_variant_id and c.slug = 'empty-bottle') then
    new.unit_cost := 0;
    new.cost := 0;
  end if;
  return new;
end $$;

drop trigger if exists extra_movements_costless on extra_movements;
create trigger extra_movements_costless
  before insert or update on extra_movements
  for each row execute function extra_movements_costless();

-- Өмнө бичигдсэн өртөгтэй хоосон шил (dev: 3 × 5,000). Prod-д туг хаалттай
-- тул ийм мөр байхгүй — байвал засна.
update extra_movements m
   set unit_cost = 0, cost = 0
  from extra_variants v
  join extra_products p on p.id = v.extra_id
  join extra_categories c on c.id = p.category_id
 where v.id = m.extra_variant_id
   and c.slug = 'empty-bottle'
   and m.kind = 'purchase'
   and m.cost <> 0;

------------------------------------------------------------------------------
-- B. Ангиллын тайлан буцаалтыг хасна
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
    -- `sale` нь захиалгын өдрөөр +, `refund` нь буцаасан өдрөөр − (бүтэн
    -- захиалгын буцаалт) — admin_report_finance-ийн net_sales-тэй ижил.
    select p.category_id,
           sum(case when e.kind = 'refund' then -oi.line_total else oi.line_total end) as amt,
           sum(case when e.kind = 'refund' then -oi.qty else oi.qty end) as qty
      from admin_report_events(p_from, p_to, 0) e
      join order_items oi on oi.order_id = e.order_id and oi.line_kind = 'extra'
      join extra_products p on p.id = oi.extra_product_id
     where e.kind in ('sale', 'refund')
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
-- D. Хүргэгдсэн нэмэлт бараа / савтай захиалгыг цуцлахгүй
--
-- `update_order_status` цуцлалтын бүх ажлаа хийсний дараа `orders.status`-ийг
-- солино — энэ trigger тэр мөчид шидэж бүхнийг rollback хийнэ. Бүх замыг
-- (route, cron, ирээдүйн RPC) хамгаална. Төлбөргүй захиалга хэзээ ч
-- committed болдоггүй тул `abandon_unpaid_order`-т нөлөөгүй.
------------------------------------------------------------------------------

create or replace function orders_cancel_delivered_guard()
returns trigger language plpgsql as $$
begin
  if exists (
       select 1 from order_items
        where order_id = new.id
          and (extra_state = 'committed' or vial_state = 'committed')) then
    raise exception 'ORDER_HAS_DELIVERED_ITEMS' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists orders_cancel_delivered_guard on orders;
create trigger orders_cancel_delivered_guard
  before update of status on orders
  for each row
  when (new.status = 'cancelled' and old.status is distinct from 'cancelled')
  execute function orders_cancel_delivered_guard();

revoke all on function extra_movements_costless() from public, anon, authenticated;
revoke all on function orders_cancel_delivered_guard() from public, anon, authenticated;
