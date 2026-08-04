-- Manual per-size pricing — the coefficient model is withdrawn (client, 2026-08).
--
-- The admin no longer enters a bottle price and lets a per-tier coefficient
-- derive each decant price: they type the ₮ price of 5ml, 10ml and 20ml
-- directly. So there is nothing to recompute, and no auto/override pair to
-- resolve — the two price columns collapse into one `price`.
--
-- The catalogue is also fixed at 5/10/20ml: the 2ml sample tier (0026) and its
-- per-product sample_available flag are removed.
--
-- bottle_price / bottle_ml stay. They stopped being pricing inputs but the
-- admin still needs them: stock is tracked in source ml (a size switches
-- itself off once the remaining ml can't fill it) and the monthly sales report
-- prices the ml sold against what the bottle cost.

-- 1. Withdraw every size outside 5/10/20. order_items.variant_id is
--    `on delete set null`, so historical orders keep their frozen unit price.
delete from product_variants where ml not in (5, 10, 20);
alter table products drop column if exists sample_available;

-- 2. Collapse auto_price + override_price into one admin-entered price. A row
--    that carried an override was already selling at it, so that is the price
--    to keep.
alter table product_variants add column if not exists price int;
update product_variants
  set price = coalesce(override_price, auto_price)
  where price is null;
alter table product_variants
  alter column price set default 0,
  alter column price set not null;
alter table product_variants
  drop constraint if exists product_variants_price_check;
alter table product_variants
  add constraint product_variants_price_check check (price >= 0);

-- Redefined before the old columns go: the order RPCs (0008/0015/0020/0025)
-- all charge through variant_price(), so keeping the function keeps them
-- working untouched.
create or replace function variant_price(v product_variants)
returns int language sql immutable as $$
  select v.price;
$$;

alter table product_variants
  drop column if exists auto_price,
  drop column if exists override_price;

-- 3. 5/10/20ml is the whole size list from here on.
alter table product_variants
  drop constraint if exists product_variants_ml_check;
alter table product_variants
  add constraint product_variants_ml_check check (ml in (5, 10, 20));

-- 4. Nothing derives a price any more, so the recompute RPC and the pricing
--    settings row (tiers, coefficients, roundTo, fixedCost) are dead weight.
drop function if exists recompute_variant_prices(uuid);
delete from settings where key = 'pricing';
