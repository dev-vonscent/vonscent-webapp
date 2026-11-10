-- Шинэ хувилбарын «Эхний нөөц» — хадгалахтай нэг дор (extras-shop-plan §18.4).
-- Feature flag: `extras_shop` (нэмэлт барааны админ туг хаалттай үед ажиллахгүй).
--
-- Өмнө нь шинэ хувилбарын нөөцийг хадгалсны дараа «Нөөц нөхөх»-өөр л
-- оруулдаг байв: худалдан авалт хувилбарын id-тай холбогддог, тэр id
-- хадгалахаас өмнө байхгүй. Одоо `variants[].initial_purchase`
-- { qty, unit_cost, purchased_on } ирвэл `extras_save` хувилбарыг үүсгэсэн
-- даруйд ижил transaction-д `purchase` хөдөлгөөн бичнэ — шалгалт нь
-- `extras_purchase`-тай ижил (purchase_args_check, purchase_date_check).
-- Зөвхөн ШИНЭ мөрөнд; хадгалсан мөрөнд ирвэл INITIAL_PURCHASE_NEW_ONLY.
--
-- 0153-ын биеийг хуулсан; өөрчлөлт нь дээрх хоёр блок л. Signature,
-- эрх хэвээр. Нэмэлт барааны хүснэгт prod-д 0145-аас хойш шинэ тул хуучин
-- prod код энэ функцийг дууддаггүй.

create or replace function extras_save(p_payload jsonb, p_by uuid)
returns jsonb language plpgsql as $$
declare
  v_id uuid := nullif(p_payload->>'id', '')::uuid;
  v_cat uuid := nullif(p_payload->>'category_id', '')::uuid;
  v_req_mode text := nullif(p_payload->>'inventory_mode', '');
  v_mode extra_inventory_mode_t;
  v_modes extra_inventory_mode_t[];
  v_row extra_products;
  v_slug text := nullif(btrim(coalesce(p_payload->>'slug', '')), '');
  v_left jsonb := p_payload->'leftover';
  v_new_product uuid;
  v_new_remaining int;
  v_new_full int;
  v_lock_state text;
  v_var jsonb;
  v_var_id uuid;
  v_vial vials;
  v_keep uuid[] := '{}';
  v_local boolean;
  v_n int;
begin
  if v_id is not null then
    -- Үлдэгдэлтэй шилний эх үнэртний inventory-г бараанаас өмнө түгжинэ.
    select * into v_row from extra_products where id = v_id;
    if not found then
      raise exception 'NOT_FOUND' using errcode = 'check_violation';
    end if;
    if v_row.inventory_mode = 'leftover_liquid' then
      perform 1 from inventory
        where product_id in (v_row.product_id,
                             nullif(v_left->>'product_id', '')::uuid)
        order by product_id
        for update;
    end if;
    select * into v_row from extra_products where id = v_id for update;
    v_mode := v_row.inventory_mode;
  else
    select array_agg(m.inventory_mode) into v_modes
      from extra_category_modes m
      join extra_categories c on c.id = m.category_id and c.is_active
     where m.category_id = v_cat;
    if v_modes is null then
      raise exception 'CATEGORY_NOT_FOUND' using errcode = 'check_violation';
    end if;
    if v_req_mode is not null then
      if not (v_req_mode::extra_inventory_mode_t = any (v_modes)) then
        raise exception 'EXTRA_MODE_INVALID' using errcode = 'check_violation';
      end if;
      v_mode := v_req_mode::extra_inventory_mode_t;
    elsif cardinality(v_modes) = 1 then
      v_mode := v_modes[1];
    else
      raise exception 'EXTRA_MODE_REQUIRED' using errcode = 'check_violation';
    end if;
  end if;
  v_local := v_mode = 'local_quantity';

  if v_mode = 'shared_vial' and not feature_enabled('vial_inventory') then
    raise exception 'FEATURE_DISABLED:vial_inventory' using errcode = 'check_violation';
  end if;

  -- Slug давхардвал богино дагавар залгана (нэр ижил хоёр бараа байж болно).
  if v_slug is not null and exists (
       select 1 from extra_products where slug = v_slug
          and id is distinct from v_id) then
    v_slug := v_slug || '-' || substr(md5(gen_random_uuid()::text), 1, 4);
  end if;

  if v_mode = 'leftover_liquid' then
    v_new_product := nullif(v_left->>'product_id', '')::uuid;
    v_new_remaining := (v_left->>'remaining_ml')::int;
    v_new_full := (v_left->>'full_ml')::int;
    if v_new_product is null or v_new_remaining is null or v_new_full is null
       or v_new_remaining <= 0 or v_new_remaining > v_new_full then
      raise exception 'LEFTOVER_INVALID' using errcode = 'check_violation';
    end if;
    perform 1 from products where id = v_new_product;
    if not found then
      raise exception 'LEFTOVER_INVALID' using errcode = 'check_violation';
    end if;
  end if;

  if v_id is null then
    insert into extra_products (category_id, inventory_mode, slug, name,
      description, images, attrs, sort, product_id, remaining_ml, full_ml)
    values (
      v_cat,
      v_mode,
      coalesce(v_slug, 'extra-' || substr(md5(gen_random_uuid()::text), 1, 8)),
      btrim(p_payload->>'name'),
      coalesce(p_payload->>'description', ''),
      coalesce(array(select jsonb_array_elements_text(p_payload->'images')), '{}'),
      coalesce(p_payload->'attrs', '{}'::jsonb),
      coalesce((p_payload->>'sort')::int, 0),
      v_new_product, v_new_remaining, v_new_full
    )
    returning * into v_row;
    v_id := v_row.id;
  else
    if v_mode = 'leftover_liquid' then
      select state into v_lock_state from leftover_liquid_locks
       where extra_product_id = v_id;
      if (v_new_product, v_new_remaining, v_new_full)
           is distinct from (v_row.product_id, v_row.remaining_ml, v_row.full_ml) then
        -- Захиалгад орсон / зарагдсан шилийг засахгүй (§5.5).
        if v_lock_state = 'reserved' then
          raise exception 'LEFTOVER_IN_ORDER' using errcode = 'check_violation';
        end if;
        if v_lock_state = 'committed' then
          raise exception 'LEFTOVER_SOLD' using errcode = 'check_violation';
        end if;
        -- Жагсаалтад байгаа бол түгжээг шинэ хэмжээгээр солино: суллаад
        -- дахин түгжинэ — сольж болох дээд хэмжээ = боломжтой + хуучин locked.
        if v_lock_state = 'listed' then
          perform leftover_unlist(v_id, v_row.product_id);
          perform leftover_list(v_id, v_new_product, v_new_remaining);
        end if;
      end if;
    end if;
    update extra_products set
      slug = coalesce(v_slug, slug),
      name = btrim(p_payload->>'name'),
      description = coalesce(p_payload->>'description', ''),
      images = coalesce(array(select jsonb_array_elements_text(p_payload->'images')), '{}'),
      attrs = coalesce(p_payload->'attrs', '{}'::jsonb),
      sort = coalesce((p_payload->>'sort')::int, sort),
      product_id = v_new_product,
      remaining_ml = v_new_remaining,
      full_ml = v_new_full
    where id = v_id
    returning * into v_row;
  end if;

  -- ── Хувилбарууд ────────────────────────────────────────────────────
  -- Нэг савыг хоёр удаа сонгосон payload — доорх хайлт хоёуланг нь нэг мөр
  -- рүү буулгаж чимээгүй нийлүүлэх байсан.
  if v_mode = 'shared_vial' and exists (
       select 1 from jsonb_array_elements(coalesce(p_payload->'variants', '[]')) e
        group by e->>'vial_id' having count(*) > 1) then
    raise exception 'VIAL_DUPLICATE' using errcode = 'check_violation';
  end if;
  if v_mode = 'leftover_liquid'
     and jsonb_array_length(coalesce(p_payload->'variants', '[]')) <> 1 then
    raise exception 'LEFTOVER_ONE_VARIANT' using errcode = 'check_violation';
  end if;

  for v_var in select * from jsonb_array_elements(coalesce(p_payload->'variants', '[]'))
  loop
    v_var_id := nullif(v_var->>'id', '')::uuid;
    if v_mode = 'shared_vial' then
      select * into v_vial from vials where id = nullif(v_var->>'vial_id', '')::uuid;
      -- Дангаар зөвхөн 5/10/20ml (§18.1 №2).
      if not found or v_vial.ml not in (5, 10, 20) then
        raise exception 'VIAL_INVALID' using errcode = 'check_violation';
      end if;
      -- Тоо оруулаагүй савыг тусад нь зарахгүй (§7.2).
      if v_vial.on_hand is null then
        raise exception 'VIAL_NOT_COUNTED:%', v_vial.id using errcode = 'check_violation';
      end if;
    end if;
    -- Нөөц зөвхөн «Нөөц нөхөх»-өөр (purchase) — өртөггүй анхны тоо байхгүй.
    if coalesce((v_var->>'initial_qty')::int, 0) > 0 then
      raise exception 'INITIAL_STOCK_REQUIRES_PURCHASE' using errcode = 'check_violation';
    end if;

    if v_var_id is null and v_mode = 'shared_vial' then
      -- Нэг савыг дахин сонгосон бол хуучин (идэвхгүй болсон) мөрийг сэргээнэ.
      select id into v_var_id from extra_variants
       where extra_id = v_id and vial_id = v_vial.id;
    end if;
    if v_var_id is null and v_mode = 'leftover_liquid' then
      select id into v_var_id from extra_variants where extra_id = v_id;
    end if;

    if v_var_id is null then
      insert into extra_variants (extra_id, label, price, vial_id, is_active, sort,
        batch_code, image_url, size_note)
      values (
        v_id,
        case when v_local then btrim(coalesce(v_var->>'label', '')) else '' end,
        (v_var->>'price')::int,
        case when v_mode = 'shared_vial' then v_vial.id end,
        coalesce((v_var->>'is_active')::boolean, true),
        coalesce((v_var->>'sort')::int, 0),
        case when v_local then nullif(btrim(coalesce(v_var->>'batch_code', '')), '') end,
        nullif(btrim(coalesce(v_var->>'image_url', '')), ''),
        case when v_local then nullif(btrim(coalesce(v_var->>'size_note', '')), '') end
      )
      returning id into v_var_id;
      -- Шинэ хувилбарын эхний нөөц (0158) — хадгалалттай НЭГ transaction-д,
      -- «Нөөц нөхөх»-тэй ижил худалдан авалт (үнэ, огноотой → тайланд
      -- зарлага). Хадгалалт бүтэлгүйтвэл нөөц ч орохгүй.
      if v_local and jsonb_typeof(v_var->'initial_purchase') = 'object' then
        perform purchase_args_check(
          (v_var#>>'{initial_purchase,qty}')::int,
          (v_var#>>'{initial_purchase,unit_cost}')::int);
        perform extra_stock_move(v_var_id, 'purchase',
          (v_var#>>'{initial_purchase,qty}')::int, 0, null, null,
          'Эхний нөөц', p_by,
          (v_var#>>'{initial_purchase,unit_cost}')::int,
          purchase_date_check((v_var#>>'{initial_purchase,purchased_on}')::date));
      end if;
      -- Үлдэгдэлтэй шил = нэг физик шил. Шингэний өртөг эх савны худалдан
      -- авалтаар аль хэдийн зарлага болсон тул энд өртөггүй (§18.2).
      if v_mode = 'leftover_liquid' then
        perform extra_stock_move(v_var_id, 'set', 1, 0, null, null,
          'Анхны тоо', p_by);
      end if;
    else
      if jsonb_typeof(v_var->'initial_purchase') = 'object' then
        -- Хадгалсан хувилбарын нөөц «Нөөц нөхөх»-өөр (зөрчил шалгалттай).
        raise exception 'INITIAL_PURCHASE_NEW_ONLY' using errcode = 'check_violation';
      end if;
      update extra_variants set
        label = case when v_local
                     then btrim(coalesce(v_var->>'label', '')) else label end,
        price = (v_var->>'price')::int,
        is_active = coalesce((v_var->>'is_active')::boolean, true),
        sort = coalesce((v_var->>'sort')::int, sort),
        -- Түлхүүр ирсэн үед л солино — эдгээрийг мэдэхгүй маягт (хуучин
        -- client, хуулбар) хадгалахад чимээгүй арчигдахгүй.
        batch_code = case when v_local and v_var ? 'batch_code'
                          then nullif(btrim(coalesce(v_var->>'batch_code', '')), '')
                          else batch_code end,
        image_url = case when v_var ? 'image_url'
                         then nullif(btrim(coalesce(v_var->>'image_url', '')), '')
                         else image_url end,
        size_note = case when v_local and v_var ? 'size_note'
                         then nullif(btrim(coalesce(v_var->>'size_note', '')), '')
                         else size_note end
      where id = v_var_id and extra_id = v_id;
      get diagnostics v_n = row_count;
      if v_n = 0 then
        raise exception 'VARIANT_NOT_FOUND' using errcode = 'check_violation';
      end if;
    end if;
    v_keep := v_keep || v_var_id;
  end loop;

  update extra_variants set is_active = false
   where extra_id = v_id and is_active and not (id = any (v_keep));

  return jsonb_build_object('ok', true, 'id', v_id, 'slug', v_row.slug);
end $$;
