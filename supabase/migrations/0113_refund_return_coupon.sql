-- Хүргэгдсэний дараах буцаалт: ашигласан купоныг буцаана (клиент, 2026-10-01).
--
-- Буцаалтыг админ захиалгын хуудаснаас хийдэг бөгөөд тэр үед хэрэглэгчийн
-- энэ захиалгад АШИГЛАСАН купон ба V point хоёулаа хэрэглэгчид буцна. Мөнгөөр
-- зөвхөн клиентийн дансанд бодитоор орж ирсэн дүнг (`orders.total`) буцаана.
-- V point-ийг 0112 аль хэдийн буцаадаг (`reverse_order_loyalty`); энд купон
-- нэмэгдэв — цуцлалттай (0104 `orders_on_cancelled`) яг ижил дүрэм.
--
-- Купоны хоёр үйлдлийг функц болгон салгаж, цуцлалтын trigger ба буцаалт
-- хоёр нэг кодыг ашиглана.

-- Энэ захиалгад ашигласан купоныг буцаана. Ашиглалтын мөр устахгүй,
-- `cancelled_at` авна — админы log үлдэж, validate_coupon зөвхөн идэвхтэй
-- мөрийг тоолно. Хуваалцсан купон эзэмшигчдээ буцна. Idempotent.
create or replace function release_order_coupons(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_coupon uuid;
begin
  for v_coupon in
    update coupon_redemptions set cancelled_at = now()
     where order_id = p_order and cancelled_at is null
     returning coupon_id
  loop
    update coupons set used_count = greatest(used_count - 1, 0)
     where id = v_coupon;
  end loop;
end $$;

-- Энэ захиалгын ТӨЛӨӨ олгосон 300k+ урамшууллын купон: хэн ч ашиглаагүй бол
-- устгана, идэвхтэй ашиглалтгүй бол хүчингүй болгоно (log-ийг cascade-аар
-- алдахгүйн тулд).
create or replace function revoke_order_reward_coupon(p_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from coupons c
   where c.source_order_id = p_order
     and not exists (select 1 from coupon_redemptions r where r.coupon_id = c.id);
  update coupons c set is_active = false
   where c.source_order_id = p_order
     and not exists (
       select 1 from coupon_redemptions r
        where r.coupon_id = c.id and r.cancelled_at is null
     );
end $$;

-- Цуцлалтын trigger: 0104-ийн бие, купоны хэсэг нь функцээр.
create or replace function orders_on_cancelled()
returns trigger language plpgsql security definer as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    insert into admin_notifications (kind, order_id, message)
    values (
      'order_cancelled',
      new.id,
      'Захиалга ' || new.order_no || ' цуцлагдлаа — ' ||
      coalesce(new.contact_name, '') || ' (' || coalesce(new.contact_phone, '') || '). ' ||
      case when new.payment_status = 'paid'
        then 'Төлбөр төлөгдсөн тул хэрэглэгчтэй холбогдож мөнгийг нь буцаана уу.'
        else 'Төлбөр төлөгдөөгүй байсан.' end
    );

    perform release_order_coupons(new.id);
    perform revoke_order_reward_coupon(new.id);
  end if;
  return new;
end $$;

-- mark_order_refunded: 0112-ийн бие + ашигласан купон буцаах.
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

    -- Цуцлалттай ижил: ашигласан V point ба купон буцна, олсон V point ба
    -- урамшууллын купон хүчингүй. Мөнгөөр зөвхөн `total` буцна.
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

-- Эрх (0088): мөнгөний RPC зөвхөн service_role.
do $$
declare v_sig text;
begin
  foreach v_sig in array array[
    'release_order_coupons(uuid)',
    'revoke_order_reward_coupon(uuid)',
    'mark_order_refunded(uuid, uuid, int, boolean)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_sig);
    begin
      execute format('grant execute on function %s to service_role', v_sig);
    exception when undefined_object then null;
    end;
  end loop;
end $$;
