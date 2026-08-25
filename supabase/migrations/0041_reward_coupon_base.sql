-- Автомат урамшууллын купоны босгыг барааны цэвэр дүнгээс бодно
-- (requirement_final.md: «хүргэлт ороогүй, купоны хямдрал хасагдсаны дараах
-- дүнгээр»). 0025 compared orders.total, which includes the delivery fee and
-- subtracts spent points — both wrong for the threshold. Points spent must
-- NOT shrink the base; delivery must not inflate it.

create or replace function grant_reward_coupon(p_order uuid)
returns text language plpgsql as $$
declare
  v_user uuid;
  v_base int;
  v_cfg jsonb;
  v_code text;
begin
  -- Threshold base = goods subtotal after the coupon, before shipping and
  -- before loyalty points.
  select user_id, greatest(coalesce(subtotal, 0) - coalesce(discount, 0), 0)
    into v_user, v_base from orders where id = p_order;
  if v_user is null then return null; end if;   -- guests have nowhere to put it

  select value->'autoGrant' into v_cfg from settings where key = 'coupons';
  if v_cfg is null or not coalesce((v_cfg->>'enabled')::boolean, false) then
    return null;
  end if;
  if v_base < coalesce((v_cfg->>'minTotal')::int, 300000) then
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
