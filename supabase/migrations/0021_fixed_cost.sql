-- Fixed cost per decant — bottle, label and cargo (todo.md B2).
--
-- The perfume itself scales with ml, but the packaging around it doesn't: a
-- 5ml and a 20ml decant use the same vial and the same delivery. Pricing off
-- the per-ml cost alone therefore under-prices small sizes. `fixedCost` is a
-- flat ₮ added before rounding, shop-wide by default and per-tier when a size
-- uses a costlier container.
--
-- Seeded at 0 so prices don't move until the admin enters the real figure
-- (still open with the client, todo.md §C).

update settings
  set value = value || jsonb_build_object('fixedCost', 0)
  where key = 'pricing' and not (value ? 'fixedCost');

-- Mirrors lib/pricing/calc.ts — the two must stay in step.
create or replace function recompute_variant_prices(p_product uuid)
returns void language plpgsql as $$
declare
  v_price int;
  v_round int;
  v_tiers jsonb;
  v_fixed_global numeric;
  v_fixed numeric;
  rec record;
  base_per_ml numeric;
  coeff numeric;
begin
  select bottle_price::numeric / bottle_ml into base_per_ml
    from products where id = p_product;
  if base_per_ml is null then return; end if;

  select (value->>'roundTo')::int, value->'tiers', (value->>'fixedCost')::numeric
    into v_round, v_tiers, v_fixed_global
    from settings where key = 'pricing';
  v_round := coalesce(v_round, 100);
  v_fixed_global := greatest(coalesce(v_fixed_global, 0), 0);

  for rec in select * from product_variants where product_id = p_product loop
    select (t->>'coefficient')::numeric, (t->>'fixedCost')::numeric
      into coeff, v_fixed
      from jsonb_array_elements(v_tiers) t
      where (t->>'ml')::int = rec.ml
      limit 1;
    if coeff is null then coeff := 1; end if;
    -- A tier without its own fixedCost inherits the shop-wide one.
    v_fixed := greatest(coalesce(v_fixed, v_fixed_global), 0);
    v_price := ceil((base_per_ml * rec.ml * coeff + v_fixed) / v_round) * v_round;
    update product_variants set auto_price = v_price where id = rec.id;
  end loop;
end $$;
