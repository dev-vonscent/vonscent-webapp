-- Restock cost (A3 / А9 ашгийн тайлан): each restock records what the added
-- ml cost to buy. Together with products.bottle_price (the initial bottle)
-- this makes зардал computable, so the profit report can exist.

alter table restock_log
  add column if not exists cost int not null default 0;

-- Same function as 0007 with a cost parameter. The old 4-arg signature is
-- dropped so PostgREST doesn't have to disambiguate overloads.
drop function if exists restock_inventory(uuid, int, text, uuid);

create or replace function restock_inventory(
  p_product uuid, p_delta int, p_reason text, p_by uuid, p_cost int default 0
) returns void language plpgsql as $$
begin
  insert into inventory (product_id, on_hand_ml)
    values (p_product, greatest(p_delta, 0))
  on conflict (product_id) do update
    set on_hand_ml = inventory.on_hand_ml + p_delta;

  insert into restock_log (product_id, delta_ml, reason, created_by, cost)
    values (p_product, p_delta, coalesce(p_reason,''), p_by, greatest(coalesce(p_cost,0),0));

  update inventory
    set is_sold_out = (on_hand_ml - reserved_ml) <= 0
    where product_id = p_product;
end $$;
