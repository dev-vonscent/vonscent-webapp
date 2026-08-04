-- Personal coupons (todo.md B1 / B4): a coupon may be issued to one customer.
--
-- Until now every active coupon was public — the account page listed all of
-- them and validate_coupon() accepted any code from anyone, so a code meant
-- for a single customer was usable by the whole shop once it leaked.
-- user_id null keeps the existing behaviour (campaign-wide coupon).

alter table coupons
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists coupons_user_idx on coupons (user_id);

-- Customers may only see public coupons and their own.
drop policy if exists "coupons read active" on coupons;
create policy "coupons read active" on coupons for select
  using (is_active and (user_id is null or user_id = auth.uid()));

-- validate_coupon gains the caller's id. Dropped first: adding a defaulted
-- parameter with create-or-replace would leave the 2-arg version behind and
-- make every existing call ambiguous.
drop function if exists validate_coupon(text, int);

create or replace function validate_coupon(p_code text, p_subtotal int, p_user uuid default null)
returns jsonb language plpgsql stable as $$
declare
  c coupons%rowtype;
  v_discount int := 0;
begin
  if p_code is null or btrim(p_code) = '' then
    return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'EMPTY');
  end if;

  select * into c from coupons where upper(code) = upper(btrim(p_code)) limit 1;
  if not found then
    return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'NOT_FOUND');
  end if;
  -- A personal coupon is invisible to everyone else; report it as not found
  -- rather than confirming that someone else's code exists.
  if c.user_id is not null and c.user_id is distinct from p_user then
    return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'NOT_FOUND');
  end if;
  if not c.is_active then
    return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'INACTIVE');
  end if;
  if c.starts_at is not null and now() < c.starts_at then
    return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'NOT_STARTED');
  end if;
  if c.ends_at is not null and now() > c.ends_at then
    return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'EXPIRED');
  end if;
  if c.max_uses is not null and c.used_count >= c.max_uses then
    return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'MAX_USES');
  end if;
  if p_subtotal < c.min_subtotal then
    return jsonb_build_object('valid', false, 'discount', 0,
      'reason', 'MIN_SUBTOTAL', 'minSubtotal', c.min_subtotal);
  end if;

  if c.type = 'percent' then
    v_discount := floor(p_subtotal * c.value / 100.0);
  else
    v_discount := least(c.value, p_subtotal);
  end if;

  return jsonb_build_object('valid', true, 'discount', v_discount,
    'code', c.code, 'type', c.type, 'value', c.value);
end $$;

-- place_order must validate against the buyer, not anonymously — otherwise the
-- ownership check above is bypassed at the only point that actually spends the
-- coupon. Patched in place so the rest of 0015's body stays authoritative.
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
  v_redeem_rate numeric;
  v_avail_points int;
  v_points_used int;
begin
  -- First pass: reserve every line (fails fast on shortage).
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

    select variant_price(pv.*) into v_unit
      from product_variants pv where pv.id = v_variant;
    v_unit := coalesce(v_unit, 0);
    select name, brand into v_pname, v_brand from products where id = v_product;

    insert into order_items (
      order_id, product_id, variant_id, product_name, brand,
      ml, unit_price, qty, is_sample, line_total
    ) values (
      v_order_id, v_product, v_variant, coalesce(v_pname,''), coalesce(v_brand,''),
      v_ml, v_unit, v_qty, v_sample, v_unit * v_qty
    );
    v_subtotal := v_subtotal + v_unit * v_qty;
  end loop;

  -- Coupon: recompute discount on the server, for this buyer.
  if v_code is not null then
    v_coupon := validate_coupon(v_code, v_subtotal, v_user);
    if (v_coupon->>'valid')::boolean then
      v_discount := (v_coupon->>'discount')::int;
      update coupons set used_count = used_count + 1 where upper(code) = upper(v_code);
    else
      v_discount := 0;
    end if;
  end if;

  -- Loyalty redemption: clamp to available points and remaining payable.
  if v_user is not null and v_loyalty > 0 then
    select coalesce((value->>'redeemRate')::numeric, 1) into v_redeem_rate
      from settings where key = 'loyalty';
    v_redeem_rate := coalesce(v_redeem_rate, 1);
    select loyalty_points into v_avail_points from profiles where id = v_user;
    v_loyalty := least(
      v_loyalty,
      floor(coalesce(v_avail_points,0) * v_redeem_rate)::int,
      greatest(v_subtotal + v_shipping - v_discount, 0)
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
