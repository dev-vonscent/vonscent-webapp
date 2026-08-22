-- Client-confirmed order rules (docs/analysis/questions.md, 2026-08-21):
--   1. Loyalty points never pay the delivery fee (№9) — place_order's clamp
--      drops v_shipping.
--   2. Status runs on a fixed daily schedule (№14): 11:00 UB every order from
--      previous days goes out (→ shipping), 23:00 UB the day's deliveries are
--      done (→ delivered). Admin can still set any status by hand; these
--      crons are the default motion.
--   3. Cancelling an order notifies the admin (№14) — admin_notifications.
--   4. A reward coupon granted for an order dies with the order (№13).

------------------------------------------------------------------------------
-- 1. place_order: same function as 0029, one line changed — the redemption
--    clamp is now `v_subtotal - v_discount` (shipping excluded).
------------------------------------------------------------------------------

create or replace function place_order(p_order jsonb, p_items jsonb)
returns jsonb language plpgsql as $$
declare
  v_order_id uuid;
  v_order_no text;
  v_item jsonb;
  v_product uuid;
  v_variant uuid;
  v_ml int;
  v_qty int;
  v_sample boolean;
  v_gift boolean;
  v_coll uuid;
  v_coll_name text;
  v_unit int;
  v_need int;
  v_subtotal int := 0;
  v_shipping int := coalesce((p_order->>'shipping_fee')::int, 0);
  v_discount int := 0;
  v_loyalty int := greatest(coalesce((p_order->>'loyalty_used')::int, 0), 0);
  v_total int;
  v_pname text;
  v_brand text;
  v_reserve_min int := coalesce((p_order->>'reserve_minutes')::int, 30);
  v_user uuid := nullif(p_order->>'user_id','')::uuid;
  v_code text := nullif(btrim(coalesce(p_order->>'coupon_code','')), '');
  v_coupon jsonb;
  v_coupon_id uuid;
  v_redeem_rate numeric;
  v_avail_points int;
  v_points_used int;
begin
  -- First pass: reserve every line (fails fast on shortage). A gift reserves
  -- its own ml against the chosen product, same as any other line.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product := (v_item->>'product_id')::uuid;
    v_ml := (v_item->>'ml')::int;
    v_qty := (v_item->>'qty')::int;
    v_need := v_ml * v_qty;
    if not reserve_inventory(v_product, v_need) then
      raise exception 'INSUFFICIENT_STOCK:%', v_product
        using errcode = 'check_violation';
    end if;
  end loop;

  insert into orders (
    user_id, payment_method, contact_name, contact_phone, contact_email,
    ship_city, ship_district, ship_detail, ship_zone, note,
    shipping_fee, coupon_code, reserve_expires_at, subtotal, total
  ) values (
    v_user,
    coalesce((p_order->>'payment_method')::payment_method_t,'qpay'),
    p_order->>'contact_name', p_order->>'contact_phone', p_order->>'contact_email',
    coalesce(p_order->>'ship_city','Улаанбаатар'), p_order->>'ship_district',
    p_order->>'ship_detail', p_order->>'ship_zone', p_order->>'note',
    v_shipping, v_code,
    now() + (v_reserve_min || ' minutes')::interval, 0, 0
  ) returning id, order_no into v_order_id, v_order_no;

  -- Second pass: insert items with price snapshots.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product := (v_item->>'product_id')::uuid;
    v_variant := nullif(v_item->>'variant_id','')::uuid;
    v_ml := (v_item->>'ml')::int;
    v_qty := (v_item->>'qty')::int;
    v_sample := coalesce((v_item->>'is_sample')::boolean, false);
    v_gift := coalesce((v_item->>'is_gift')::boolean, false);
    v_coll := nullif(v_item->>'collection_id','')::uuid;
    v_coll_name := nullif(v_item->>'collection_name','');

    -- Bundle lines carry their own (discounted / zero) unit; fall back to the
    -- variant's list price for ordinary items.
    select variant_price(pv.*) into v_unit
      from product_variants pv where pv.id = v_variant;
    v_unit := coalesce((v_item->>'unit_price')::int, v_unit, 0);
    select name, brand into v_pname, v_brand from products where id = v_product;

    insert into order_items (
      order_id, product_id, variant_id, product_name, brand,
      ml, unit_price, qty, is_sample, line_total,
      collection_id, collection_name, is_gift
    ) values (
      v_order_id, v_product, v_variant, coalesce(v_pname,''), coalesce(v_brand,''),
      v_ml, v_unit, v_qty, v_sample, v_unit * v_qty,
      v_coll, v_coll_name, v_gift
    );
    v_subtotal := v_subtotal + v_unit * v_qty;
  end loop;

  -- Coupon: recompute discount on the server, for this buyer.
  if v_code is not null then
    v_coupon := validate_coupon(v_code, v_subtotal, v_user);
    if (v_coupon->>'valid')::boolean then
      v_discount := (v_coupon->>'discount')::int;
      update coupons set used_count = used_count + 1
        where upper(code) = upper(v_code)
        returning id into v_coupon_id;
      insert into coupon_redemptions (coupon_id, user_id, order_id)
        values (v_coupon_id, v_user, v_order_id)
        on conflict do nothing;
    else
      v_discount := 0;
    end if;
  end if;

  -- Loyalty redemption: clamp to available points and the GOODS value only —
  -- points are neither earned on nor spendable against the delivery fee.
  if v_user is not null and v_loyalty > 0 then
    select coalesce((value->>'redeemRate')::numeric, 1) into v_redeem_rate
      from settings where key = 'loyalty';
    v_redeem_rate := coalesce(v_redeem_rate, 1);
    select loyalty_points into v_avail_points from profiles where id = v_user;
    v_loyalty := least(
      v_loyalty,
      floor(coalesce(v_avail_points,0) * v_redeem_rate)::int,
      greatest(v_subtotal - v_discount, 0)
    );
    if v_loyalty > 0 then
      v_points_used := ceil(v_loyalty / v_redeem_rate)::int;
      update profiles set loyalty_points = greatest(loyalty_points - v_points_used, 0)
        where id = v_user;
      insert into loyalty_ledger (user_id, order_id, delta, reason)
        values (v_user, v_order_id, -v_points_used, 'redeem');
    end if;
  else
    v_loyalty := 0;
  end if;

  v_total := greatest(v_subtotal + v_shipping - v_discount - v_loyalty, 0);
  update orders set subtotal = v_subtotal, discount = v_discount,
    loyalty_used = v_loyalty, total = v_total where id = v_order_id;

  insert into order_status_history (order_id, status, note, changed_by)
    values (v_order_id, 'pending', 'Захиалга үүсгэгдсэн', v_user);

  return jsonb_build_object('order_id', v_order_id, 'order_no', v_order_no, 'total', v_total);
end $$;

------------------------------------------------------------------------------
-- 2. Admin notifications (cancellations land here; more types can follow).
------------------------------------------------------------------------------

create table if not exists admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'order_cancelled',
  order_id uuid references orders(id) on delete cascade,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table admin_notifications enable row level security;

drop policy if exists "staff read notifications" on admin_notifications;
create policy "staff read notifications" on admin_notifications
  for select using (is_staff());
drop policy if exists "staff update notifications" on admin_notifications;
create policy "staff update notifications" on admin_notifications
  for update using (is_staff());

------------------------------------------------------------------------------
-- 3. On cancellation: notify the admin and revoke the reward coupon this
--    order granted (if the customer never used it). Runs as a table trigger
--    so it fires for every path that cancels — RPC, admin panel, or SQL.
------------------------------------------------------------------------------

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

    -- The 300k+ reward coupon granted FOR this order: gone unless already
    -- redeemed on some other order.
    delete from coupons c
      where c.source_order_id = new.id
        and not exists (
          select 1 from coupon_redemptions r where r.coupon_id = c.id
        );
  end if;
  return new;
end $$;

drop trigger if exists orders_on_cancelled on orders;
create trigger orders_on_cancelled
  after update of status on orders
  for each row execute function orders_on_cancelled();

------------------------------------------------------------------------------
-- 4. Scheduled status motion (questions.md №14). pg_cron runs in UTC:
--    11:00 UB = 03:00 UTC, 23:00 UB = 15:00 UTC. Both functions go through
--    update_order_status so history, inventory and loyalty behave exactly as
--    a manual change would.
------------------------------------------------------------------------------

-- 11:00 UB: every PAID order placed before today (UB midnight) heads out.
-- Unpaid orders stay put — their reserves lapse via release_expired_reserves,
-- and shipping an unpaid order would give away stock.
create or replace function auto_dispatch_orders()
returns void language plpgsql as $$
declare
  v_row record;
begin
  for v_row in
    select id from orders
    where status in ('pending', 'confirmed')
      and payment_status = 'paid'
      -- "previous day's orders": placed before today's UB midnight. Written
      -- timezone-independently — date_trunc('day', timestamptz) would follow
      -- the SESSION TimeZone, which pg_cron doesn't guarantee to be UTC.
      and created_at < (
        (now() at time zone 'Asia/Ulaanbaatar')::date::timestamp
          at time zone 'Asia/Ulaanbaatar'
      )
  loop
    perform update_order_status(
      v_row.id, 'shipping', 'Автоматаар хүргэлтэд гарлаа (11:00)', null
    );
  end loop;
end $$;

-- 23:00 UB: the day's deliveries are done; whatever is still marked shipping
-- flips to delivered (which also releases locked loyalty points).
create or replace function auto_deliver_orders()
returns void language plpgsql as $$
declare
  v_row record;
begin
  for v_row in select id from orders where status = 'shipping'
  loop
    perform update_order_status(
      v_row.id, 'delivered', 'Автоматаар хүргэгдсэн (23:00)', null
    );
  end loop;
end $$;

do $$
begin
  perform cron.unschedule('auto-dispatch-orders');
exception when others then null; end $$;

do $$
begin
  perform cron.unschedule('auto-deliver-orders');
exception when others then null; end $$;

select cron.schedule('auto-dispatch-orders', '0 3 * * *', $$select auto_dispatch_orders();$$);
select cron.schedule('auto-deliver-orders', '0 15 * * *', $$select auto_deliver_orders();$$);
