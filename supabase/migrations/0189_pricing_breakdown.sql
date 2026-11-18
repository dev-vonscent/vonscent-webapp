-- Үнийн задаргаа ба урамшууллын суурь (task 8, 9, 10, 17; fix/pricing-checkout).
--
-- 1. Хямдрал (арга хэмжээ / гар хямдрал) захиалга дээр ТУСДАА хадгалагдана.
--    Өмнө нь `variant_price()` нь хямдарсан үнийг шууд мөрийн үнэ болгодог
--    тул «хэдэн төгрөг хямдарсан, аль арга хэмжээгээр» гэдэг захиалгын
--    баримтад хаана ч үлддэггүй байв. Задаргааны дараалал (клиентийн шийдвэр,
--    2026-11-17): Үндсэн үнийн нийлбэр → − Багц → − Арга хэмжээ / Хямдрал →
--    − Купон → − V point → + Хүргэлт. Купон нь хямдралын ДАРААХ дүнгээс
--    бодогддог (validate_coupon хөндөгдөхгүй) тул энэ дараалал л тоогоор
--    зөв уншигдана.
--      · `order_items.base_price` — үндсэн үнэ (`product_variants.price`).
--      · `order_items.sale_label` — арга хэмжээний нэр (`sale_events.name`),
--        гар хямдрал бол «Хямдрал». Нэртэй хямдралын нэр (`sales.name`) нь
--        зөвхөн админд — хэрэглэгчид хэзээ ч гарахгүй.
--      · `orders.sale_discount`, `orders.sale_breakdown` ([{label, amount}]).
--    Хуучин захиалгад null — уншигч тал өмнөх шигээ харуулна.
--
-- 2. Багцын гишүүний `list_price` = ҮНДСЭН үнэ (D5). 0097-оос хойш
--    `greatest(variant_price, unit)` байсан тул гишүүн хямдарсан үед
--    «Багцын хямдрал» дутуу харагддаг байв. Багц (бэлэн ба угсарсан) нь
--    үндсэн үнээр бодогддог тул `gross_subtotal − subtotal` = багцын хямдрал.
--
--    `place_order_core` (0149)-ийн 600 мөрийг хуулахгүйн тулд бүгдийг 0155-ын
--    нимгэн `place_order` wrapper дотор, core-ийн ДАРАА, нэг transaction-д
--    `order_apply_price_breakdown()` бичнэ. Дүн (`subtotal`, `discount`,
--    `total`) хөндөгдөхгүй — зөвхөн тайлбарлах өгөгдөл.
--
-- 3. Урамшууллын суурь = QPay-ээр төлсөн дүн = `orders.total` (хүргэлттэй,
--    купон ба V point хассан): оноо (`mark_order_paid`, 8.4), автомат купон
--    (`grant_reward_coupon`, 9.1), хүрдний эрх (`grant_order_spins`, 9.2).
--    Зөвхөн цаашид төлөгдөх захиалгад — өмнөхийг дахин бодохгүй. Түвшний
--    зарцуулалт (`user_lifetime_spend`), 1ml бэлгийн эрх хуучнаараа.
--
-- 4. `admin_product_options`-д `base_price_by_ml` (task 17): багцын «Нийлбэр»
--    үндсэн үнээс. Хуучин багана, дараалал хэвээр — шинэ багана төгсгөлд.
--
-- Expand only: nullable багана, функцийн бие, шинэ функц. Хуучин код
-- (prod дээр migration merge-ээс өмнө ажиллана) шинэ баганыг үл тоомсорлоно.

------------------------------------------------------------------------------
-- 1. Баганууд
------------------------------------------------------------------------------

alter table order_items
  add column if not exists base_price int check (base_price >= 0),
  add column if not exists sale_label text;
comment on column order_items.base_price is
  'Үндсэн нэгж үнэ (product_variants.price). 0189-өөс өмнөх захиалгад null.';
comment on column order_items.sale_label is
  'Мөрийн хямдралын эх сурвалж: арга хэмжээний нэр, эсвэл «Хямдрал» (гар). '
  'Хямдралгүй / багцын мөрөнд null.';

alter table orders
  add column if not exists sale_discount int check (sale_discount >= 0),
  add column if not exists sale_breakdown jsonb;
comment on column orders.sale_discount is
  'Арга хэмжээ + гар хямдралын нийт дүн (₮). 0189-өөс өмнөх захиалгад null.';
comment on column orders.sale_breakdown is
  '[{label, amount}] — задаргааны мөрүүд, арга хэмжээ эхэнд, «Хямдрал» сүүлд.';

------------------------------------------------------------------------------
-- 2. Хямдралын шошго
------------------------------------------------------------------------------

-- Нэг хэмжээний ОДООГИЙН үнийг арга хэмжээ тогтоож байвал түүний нэр, үгүй
-- бол null (гар хямдрал эсвэл хямдралгүй). `variant_price`-тай ижил дүрэм:
-- арга хэмжээний үнэ нь бодит үнэтэй тэнцүү ба үндсэнээс бага. Гар хямдрал
-- илүү хямд бол бодит үнэ тэрнийх → null → «Хямдрал».
-- PostgREST computed column: `product_variants ( …, variant_sale_label )`.
create or replace function variant_sale_label(v product_variants)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select e.name
    from sale_event_discounts d
    join sale_events e on e.id = d.event_id
    join feature_flags f on f.key = 'sale_events' and f.enabled
   where d.product_id = v.product_id
     and d.ml = v.ml
     and e.is_active
     and e.starts_at <= now()
     and now() < e.ends_at
     and event_discount_price(v.price, d.pct) < v.price
     and event_discount_price(v.price, d.pct) = variant_price(v)
   order by d.pct desc, e.starts_at, e.id
   limit 1;
$$;

revoke all on function variant_sale_label(product_variants) from public;
grant execute on function variant_sale_label(product_variants)
  to anon, authenticated, service_role;

------------------------------------------------------------------------------
-- 3. Захиалгын задаргаа бичих
------------------------------------------------------------------------------

-- `place_order_core`-ийн дараа, ижил transaction-д. Мөрийн үнэ (`unit_price`)
-- нь core-ийн бичсэн `variant_price` тул тэр мөчийн хямдралыг дахин уншина —
-- нэг statement дотор `now()` тогтмол тул зөрөхгүй.
create or replace function order_apply_price_breakdown(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Үнэртний мөр (бэлэг, шагнал, нэмэлт бараанаас бусад).
  update order_items i
     set base_price = pv.price,
         sale_label = case
           when i.collection_name is null and i.unit_price < pv.price
             then coalesce(variant_sale_label(pv.*), 'Хямдрал')
         end,
         -- Багцын гишүүн: хямдралгүй үнэ = ҮНДСЭН үнэ (D5).
         list_price = case
           when i.collection_name is not null
             then greatest(pv.price, i.unit_price)
           else i.list_price
         end
    from product_variants pv
   where i.order_id = p_order
     and i.line_kind = 'perfume'
     and not i.is_gift
     and pv.id = i.variant_id;

  update orders o
     set gross_subtotal = (
           select coalesce(sum(coalesce(i.list_price, i.unit_price)::bigint * i.qty), 0)::int
             from order_items i where i.order_id = p_order),
         sale_discount = (
           select coalesce(sum((i.base_price - i.unit_price)::bigint * i.qty), 0)::int
             from order_items i
            where i.order_id = p_order and i.sale_label is not null),
         sale_breakdown = coalesce((
           select jsonb_agg(jsonb_build_object('label', s.label, 'amount', s.amount)
                            order by s.manual, s.amount desc, s.label)
             from (
               select i.sale_label as label,
                      i.sale_label = 'Хямдрал' as manual,
                      sum((i.base_price - i.unit_price)::bigint * i.qty)::int as amount
                 from order_items i
                where i.order_id = p_order and i.sale_label is not null
                group by i.sale_label
             ) s
            where s.amount > 0), '[]'::jsonb)
   where o.id = p_order;
end $$;

revoke all on function order_apply_price_breakdown(uuid) from public, anon, authenticated;
grant execute on function order_apply_price_breakdown(uuid) to service_role;

-- Хариунд задаргаа нэмэгдэнэ (шинэ түлхүүр — хуучин уншигч үл тоомсорлоно).
create or replace function order_summary(p_order uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'order_id', o.id,
    'order_no', o.order_no,
    'subtotal', o.subtotal,
    'gross_subtotal', o.gross_subtotal,
    'sale_discount', o.sale_discount,
    'sale_breakdown', o.sale_breakdown,
    'discount', o.discount,
    'loyalty_used', o.loyalty_used,
    'shipping_fee', o.shipping_fee,
    'total', o.total,
    'omitted_gifts', coalesce(o.omitted_gifts, '[]'::jsonb),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id,
               'line_kind', i.line_kind,
               'product_id', i.product_id,
               'variant_id', i.variant_id,
               'extra_variant_id', i.extra_variant_id,
               'name', i.product_name,
               'brand', i.brand,
               'variant_label', i.variant_label,
               'ml', i.ml,
               'qty', i.qty,
               'unit_price', i.unit_price,
               'list_price', i.list_price,
               'base_price', i.base_price,
               'sale_label', i.sale_label,
               'line_total', i.line_total,
               'is_gift', i.is_gift,
               'collection_name', i.collection_name)
             order by i.line_no nulls last, i.id)
        from order_items i where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from orders o where o.id = p_order;
$$;

-- 0155-ын wrapper — зөвшөөрлийн шалгалт хэвээр, core-ийн дараа задаргаа.
create or replace function place_order(p_order jsonb, p_items jsonb)
returns jsonb language plpgsql as $$
declare
  v_needs boolean;
  v_result jsonb;
  v_order uuid;
begin
  -- Сагсанд зөвшөөрөл шаардах горимын (хоосон шил, үлдэгдэлтэй шил) бараа?
  select exists (
    select 1
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
      join extra_variants v
        on v.id = nullif(i->>'extra_variant_id', '')::uuid
      join extra_products p on p.id = v.extra_id
      join extra_category_modes m
        on m.category_id = p.category_id
       and m.inventory_mode = p.inventory_mode
     where m.requires_consent
  ) into v_needs;

  if v_needs and not coalesce((p_order->>'used_goods_consent')::boolean, false) then
    raise exception 'USED_GOODS_CONSENT_REQUIRED' using errcode = 'check_violation';
  end if;

  v_result := place_order_core(p_order, p_items);
  v_order := (v_result->>'order_id')::uuid;

  if v_needs then
    update orders set used_goods_consent_at = coalesce(used_goods_consent_at, now())
     where id = v_order;
  end if;

  -- 0189: хямдрал / багцын задаргаа (дүнг өөрчлөхгүй).
  perform order_apply_price_breakdown(v_order);
  return order_summary(v_order);
end $$;

comment on function place_order(jsonb, jsonb) is
  'Захиалга үүсгэх (0155 wrapper, 0189): хэрэглэсэн барааны зөвшөөрлийг '
  'шалгаад place_order_core (0149)-г дуудаж, үнийн задаргааг бичнэ. '
  'Хариу = order_summary().';

revoke all on function place_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function place_order(jsonb, jsonb) to service_role;

------------------------------------------------------------------------------
-- 4. Урамшууллын суурь = orders.total (QPay-ээр төлсөн)
------------------------------------------------------------------------------

create or replace function mark_order_paid(p_order uuid, p_by uuid DEFAULT NULL::uuid, p_source text DEFAULT 'qpay'::text)
 RETURNS void
 LANGUAGE plpgsql
AS $$
declare
  v_item record;
  v_user uuid;
  v_status payment_status_t;
  v_order_status order_status_t;
  v_subtotal int;
  v_discount int;
  v_base int;
  v_earn_per int;
  v_earn_points int;
  v_lock_hours numeric;
  v_earned int;
  v_rate int;
  v_now_ub timestamp;
  v_min_day date;
  v_deliver_old date;
  v_deliver_new date;
  v_available timestamptz;
  v_note text;
  v_order_type text;   -- 0179
  v_order_no text;     -- 0179
  v_total int;         -- 0189
  v_spend_base int;    -- 0189
begin
  select user_id, payment_status, status, subtotal, discount, deliver_on,
         order_type, order_no, total
    into v_user, v_status, v_order_status, v_subtotal, v_discount, v_deliver_old,
         v_order_type, v_order_no, v_total
    from orders where id = p_order for update;
  if v_status = 'paid' then
    return;  -- idempotent
  end if;
  -- Цуцлагдсан захиалгын мл, оноо, купон аль хэдийн буцсан (0073).
  if v_order_status = 'cancelled' then
    raise exception 'ORDER_CANCELLED' using errcode = 'check_violation';
  end if;
  -- 0149: төлбөрийг зөвхөн хүлээгдэж буй / баталгаажсан захиалгад (§6.4).
  if v_order_status not in ('pending', 'confirmed') or v_status = 'refunded' then
    raise exception 'ILLEGAL_TRANSITION:%:paid', v_order_status
      using errcode = 'check_violation';
  end if;

  v_note := case p_source
    when 'manual' then 'Төлбөр төлөгдсөн (гараар тэмдэглэсэн)'
    when 'mock'   then 'Төлбөр төлөгдсөн (mock)'
    else 'Төлбөр төлөгдсөн (QPay)'
  end;

  -- ── 0179: Бэлгийн карт — хүргэлтгүй, шууд «хүргэгдсэн» ─────────────────
  -- Туг энд шалгахгүй: захиалга үүссэн (туг асаалттай байсан) бол мөнгө
  -- орсон картыг заавал идэвхжүүлнэ.
  if v_order_type = 'gift_card' then
    if v_user is not null then
      perform 1 from profiles where id = v_user for update;
    end if;

    update orders set payment_status = 'paid', status = 'delivered',
      deliver_on = null, reserve_expires_at = null where id = p_order;
    insert into order_status_history (order_id, status, note, changed_by)
      values (p_order, 'delivered', 'Бэлгийн карт — ' || v_note, p_by);

    update gift_cards
       set status = 'active', issued_at = now(),
           expires_at = now() + interval '1 year', updated_at = now()
     where order_id = p_order and status = 'pending';
    insert into gift_card_events (gift_card_id, kind, actor, data)
      select id, 'issued', p_by, jsonb_build_object('source', p_source)
        from gift_cards where order_id = p_order and status = 'active';

    -- Худалдан авагчийн оноо (K12): зэрэглэлийн хувиар. Картын захиалга
    -- зарцуулалтад орохгүй (§12-Q3) тул user_lifetime_spend-ээс хасах
    -- шаардлагагүй. Карт ашиглагдах эсвэл 7 хоногийн дараа нээгдэнэ (§12-Q4).
    if v_user is not null then
      select coalesce((value->>'earnPer')::int, 100),
             coalesce((value->>'earnPoints')::int, 1)
        into v_earn_per, v_earn_points
        from settings where key = 'loyalty';
      v_earn_per := coalesce(v_earn_per, 100);
      v_earn_points := coalesce(v_earn_points, 1);
      v_base := greatest(coalesce(v_subtotal, 0), 0);
      if feature_enabled('user_tiers') then
        v_rate := tier_rate_for_spend(user_lifetime_spend(v_user));
        v_earned := floor(v_base::bigint * v_rate / 100);
      elsif v_earn_per > 0 then
        v_earned := floor(v_base / v_earn_per) * v_earn_points;
      else
        v_earned := 0;
      end if;
      if v_earned > 0 then
        update profiles set pending_points = pending_points + v_earned
          where id = v_user;
        insert into loyalty_ledger
          (user_id, order_id, delta, reason, available_at, released)
          values (v_user, p_order, v_earned, 'earn',
                  now() + interval '7 days', false);
      end if;

      perform notify_user(
        v_user, 'order_paid',
        v_order_no || ' — бэлгийн картын төлбөр баталгаажлаа',
        'Картаа «Бэлгийн карт» хэсгээс харж, илгээх боломжтой.',
        '/account/gift-cards',
        jsonb_build_object('orderId', p_order),
        'order:' || p_order || ':order_paid'
      );
    end if;
    return;
  end if;
  -- ── /0179 ───────────────────────────────────────────────────────────────

  v_now_ub := now() at time zone 'Asia/Ulaanbaatar';
  v_min_day := v_now_ub::date + 1;
  v_deliver_new := greatest(coalesce(v_deliver_old, v_min_day), v_min_day);

  -- Түгжих дараалал: profiles → inventory (0149).
  if v_user is not null then
    perform 1 from profiles where id = v_user for update;
  end if;
  perform 1 from inventory
   where product_id in (select product_id from order_items
                         where order_id = p_order and line_kind = 'perfume'
                           and product_id is not null)
   order by product_id for update;

  update orders set payment_status = 'paid', status = 'confirmed',
    deliver_on = v_deliver_new,
    reserve_expires_at = null where id = p_order;

  -- Шингэн төлбөрөөр commit; нэмэлт бараа, сав хүргэлтээр (§6.3).
  for v_item in
    select product_id, sum(ml * qty)::int as need from order_items
     where order_id = p_order and line_kind = 'perfume' and product_id is not null
     group by product_id order by product_id
  loop
    perform commit_inventory(v_item.product_id, v_item.need);
  end loop;

  insert into order_status_history (order_id, status, note, changed_by)
    values (p_order, 'confirmed', v_note, p_by);

  if v_deliver_old is not null and v_deliver_new <> v_deliver_old then
    insert into order_status_history (order_id, status, note)
      values (p_order, 'confirmed',
        'Хүргэх өдөр ' || to_char(v_deliver_old, 'MM/DD') || ' → ' ||
        to_char(v_deliver_new, 'MM/DD') || ' болж шилжлээ (төлбөр ' ||
        to_char(v_now_ub, 'MM/DD HH24:MI') || '-д төлөгдсөн)');
  end if;

  if v_user is not null then
    select coalesce((value->>'earnPer')::int, 100),
           coalesce((value->>'earnPoints')::int, 1),
           coalesce((value->>'lockHours')::numeric, 24)
      into v_earn_per, v_earn_points, v_lock_hours
      from settings where key = 'loyalty';
    v_earn_per := coalesce(v_earn_per, 100);
    v_earn_points := coalesce(v_earn_points, 1);
    v_lock_hours := greatest(coalesce(v_lock_hours, 24), 0);
    -- 0189 (task 8.4): оноо QPay-ээр БОДИТООР төлсөн дүнгээс = `orders.total`
    -- (хүргэлттэй, купон ба V point хассан). V point (бэлгийн картынх ч)
    -- бэлэн мөнгө биш тул суурьт орохгүй.
    v_base := greatest(coalesce(v_total, 0), 0);
    -- Түвшний зарцуулалт (`user_lifetime_spend`) хуучин суурьтайгаа
    -- (купоны дараах барааны дүн) хэвээр — энэ захиалгын өмнөх зарцуулалтыг
    -- олохдоо ижил суурийг хасна.
    v_spend_base := greatest(coalesce(v_subtotal,0) - coalesce(v_discount,0), 0);
    if feature_enabled('user_tiers') then
      v_rate := tier_rate_for_spend(
        greatest(user_lifetime_spend(v_user) - v_spend_base, 0));
      v_earned := floor(v_base::bigint * v_rate / 100);
    elsif v_earn_per > 0 then
      v_earned := floor(v_base / v_earn_per) * v_earn_points;
    else
      v_earned := 0;
    end if;
    if v_earned > 0 then
      v_available := (v_deliver_new::timestamp
                       + (v_lock_hours || ' hours')::interval)
                     at time zone 'Asia/Ulaanbaatar';
      update profiles set pending_points = pending_points + v_earned
        where id = v_user;
      insert into loyalty_ledger
        (user_id, order_id, delta, reason, available_at, released)
        values (v_user, p_order, v_earned, 'earn', v_available, false);
      if v_available <= now() then
        perform release_order_points(p_order);
      end if;
    end if;
  end if;
end $$
;

revoke all on function mark_order_paid(uuid, uuid, text) from public, anon, authenticated;
grant execute on function mark_order_paid(uuid, uuid, text) to service_role;

create or replace function grant_reward_coupon(p_order uuid)
 RETURNS text
 LANGUAGE plpgsql
AS $$
declare
  v_user uuid;
  v_base int;
  v_settings jsonb;
  v_tiers jsonb;
  v_cfg jsonb;
  v_code text;
  v_uses int;
begin
  -- 0189 (task 9.1): босгыг QPay-ээр төлсөн дүнгээр (`orders.total` —
  -- хүргэлттэй, купон ба V point хассан) шалгана.
  select user_id, greatest(coalesce(total, 0), 0)
    into v_user, v_base from orders where id = p_order;
  if v_user is null then return null; end if;   -- зочинд хадгалах газар алга

  -- Төлбөр хоёр удаа баталгаажсан ч нэг захиалгад нэг л купон.
  if exists (select 1 from coupons where source_order_id = p_order) then
    return null;
  end if;

  select value into v_settings from settings where key = 'coupons';
  if jsonb_typeof(v_settings->'tiers') = 'array' then
    v_tiers := v_settings->'tiers';
  elsif jsonb_typeof(v_settings->'autoGrant') = 'object' then
    -- Хуучин хэлбэр: босгогүй бол 300k (0041-ийн анхдагч).
    v_tiers := jsonb_build_array(
      jsonb_build_object('minTotal', 300000) || (v_settings->'autoGrant'));
  else
    return null;
  end if;

  -- Хүрсэн идэвхтэй шатлалуудаас хамгийн өндөр босготой нь. Тоон талбар нь
  -- тоо биш (эвдэрсэн) мөрийг cast хийхээс өмнө шүүнэ.
  select t into v_cfg
    from jsonb_array_elements(v_tiers) t
   where jsonb_typeof(t) = 'object'
     and t->'enabled' = 'true'::jsonb
     and jsonb_typeof(t->'minTotal') = 'number'
     and jsonb_typeof(t->'value') = 'number'
     and (t->>'minTotal')::numeric > 0
     and (t->>'value')::numeric >= 1
     and (t->>'value')::numeric <= 100000000
     and (t->>'minTotal')::numeric <= v_base
     and coalesce(t->>'type', 'percent') in ('percent', 'fixed')
   order by (t->>'minTotal')::numeric desc, (t->>'value')::numeric desc
   limit 1;
  if v_cfg is null then return null; end if;

  -- Хуваалцаж болох тул нийт хязгаар = нэг хүний хязгаар (0104 §2).
  -- Тоон талбаруудыг int болгохдоо бутархай/асар том утгаар cast унахгүйн
  -- тулд numeric-ээр хавчина: энэ функц төлбөрийн trigger дотор явдаг.
  v_uses := least(greatest(coalesce(
    case when jsonb_typeof(v_cfg->'maxUsesPerUser') = 'number'
         then floor((v_cfg->>'maxUsesPerUser')::numeric) end, 1), 1), 100)::int;
  v_code := generate_coupon_code('VS');
  insert into coupons (code, user_id, source_order_id, type, value, min_subtotal,
                       max_uses, max_uses_per_user, ends_at, is_active)
  values (
    v_code, v_user, p_order,
    coalesce(v_cfg->>'type', 'percent')::coupon_type_t,
    case when coalesce(v_cfg->>'type', 'percent') = 'percent'
         then least(floor((v_cfg->>'value')::numeric), 100)::int
         else floor((v_cfg->>'value')::numeric)::int end,
    0, v_uses, v_uses,
    now() + make_interval(days => least(greatest(coalesce(
      case when jsonb_typeof(v_cfg->'validDays') = 'number'
           then floor((v_cfg->>'validDays')::numeric) end, 30), 1), 365)::int),
    true
  );
  return v_code;
end $$
;

create or replace function grant_order_spins(p_order uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
declare
  v_user uuid;
  v_base int;
  v_step int;
  v_spins int;
begin
  -- 0189 (task 9.2): 100,000₮ тутамд — QPay-ээр төлсөн дүн (`orders.total`,
  -- хүргэлттэй, купон ба V point хассан). V point-оор төлсөн хэсэг тооцогдохгүй.
  select user_id, greatest(coalesce(total, 0), 0)
    into v_user, v_base from orders where id = p_order;
  if v_user is null then return 0; end if;   -- зочин хүрд эргүүлэхгүй

  select coalesce((value->>'orderSpinStep')::int, 100000) into v_step
    from settings where key = 'spin';
  v_step := coalesce(v_step, 100000);
  if v_step <= 0 then return 0; end if;

  v_spins := v_base / v_step;
  if v_spins <= 0 then return 0; end if;

  insert into spin_wheel_credits (order_id, user_id, spins, base)
    values (p_order, v_user, v_spins, v_base)
    on conflict (order_id) do nothing;
  return v_spins;
end $$
;

revoke all on function grant_order_spins(uuid) from public, anon, authenticated;

------------------------------------------------------------------------------
-- 5. admin_product_options + base_price_by_ml (task 17)
------------------------------------------------------------------------------

-- Буцаах хүснэгтийн хэлбэр өөрчлөгдөх тул drop → create (нэр, параметр,
-- эрх ижил; шинэ багана төгсгөлд — хуучин уншигч үл тоомсорлоно).
drop function if exists admin_product_options(text[], uuid[], int);
create function admin_product_options(
  p_terms text[] default null,
  p_ids uuid[] default null,
  p_limit int default 20
)
returns table (
  id               uuid,
  name             text,
  brand            text,
  is_active        boolean,
  available_ml     int,
  price_by_ml      jsonb,
  base_price_by_ml jsonb
)
language sql
stable
set search_path = public, extensions
as $$
  select
    p.id, p.name, p.brand, p.is_active,
    coalesce(inv.available_ml, 0) as available_ml,
    coalesce((
      select jsonb_object_agg(pv.ml::text, variant_price(pv.*))
        from product_variants pv
       where pv.product_id = p.id and pv.is_active
    ), '{}'::jsonb) as price_by_ml,
    coalesce((
      select jsonb_object_agg(pv.ml::text, pv.price)
        from product_variants pv
       where pv.product_id = p.id and pv.is_active
    ), '{}'::jsonb) as base_price_by_ml
  from products p
  left join inventory inv on inv.product_id = p.id
  where case
          when p_ids is not null and cardinality(p_ids) > 0 then p.id = any (p_ids)
          else p_terms is null or cardinality(p_terms) = 0
               or p.search_text like all (array(select '%' || t || '%' from unnest(p_terms) t))
        end
  order by p.name, p.id
  limit greatest(coalesce(p_limit, 20), 1);
$$;

revoke all on function admin_product_options(text[], uuid[], int) from public;
revoke execute on function admin_product_options(text[], uuid[], int) from anon;
grant execute on function admin_product_options(text[], uuid[], int) to authenticated;
