-- Хүргэгдсэний дараах буцаалтад хүргэлтийн төлбөр буцаагдахгүй (клиент, 2026-10-01).
--
-- Курьер аль хэдийн хүргэсэн, клиент түүнд төлсөн — тэр мөнгийг хэрэглэгчид
-- буцаавал клиентийн бодит алдагдал болох ба тайлангийн «Ашиг» (хүргэлтийг
-- дамжин өнгөрөх мөнгө гэж тоолдоггүй) түүнийг харуулахгүй байв. Одоо:
--
--   * Цуцлагдсан захиалгын буцаалт: total − refund_fee (1%), өөрчлөлтгүй.
--     Хүргэлт хийгдээгүй тул хүргэлтийн мөнгө буцна.
--   * Хүргэгдсэний дараах буцаалт: total − shipping_fee, шимтгэлгүй.
--
-- Буцаасан дүнг `refund_amount`-д бичнэ — тайлан түүнийг уншина, дүрмийг
-- дахин таамаглахгүй. App-ын `deliveredRefund()` (src/lib/refund.ts) ижил дүн.

------------------------------------------------------------------------------
-- 0. Багана + хуучин буцаалтууд
------------------------------------------------------------------------------

alter table orders add column if not exists refund_amount int
  check (refund_amount is null or refund_amount >= 0);
comment on column orders.refund_amount is
  'Хэрэглэгчид бодитоор буцаасан мөнгө (₮). Цуцлалт: total − refund_fee; '
  'хүргэгдсэний дараах: total − shipping_fee.';

-- Өмнөх буцаалтууд хуучин дүрмээр (бүтэн total − суутгал) шилжсэн — түүхийг
-- тэр чигээр нь үлдээнэ.
update orders
   set refund_amount = greatest(total - coalesce(refund_fee, 0), 0)
 where payment_status = 'refunded' and refund_amount is null;

------------------------------------------------------------------------------
-- 1. mark_order_refunded: 0113-ын бие + refund_amount
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

    for v_item in select product_id, ml, qty from order_items where order_id = p_order loop
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
-- 2. Тайлан: буцаалтын мөрийн мөнгө ба хүргэлт бодит буцаасан дүнгээр
------------------------------------------------------------------------------

-- 0112-ын бие. Өөрчлөлт нь зөвхөн 'refund' мөрийн `shipping` ба `cash`:
-- хүргэгдсэний дараах буцаалтад хүргэлт буцаагдаагүй тул −shipping биш 0,
-- мөнгө нь −refund_amount. Буцаасан хүргэлт = буцаасан мөнгө + суутгал −
-- барааны цэвэр дүн. Цэвэр борлуулалт, ашиг (net_goods дээр бодогддог)
-- өөрчлөгдөхгүй.
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
  goods        int,
  coupon       int,
  points       int,
  net_goods    int,
  shipping     int,
  cash         int,
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
           coalesce(o.refund_amount, o.total - coalesce(o.refund_fee, 0)) as refunded_cash,
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
         -least(greatest(o.refunded_cash + coalesce(o.refund_fee, 0) - o.net, 0),
                o.shipping_fee),
         -o.refunded_cash,
         0, coalesce(o.refund_fee, 0), -o.ml_sold::int
    from o
   where o.payment_status = 'refunded' and o.refunded_at is not null
     and (p_from is null or o.refunded_at >= p_from)
     and (p_to   is null or o.refunded_at <  p_to)
  order by 4 desc, 3;
$$;

------------------------------------------------------------------------------
-- 3. Эрх (0088)
------------------------------------------------------------------------------

do $$
begin
  revoke all on function mark_order_refunded(uuid, uuid, int, boolean)
    from public, anon, authenticated;
  begin
    grant execute on function mark_order_refunded(uuid, uuid, int, boolean)
      to service_role;
  exception when undefined_object then null;
  end;
end $$;

revoke all on function admin_report_events(timestamptz, timestamptz, numeric) from public;
grant execute on function admin_report_events(timestamptz, timestamptz, numeric) to authenticated;
