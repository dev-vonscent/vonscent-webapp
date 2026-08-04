-- Turn the 2ml sample on as a real tier (todo.md B3).
--
-- Samples had a flag on the product (sample_available) but no size to sell:
-- the pricing tiers stopped at 5ml, so ticking the flag changed nothing. 2ml
-- is now an ordinary tier — same coefficient ceiling as 5ml, with the extra
-- decanting labour carried by the per-size fixed cost — and the storefront
-- offers it only for products whose sample_available is on.
--
-- Adding it to settings.pricing does not touch existing products: variants
-- are per-product rows, so the admin adds 2ml where it makes sense (the edit
-- form's per-size table) or the tier lands on newly created products.

update settings
set value = jsonb_set(
      value,
      '{tiers}',
      (
        select jsonb_agg(t order by (t->>'ml')::numeric)
        from (
          select jsonb_build_object('ml', 2, 'coefficient', 1.6) as t
          union all
          select jsonb_array_elements(value->'tiers')
        ) s(t)
      )
    )
where key = 'pricing'
  and not exists (
    select 1 from jsonb_array_elements(value->'tiers') e
    where (e->>'ml')::numeric = 2
  );
