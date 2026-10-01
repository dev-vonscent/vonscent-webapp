-- Буцаалт ба нөөцийн бүрэн бүтэн байдал (docs/planning/report-audit.md F8, F11, F12).
--
-- F8  Хүргэгдсэний дараах буцаалт (0094) нь оноо, урамшууллын купонд огт
--     хүрдэггүй байв — хэрэглэгч мөнгөө бүтнээр аваад 1%-ийн оноо, 300k+
--     захиалгын 10%-ийн купоноо хадгалдаг. Шаардлага: «Ямар нэг байдлаар
--     захиалга цуцлагдвал ашигласан оноо буцаж ороод нэмэгдсэн оноо хасагдах»,
--     купон «захиалгатайгаа хамт хүчингүй» (0032 №13). Одоо цуцлалттай ижил
--     оноо урвуулна, урамшууллын купоныг хүчингүй болгоно.
--
--     Декант: админ буцаалт хийхдээ «нөөцөд буцсан» эсвэл «зарах боломжгүй»
--     гэж заавал сонгоно (`p_restock`). Буцсан бол ml нөөцөд нэмэгдэж
--     `restock_log`-т өртөггүй 'refund_return' мөр үлдэнэ; зарах боломжгүй
--     бол ml нэмэгдэхгүй, захиалгын түүхэнд хэдэн ml хасагдсан нь бичигдэнэ.
--     Аль ч тохиолдолд тайлангийн «Зарсан мл»-ээс буцаасан сард хасагдана.
--
-- F11 super_admin цуцлагдсан захиалгыг сэргээхэд (cancelled → pending) ml
--     дахин барьдаггүй байв; дараа нь `mark_order_paid` → `commit_inventory`
--     нь БУСАД захиалгын `reserved_ml`-ийг иднэ → oversell. Одоо сэргээлт ml-ийг
--     дахин барина (төлсөн бол шууд хасна), хүрэхгүй бол татгалзана.
--
-- F12 `restock_inventory` нь хасалтад (delta < 0) өртөг бүртгэхийг өөрөө
--     хориглодоггүй байв (зөвхөн route). Одоо RPC ч хориглоно.

------------------------------------------------------------------------------
-- 0. Багана
------------------------------------------------------------------------------

alter table orders add column if not exists refund_restocked boolean;
comment on column orders.refund_restocked is
  'Хүргэгдсэний дараах буцаалтад декант нөөцөд буцсан эсэх. Цуцлагдсан '
  'захиалгын буцаалтад null (цуцлалт ml-ийг аль хэдийн буцаасан).';

alter table restock_log add column if not exists order_id uuid
  references orders(id) on delete set null;

------------------------------------------------------------------------------
-- 1. Оноо урвуулах — цуцлалт ба хүргэгдсэний дараах буцаалт хоёулаа
------------------------------------------------------------------------------

-- 0024 update_order_status-аас салгасан бие, өөрчлөлтгүй. Idempotent:
-- 'cancel_reverse' мөр байвал юу ч хийхгүй.
create or replace function reverse_order_loyalty(p_order uuid)
returns void language plpgsql as $$
declare
  v_user uuid;
  v_row record;
  v_net int;
  v_applied int;
  v_before int;
begin
  select user_id into v_user from orders where id = p_order;
  if v_user is null
     or exists (select 1 from loyalty_ledger
                 where order_id = p_order and reason = 'cancel_reverse') then
    return;
  end if;

  -- Зарцуулах үлдэгдлийг бодитоор хөдөлгөсөн net: оноогоор төлсөн бол сөрөг,
  -- нээгдсэн олз бол эерэг. Доорх давталт түгжээтэй мөрүүдийг хаадаг тул
  -- түүнээс ӨМНӨ уншина — эс бөгөөс нэг оноог хоёр удаа хураана.
  select coalesce(sum(delta), 0) into v_net
    from loyalty_ledger
   where order_id = p_order
     and (reason = 'redeem' or (reason = 'earn' and released));

  -- Нээгдээгүй олз үлдэгдэлд хүрээгүй: pending-ээс хасаж, мөрийг хаана.
  for v_row in
    select id, delta from loyalty_ledger
     where order_id = p_order and reason = 'earn' and not released
     for update
  loop
    update profiles
       set pending_points = greatest(pending_points - v_row.delta, 0)
     where id = v_user;
    update loyalty_ledger set released = true where id = v_row.id;
    insert into loyalty_ledger (user_id, order_id, delta, reason)
      values (v_user, p_order, -v_row.delta, 'cancel_pending');
  end loop;

  select loyalty_points into v_before from profiles where id = v_user for update;
  -- Хэрэглэгч аль хэдийн зарцуулсан байж болох тул 0-ээс доош хураахгүй.
  v_applied := greatest(coalesce(v_before, 0) - v_net, 0) - coalesce(v_before, 0);
  if v_applied <> 0 then
    update profiles set loyalty_points = coalesce(v_before, 0) + v_applied
     where id = v_user;
  end if;
  insert into loyalty_ledger (user_id, order_id, delta, reason)
    values (v_user, p_order, v_applied, 'cancel_reverse');
end $$;

------------------------------------------------------------------------------
-- 2. update_order_status: 0024 + сэргээлтийн reserve (F11)
------------------------------------------------------------------------------

create or replace function update_order_status(
  p_order uuid, p_status order_status_t, p_note text, p_by uuid
) returns void language plpgsql as $$
declare
  v_item record;
  v_prev order_status_t;
  v_paid boolean;
  v_need int;
begin
  select status, payment_status = 'paid'
    into v_prev, v_paid
    from orders where id = p_order for update;
  if not found then return; end if;

  -- Хүргэгдсэн бол цуцлагдахгүй тул оноог нь түгжээ дуусаагүй ч нээнэ.
  if p_status = 'delivered' and v_prev is distinct from 'delivered' then
    perform release_order_points(p_order);
  end if;

  -- Зөвхөн анх цуцлагдахад л урвуулна.
  if p_status = 'cancelled' and v_prev is distinct from 'cancelled' then
    for v_item in select product_id, ml, qty from order_items where order_id = p_order loop
      if v_item.product_id is not null then
        if v_paid then
          -- Төлсөн захиалга on_hand-аас commit хийгдсэн — ml-ийг буцаана.
          update inventory
            set on_hand_ml = on_hand_ml + v_item.ml * v_item.qty
            where product_id = v_item.product_id;
          update inventory
            set is_sold_out = false
            where product_id = v_item.product_id and (on_hand_ml - reserved_ml) > 0;
        else
          perform release_inventory(v_item.product_id, v_item.ml * v_item.qty);
        end if;
      end if;
    end loop;

    perform reverse_order_loyalty(p_order);
  end if;

  -- Сэргээлт (super_admin, cancelled → идэвхтэй төлөв): цуцлалт ml-ийг
  -- буцаасан тул энэ захиалгад дахин барина. Төлсөн бол шууд хасна
  -- (reserve → commit), төлөөгүй бол reserve. Хүрэхгүй бол бүхэлд нь
  -- татгалзана — эс бөгөөс дараагийн commit бусдын reserve-ийг иднэ.
  --
  -- Анхаар: цуцлалтаар урвуулсан оноо, купон сэргэхгүй.
  if v_prev = 'cancelled' and p_status <> 'cancelled' then
    for v_item in select product_id, ml, qty from order_items where order_id = p_order loop
      if v_item.product_id is not null then
        v_need := v_item.ml * v_item.qty;
        if not reserve_inventory(v_item.product_id, v_need) then
          raise exception 'INSUFFICIENT_STOCK:%', v_item.product_id
            using errcode = 'check_violation';
        end if;
        if v_paid then
          perform commit_inventory(v_item.product_id, v_need);
        end if;
      end if;
    end loop;
  end if;

  update orders set status = p_status,
    reserve_expires_at = case when p_status in ('cancelled') then null else reserve_expires_at end
    where id = p_order;

  insert into order_status_history (order_id, status, note, changed_by)
    values (p_order, p_status, coalesce(p_note,''), p_by);
end $$;

------------------------------------------------------------------------------
-- 3. mark_order_refunded: хүргэгдсэний дараах буцаалтын урвуулалт (F8)
------------------------------------------------------------------------------

drop function if exists mark_order_refunded(uuid, uuid, int);

create or replace function mark_order_refunded(
  p_order uuid, p_by uuid, p_fee int default 0, p_restock boolean default null
) returns jsonb language plpgsql as $$
declare
  v_status order_status_t;
  v_pay payment_status_t;
  v_total int;
  v_item record;
  v_ml int := 0;
  v_note text := 'Төлбөр буцаагдсан';
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

  if v_status = 'delivered' then
    -- Декантын хувь заяаг админ заавал шийднэ — эс бөгөөс ml-ийн хасалт
    -- тайлбаргүй үлдэнэ.
    if p_restock is null then
      return jsonb_build_object('ok', false, 'reason', 'RESTOCK_REQUIRED');
    end if;

    perform reverse_order_loyalty(p_order);

    -- Энэ захиалгын төлөө олгосон урамшууллын купон: хэн ч ашиглаагүй бол
    -- устгана, идэвхтэй ашиглалтгүй бол хүчингүй (orders_on_cancelled-тэй ижил).
    delete from coupons c
     where c.source_order_id = p_order
       and not exists (select 1 from coupon_redemptions r where r.coupon_id = c.id);
    update coupons c set is_active = false
     where c.source_order_id = p_order
       and not exists (
         select 1 from coupon_redemptions r
          where r.coupon_id = c.id and r.cancelled_at is null
       );

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

    v_note := v_note || case when p_restock
      then ' — декант нөөцөд буцсан (' || v_ml || 'ml)'
      else ' — декант зарах боломжгүй, ' || v_ml || 'ml нөөцөд буцаагүй' end;
  end if;

  update orders
     set payment_status = 'refunded',
         refunded_at = now(),
         refund_fee = least(greatest(coalesce(p_fee, 0), 0), v_total),
         refund_restocked = case when v_status = 'delivered' then p_restock end
   where id = p_order;
  insert into order_status_history (order_id, status, note, changed_by)
    values (p_order, v_status, v_note, p_by);

  return jsonb_build_object('ok', true);
end $$;

------------------------------------------------------------------------------
-- 4. restock_inventory: хасалтад өртөг бүртгэхгүй (F12). Бие нь 0047-ынх.
------------------------------------------------------------------------------

create or replace function restock_inventory(
  p_product uuid, p_delta int, p_reason text, p_by uuid, p_cost int default 0
) returns void language plpgsql as $$
declare
  v_on_hand int;
  v_reserved int;
begin
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
  insert into restock_log (product_id, delta_ml, reason, created_by, cost)
    values (p_product, p_delta, coalesce(p_reason, ''), p_by,
            case when p_delta > 0 then greatest(coalesce(p_cost, 0), 0) else 0 end);

  update inventory
     set is_sold_out = (on_hand_ml - reserved_ml) <= 0
   where product_id = p_product;
end $$;

------------------------------------------------------------------------------
-- 5. Тайлан: буцаасан захиалгын ml «Зарсан мл»-ээс хасагдана
------------------------------------------------------------------------------

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
         0, coalesce(o.refund_fee, 0), -o.ml_sold::int
    from o
   where o.payment_status = 'refunded' and o.refunded_at is not null
     and (p_from is null or o.refunded_at >= p_from)
     and (p_to   is null or o.refunded_at <  p_to)
  order by 4 desc, 3;
$$;

------------------------------------------------------------------------------
-- 6. Эрх (0088): мөнгө, нөөцийн RPC зөвхөн service_role
------------------------------------------------------------------------------

do $$
declare v_sig text;
begin
  foreach v_sig in array array[
    'reverse_order_loyalty(uuid)',
    'update_order_status(uuid, order_status_t, text, uuid)',
    'mark_order_refunded(uuid, uuid, int, boolean)',
    'restock_inventory(uuid, int, text, uuid, int)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_sig);
    begin
      execute format('grant execute on function %s to service_role', v_sig);
    exception when undefined_object then null;
    end;
  end loop;
end $$;
