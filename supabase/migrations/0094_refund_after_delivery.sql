-- Хүргэгдсэний дараах буцаалт (docs/analysis/order_status_ux_proposal.md §3.5).
--
-- Client Cowork-ийн 2026-09-22-ны судалгаагаар: хүргэгдсэн + төлсөн захиалганд
-- буцаалт хийх зам бүрэн хаалттай байсан — `mark_order_refunded` нь
-- `status = 'cancelled'`-ийг ЗААВАЛ шаарддаг байсан, харин `delivered`-ээс
-- шууд `cancelled` рүү шилжих боломж (`NEXT_STATUSES`) байхгүй, зөвхөн
-- super_admin-ий нуугдмал 2 алхамт `delivered → shipping → cancelled`
-- сэргээлтээр л боломжтой байв.
--
-- Best practice (Shopify/WooCommerce): цуцлалт (захиалгын мөчлөгийг хаах)
-- ба буцаалт (мөнгөний үйлдэл) хоёр тусдаа зүйл. Хүргэгдсэн захиалганд
-- буцаалт хийхэд «цуцлагдсан» гэж дүр эсгэх шаардлагагүй — зүгээр
-- `payment_status`-ыг л `refunded` болгоно, `order_status` хэвээрээ
-- `delivered` үлдэнэ (Shopify-н «Fulfilled + Refunded» загвартай адил).
--
-- Зориудаар ХИЙГДЭЭГүй зүйлс (docs §1.5, §3.5): энэ функц ml, оноо, купонд
-- ОГТ хүрдэггүй — нээгдсэн decant-ыг дахин зарах эсэхийг систем шийддэггүй,
-- админ өөрөө (Үлдэгдэл хуудаснаас, 0₮ үнээр) гараар шийднэ.
create or replace function mark_order_refunded(p_order uuid, p_by uuid)
returns jsonb language plpgsql as $$
declare
  v_status order_status_t;
  v_pay payment_status_t;
begin
  select status, payment_status into v_status, v_pay
    from orders where id = p_order for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NOT_FOUND');
  end if;

  -- Хоёр дахь даралт нь түүхэнд давхар мөр үлдээхгүй.
  if v_pay = 'refunded' then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  if v_pay <> 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'NOT_PAID');
  end if;
  -- `delivered` нэмэгдэв: хүргэгдсэний дараах буцаалт (§3.5). Бусад бүх
  -- идэвхтэй төлөв (pending/confirmed/shipping) хэвээрээ эхлээд цуцлагдах
  -- ёстой — тэдгээрийг цуцлах нь мл/оноо/купоныг зөв буцаадаг тул буцаалт
  -- түүнээс хойш л утга учиртай.
  if v_status not in ('cancelled', 'delivered') then
    return jsonb_build_object('ok', false, 'reason', 'NOT_CANCELLED');
  end if;

  update orders set payment_status = 'refunded' where id = p_order;
  insert into order_status_history (order_id, status, note, changed_by)
    values (p_order, v_status, 'Төлбөр буцаагдсан', p_by);

  return jsonb_build_object('ok', true);
end $$;
