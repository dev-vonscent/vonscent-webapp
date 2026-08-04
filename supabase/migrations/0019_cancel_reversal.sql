-- Cancelling an order must undo what placing/paying it did (todo.md B1).
--
-- Before this, update_order_status() only released the inventory reserve:
--   * V points redeemed at checkout were lost — the customer paid with points
--     for an order that never shipped;
--   * points earned on a paid order stayed on the profile after the refund;
--   * a *paid* order's ml had already been committed (reserved AND on_hand
--     decremented), so releasing a reserve that no longer exists silently lost
--     the stock instead of putting it back.
--
-- The reversal is driven by loyalty_ledger rather than recomputed from
-- settings, so a rate change between checkout and cancellation can't hand out
-- more (or fewer) points than the order actually moved. It is idempotent: a
-- second cancel finds the 'cancel_reverse' row and does nothing.

create or replace function update_order_status(
  p_order uuid, p_status order_status_t, p_note text, p_by uuid
) returns void language plpgsql as $$
declare
  v_item record;
  v_user uuid;
  v_prev order_status_t;
  v_paid boolean;
  v_net int;
  v_applied int;
  v_before int;
begin
  select user_id, status, payment_status = 'paid'
    into v_user, v_prev, v_paid
    from orders where id = p_order for update;
  if not found then return; end if;

  -- Only the pending -> cancelled transition reverses anything; re-cancelling
  -- an already-cancelled order is a no-op.
  if p_status = 'cancelled' and v_prev is distinct from 'cancelled' then
    for v_item in select product_id, ml, qty from order_items where order_id = p_order loop
      if v_item.product_id is not null then
        if v_paid then
          -- Paid orders were committed out of on_hand; put the ml back.
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

    if v_user is not null
       and not exists (
         select 1 from loyalty_ledger
         where order_id = p_order and reason = 'cancel_reverse'
       )
    then
      -- Net of everything this order moved: negative when points were
      -- redeemed, positive when they were earned. Reverse exactly that.
      select coalesce(sum(delta), 0) into v_net
        from loyalty_ledger
        where order_id = p_order and reason in ('earn', 'redeem');

      if v_net <> 0 then
        select loyalty_points into v_before from profiles where id = v_user for update;
        -- Clawing back earned points can't push a balance below zero (the
        -- customer may already have spent them), so log what was applied.
        v_applied := greatest(coalesce(v_before, 0) - v_net, 0) - coalesce(v_before, 0);
        update profiles set loyalty_points = coalesce(v_before, 0) + v_applied
          where id = v_user;
        insert into loyalty_ledger (user_id, order_id, delta, reason)
          values (v_user, p_order, v_applied, 'cancel_reverse');
      end if;
    end if;
  end if;

  update orders set status = p_status,
    reserve_expires_at = case when p_status in ('cancelled') then null else reserve_expires_at end
    where id = p_order;

  insert into order_status_history (order_id, status, note, changed_by)
    values (p_order, p_status, coalesce(p_note,''), p_by);
end $$;

-- release_expired_reserves() cancels straight through an UPDATE, which skips
-- the reversal above. Route it through update_order_status so an abandoned
-- checkout returns its redeemed points too.
create or replace function release_expired_reserves()
returns int language plpgsql as $$
declare
  v_order record;
  n int := 0;
begin
  for v_order in
    select id from orders
    where status = 'pending'
      and payment_status = 'unpaid'
      and reserve_expires_at is not null
      and reserve_expires_at < now()
    for update skip locked
  loop
    perform update_order_status(
      v_order.id, 'cancelled', 'Захиалгын хугацаа дууссан', null
    );
    n := n + 1;
  end loop;
  return n;
end $$;
