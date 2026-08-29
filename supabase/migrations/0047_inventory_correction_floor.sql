-- Үлдэгдлийн залруулга (сөрөг delta) хамгаалалт.
--
-- Админ өдөр тутам «өөр платформ дээр зарагдсан», «гаальд гэмтсэн» гэх мэт
-- шалтгаанаар нөөцөө *хасах* шаардлагатай болдог. 0037-ийн restock_inventory
-- сөрөг delta-г ямар ч шалгалтгүй нэмдэг байсан тул:
--
--   1. on_hand_ml сөрөг болох боломжтой байв;
--   2. on_hand_ml нь reserved_ml-ээс доош унаж, аль хэдийн захиалагдсан
--      (мөнгө нь орсон) ml-ийг гүйцэтгэх боломжгүй болох эрсдэлтэй байв —
--      энэ нь oversell-ийн яг тэр хэлбэр, зөвхөн нөгөө талаас нь.
--
-- Одоо мөрийг түгжиж уншаад шалгана: зэрэг ирсэн хоёр залруулга нийлээд
-- шалгалтыг тойрч гарахгүй.

create or replace function restock_inventory(
  p_product uuid, p_delta int, p_reason text, p_by uuid, p_cost int default 0
) returns void language plpgsql as $$
declare
  v_on_hand int;
  v_reserved int;
begin
  -- Мөр байхгүй бол 0-ээр үүсгээд, нэмэлтийг доор нэг л удаа хийнэ.
  -- (0037 энд `do update set on_hand_ml = ... + p_delta` хийдэг байсныг
  --  давхар нэмэхээс сэргийлж салгав.)
  insert into inventory (product_id, on_hand_ml)
    values (p_product, 0)
  on conflict (product_id) do nothing;

  select on_hand_ml, reserved_ml
    into v_on_hand, v_reserved
    from inventory
   where product_id = p_product
     for update;

  if v_on_hand + p_delta < v_reserved then
    raise exception
      'RESERVED_FLOOR: reserved=% on_hand=% delta=%', v_reserved, v_on_hand, p_delta
      using errcode = 'check_violation';
  end if;

  update inventory
     set on_hand_ml = v_on_hand + p_delta
   where product_id = p_product;

  insert into restock_log (product_id, delta_ml, reason, created_by, cost)
    values (p_product, p_delta, coalesce(p_reason, ''), p_by,
            greatest(coalesce(p_cost, 0), 0));

  update inventory
     set is_sold_out = (on_hand_ml - reserved_ml) <= 0
   where product_id = p_product;
end $$;

comment on function restock_inventory(uuid, int, text, uuid, int) is
  'Нөөц нэмэх (+delta, өртөгтэй) ба залруулах (-delta). Захиалагдсан ml-ээс '
  'доош хасахыг татгалзана (RESERVED_FLOOR).';
