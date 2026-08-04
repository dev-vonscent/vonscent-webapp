-- Per-customer coupon limits and the automatic reward coupon (todo.md B4).
--
-- `coupons.max_uses` is a shop-wide budget: one customer could burn a 100-use
-- campaign alone. `max_uses_per_user` caps it per account, counted from a
-- redemption log rather than from orders, so the count survives an order being
-- edited and gives the admin an audit trail of who used what.

alter table coupons
  add column if not exists max_uses_per_user int,
  -- Set when the coupon was handed out automatically for an order; also what
  -- makes the grant idempotent if payment is confirmed twice.
  add column if not exists source_order_id uuid references orders(id) on delete set null;

create unique index if not exists coupons_source_order_idx
  on coupons (source_order_id) where source_order_id is not null;

create table if not exists coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references coupons(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  order_id uuid references orders(id) on delete set null,
  created_at timestamptz not null default now(),
  -- One row per order: place_order is the only writer, but a retry after a
  -- partial failure must not double-count.
  unique (coupon_id, order_id)
);
create index if not exists coupon_redemptions_user_idx
  on coupon_redemptions (coupon_id, user_id);

alter table coupon_redemptions enable row level security;
create policy "coupon redemptions read" on coupon_redemptions for select
  using (user_id = auth.uid() or is_staff());
create policy "coupon redemptions staff write" on coupon_redemptions for all
  using (is_staff()) with check (is_staff());

-- ── validate_coupon: enforce the per-customer cap ──────────────────────
create or replace function validate_coupon(p_code text, p_subtotal int, p_user uuid default null)
returns jsonb language plpgsql stable as $$
declare
  c coupons%rowtype;
  v_discount int := 0;
  v_mine int;
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
  if c.max_uses_per_user is not null then
    -- A guest has no account to count against, so a per-customer cap is
    -- unenforceable for them: ask them to sign in instead of letting the
    -- limit be bypassed by checking out as a guest every time.
    if p_user is null then
      return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'LOGIN_REQUIRED');
    end if;
    select count(*) into v_mine from coupon_redemptions
      where coupon_id = c.id and user_id = p_user;
    if v_mine >= c.max_uses_per_user then
      return jsonb_build_object('valid', false, 'discount', 0, 'reason', 'MAX_USES_USER');
    end if;
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

-- ── place_order: log the redemption (replaces 0020) ────────────────────
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
  v_coupon_id uuid;
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

-- ── Automatic reward coupon on a large order ───────────────────────────
-- The client's rule: an order over a threshold (300,000₮) earns the customer
-- a personal coupon for next time. Everything about it is admin-owned in
-- settings.coupons.autoGrant, and it is off until the admin turns it on.
insert into settings (key, value) values
  ('coupons', jsonb_build_object(
     'autoGrant', jsonb_build_object(
       'enabled', false,
       'minTotal', 300000,
       'type', 'percent',
       'value', 10,
       'validDays', 30,
       'maxUsesPerUser', 1)))
on conflict (key) do nothing;

/** A short, unambiguous code: no 0/O/1/I to mistype off a screenshot. */
create or replace function generate_coupon_code(p_prefix text default 'VS')
returns text language plpgsql as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  i int;
begin
  loop
    v_code := p_prefix || '-';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from coupons where upper(code) = upper(v_code));
  end loop;
  return v_code;
end $$;

create or replace function grant_reward_coupon(p_order uuid)
returns text language plpgsql as $$
declare
  v_user uuid;
  v_total int;
  v_cfg jsonb;
  v_code text;
begin
  select user_id, total into v_user, v_total from orders where id = p_order;
  if v_user is null then return null; end if;   -- guests have nowhere to put it

  select value->'autoGrant' into v_cfg from settings where key = 'coupons';
  if v_cfg is null or not coalesce((v_cfg->>'enabled')::boolean, false) then
    return null;
  end if;
  if coalesce(v_total, 0) < coalesce((v_cfg->>'minTotal')::int, 300000) then
    return null;
  end if;
  -- One reward per order, even if payment is confirmed twice.
  if exists (select 1 from coupons where source_order_id = p_order) then
    return null;
  end if;

  v_code := generate_coupon_code('VS');
  insert into coupons (code, user_id, source_order_id, type, value, min_subtotal,
                       max_uses, max_uses_per_user, ends_at, is_active)
  values (
    v_code, v_user, p_order,
    coalesce(v_cfg->>'type', 'percent')::coupon_type_t,
    coalesce((v_cfg->>'value')::int, 10),
    0, null,
    coalesce((v_cfg->>'maxUsesPerUser')::int, 1),
    now() + (coalesce((v_cfg->>'validDays')::int, 30) || ' days')::interval,
    true
  );
  return v_code;
end $$;

-- Hung off the orders table rather than inlined into mark_order_paid so the
-- reward rule can change without another copy of that function.
create or replace function orders_grant_reward_coupon()
returns trigger language plpgsql as $$
begin
  perform grant_reward_coupon(new.id);
  return new;
end $$;

drop trigger if exists orders_reward_coupon on orders;
create trigger orders_reward_coupon
  after update of payment_status on orders
  for each row
  when (new.payment_status = 'paid' and old.payment_status is distinct from 'paid')
  execute function orders_grant_reward_coupon();
