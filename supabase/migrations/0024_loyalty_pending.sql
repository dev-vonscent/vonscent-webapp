-- V point earned on an order is locked before it can be spent (todo.md B4).
--
-- Points used to land on profiles.loyalty_points the moment payment cleared,
-- so a customer could pay, spend the reward on a second order, and then cancel
-- the first — 0019's clawback clamps at zero, which means the shop eats the
-- difference. Freshly earned points now sit in profiles.pending_points and
-- move across when the order is delivered, or after a lock window (24h by
-- default, settings.loyalty.lockHours) if it never reaches that status.
--
-- profiles.loyalty_points keeps its meaning — the spendable balance — so
-- place_order's redemption clamp needs no change.

alter table profiles
  add column if not exists pending_points int not null default 0;

-- The ledger stays the audit trail. `released` is false only for an earn row
-- whose points are still locked; everything else (redeem, reversals, manual
-- adjustments) is spendable the moment it is written.
alter table loyalty_ledger
  add column if not exists available_at timestamptz,
  add column if not exists released boolean not null default true;

create index if not exists loyalty_ledger_pending_idx
  on loyalty_ledger (released, available_at) where not released;

-- Lock window is store policy, alongside the earn/redeem rates.
update settings
  set value = value || jsonb_build_object('lockHours', 24)
  where key = 'loyalty' and not (value ? 'lockHours');

-- ── Release helpers ────────────────────────────────────────────────────

/**
 * Move every still-locked earn row of one order into the spendable balance.
 * Idempotent — a released row is never counted twice.
 */
create or replace function release_order_points(p_order uuid)
returns int language plpgsql as $$
declare
  v_row record;
  v_total int := 0;
begin
  for v_row in
    select id, user_id, delta from loyalty_ledger
    where order_id = p_order and reason = 'earn' and not released
    for update
  loop
    update profiles
      set pending_points = greatest(pending_points - v_row.delta, 0),
          loyalty_points = loyalty_points + v_row.delta
      where id = v_row.user_id;
    update loyalty_ledger set released = true where id = v_row.id;
    v_total := v_total + v_row.delta;
  end loop;
  return v_total;
end $$;

/** Cron entry point: unlock everything whose window has passed. */
create or replace function release_due_points()
returns int language plpgsql as $$
declare
  v_row record;
  n int := 0;
begin
  for v_row in
    select id, user_id, delta from loyalty_ledger
    where reason = 'earn' and not released
      and available_at is not null and available_at <= now()
    for update skip locked
  loop
    update profiles
      set pending_points = greatest(pending_points - v_row.delta, 0),
          loyalty_points = loyalty_points + v_row.delta
      where id = v_row.user_id;
    update loyalty_ledger set released = true where id = v_row.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ── mark_order_paid: earn into the locked bucket (replaces 0016) ───────
create or replace function mark_order_paid(p_order uuid)
returns void language plpgsql as $$
declare
  v_item record;
  v_user uuid;
  v_status payment_status_t;
  v_subtotal int;
  v_discount int;
  v_base int;
  v_earn_per int;
  v_earn_points int;
  v_lock_hours numeric;
  v_earned int;
begin
  select user_id, payment_status, subtotal, discount
    into v_user, v_status, v_subtotal, v_discount
    from orders where id = p_order;
  if v_status = 'paid' then
    return;  -- idempotent
  end if;

  update orders set payment_status = 'paid', status = 'confirmed',
    reserve_expires_at = null where id = p_order;

  for v_item in select product_id, ml, qty from order_items where order_id = p_order loop
    if v_item.product_id is not null then
      perform commit_inventory(v_item.product_id, v_item.ml * v_item.qty);
    end if;
  end loop;

  insert into order_status_history (order_id, status, note)
    values (p_order, 'confirmed', 'Төлбөр төлөгдсөн');

  if v_user is not null then
    select coalesce((value->>'earnPer')::int, 100),
           coalesce((value->>'earnPoints')::int, 1),
           coalesce((value->>'lockHours')::numeric, 24)
      into v_earn_per, v_earn_points, v_lock_hours
      from settings where key = 'loyalty';
    v_earn_per := coalesce(v_earn_per, 100);
    v_earn_points := coalesce(v_earn_points, 1);
    v_lock_hours := greatest(coalesce(v_lock_hours, 24), 0);
    -- Points are earned on the post-coupon product subtotal, never shipping.
    v_base := greatest(coalesce(v_subtotal,0) - coalesce(v_discount,0), 0);
    if v_earn_per > 0 then
      v_earned := floor(v_base / v_earn_per) * v_earn_points;
      if v_earned > 0 then
        update profiles set pending_points = pending_points + v_earned
          where id = v_user;
        insert into loyalty_ledger
          (user_id, order_id, delta, reason, available_at, released)
          values (v_user, p_order, v_earned, 'earn',
                  now() + (v_lock_hours || ' hours')::interval, false);
        -- A zero lock window means "spendable immediately"; honour it here
        -- rather than making the customer wait for the next cron tick.
        if v_lock_hours = 0 then
          perform release_order_points(p_order);
        end if;
      end if;
    end if;
  end if;
end $$;

-- ── update_order_status: release on delivery, reverse on cancel ────────
-- Replaces 0019. The reversal now distinguishes locked from spendable points:
-- locked ones are simply taken back out of pending_points (and marked
-- released so the cron can't hand them over afterwards), while spendable ones
-- are clawed back from the balance, still clamped at zero.
create or replace function update_order_status(
  p_order uuid, p_status order_status_t, p_note text, p_by uuid
) returns void language plpgsql as $$
declare
  v_item record;
  v_row record;
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

  -- Delivered means the order can no longer be cancelled, so its points are
  -- safe to hand over even if the lock window hasn't elapsed.
  if p_status = 'delivered' and v_prev is distinct from 'delivered' then
    perform release_order_points(p_order);
  end if;

  -- Only the first transition into cancelled reverses anything.
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
      -- Net of what actually moved the spendable balance: negative when
      -- points were redeemed, positive when released earnings were granted.
      -- Read before the loop below, which closes the locked rows — counting
      -- them here as well would claw the same points back twice.
      select coalesce(sum(delta), 0) into v_net
        from loyalty_ledger
        where order_id = p_order
          and (reason = 'redeem' or (reason = 'earn' and released));

      -- Still-locked earnings never reached the balance: drop them from
      -- pending and close the row so release_due_points() skips it.
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
      -- Clawing back earned points can't push a balance below zero (the
      -- customer may already have spent them), so log what was applied.
      v_applied := greatest(coalesce(v_before, 0) - v_net, 0) - coalesce(v_before, 0);
      if v_applied <> 0 then
        update profiles set loyalty_points = coalesce(v_before, 0) + v_applied
          where id = v_user;
      end if;
      -- Written unconditionally: this row is what makes a second cancel a
      -- no-op, even when the order moved no points at all.
      insert into loyalty_ledger (user_id, order_id, delta, reason)
        values (v_user, p_order, v_applied, 'cancel_reverse');
    end if;
  end if;

  update orders set status = p_status,
    reserve_expires_at = case when p_status in ('cancelled') then null else reserve_expires_at end
    where id = p_order;

  insert into order_status_history (order_id, status, note, changed_by)
    values (p_order, p_status, coalesce(p_note,''), p_by);
end $$;

-- Unlock matured points every 15 minutes.
do $$
begin
  perform cron.unschedule('release-due-points');
exception when others then null; end $$;

select cron.schedule('release-due-points', '*/15 * * * *', $$select release_due_points();$$);
