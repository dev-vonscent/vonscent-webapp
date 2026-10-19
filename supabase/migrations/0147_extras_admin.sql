-- Нэмэлт бараа — админы RPC (extras-shop-plan §7; PR3). Feature flag:
-- `extras_shop` (үлдэгдэлтэй шилний listing), `vial_inventory` (грамын сав).
--
-- Админы бүх бичилт эндээс — нэг transaction, row lock-той:
--   extras_save        — бараа + хувилбарыг үүсгэх/засах (горим бүрийн дүрэм)
--   extras_set_status  — нийтлэх (бэлэн эсэхийг шалгана) / нуух / архивлах
--   extras_set_stock   — энгийн барааны тоо (цонх нээгдсэнээс хойш өөрчлөгдсөн
--                        бол хадгалахгүй — §7.3)
-- Нөөцийн тоо зөвхөн `extra_stock_move`-оор (0145-ийн guard).
--
-- Алдаа нь `raise exception 'CODE[:detail]'` — route нь кодыг монгол
-- мессеж рүү хөрвүүлнэ (src/features/extras/admin-errors.ts).
--
-- Түгжих дараалал (§6.2-той нийцнэ): inventory → extra_products →
-- extra_variants → vials → leftover_liquid_locks. Үлдэгдэлтэй шилний эх
-- үнэртний inventory мөрийг бараанаас ӨМНӨ түгжинэ — захиалгын урсгал
-- (`place_order`) inventory-г мөн түрүүлж түгждэг.
--
-- Захиалга нэмэлт барааг одоохондоо хүлээж авахгүй (place_order хөндөгдөөгүй).

------------------------------------------------------------------------------
-- 1. Үлдэгдэлтэй шилний түгжээний туслах
------------------------------------------------------------------------------

-- Шилийг жагсаалтад оруулах: эх үнэртний декантын нөөцөөс `p_ml` түгжинэ.
-- Хүрэлцэхгүй бол LEFTOVER_STOCK:<боломжтой ml>.
create or replace function leftover_list(p_extra uuid, p_product uuid, p_ml int)
returns void language plpgsql as $$
declare
  v_state text;
  v_avail int;
begin
  if not feature_enabled('extras_shop') then
    raise exception 'FEATURE_DISABLED:extras_shop' using errcode = 'check_violation';
  end if;
  select state into v_state from leftover_liquid_locks
   where extra_product_id = p_extra for update;
  if v_state = 'committed' then
    raise exception 'LEFTOVER_SOLD' using errcode = 'check_violation';
  end if;
  if v_state in ('listed', 'reserved') then
    return;  -- аль хэдийн түгжигдсэн
  end if;
  if not reserve_inventory(p_product, p_ml) then
    select greatest(on_hand_ml - reserved_ml, 0) into v_avail
      from inventory where product_id = p_product;
    raise exception 'LEFTOVER_STOCK:%', coalesce(v_avail, 0)
      using errcode = 'check_violation';
  end if;
  insert into leftover_liquid_locks (extra_product_id, locked_ml, state)
  values (p_extra, p_ml, 'listed')
  on conflict (extra_product_id) do update
    set locked_ml = excluded.locked_ml, state = 'listed', order_item_id = null;
end $$;

-- Жагсаалтаас гаргах: түгжсэн ml-ийг декантад буцаана.
create or replace function leftover_unlist(p_extra uuid, p_product uuid)
returns void language plpgsql as $$
declare
  v_lock leftover_liquid_locks;
begin
  select * into v_lock from leftover_liquid_locks
   where extra_product_id = p_extra for update;
  if not found or v_lock.state in ('released', 'committed') then
    return;
  end if;
  if v_lock.state = 'reserved' then
    raise exception 'LEFTOVER_IN_ORDER' using errcode = 'check_violation';
  end if;
  perform release_inventory(p_product, v_lock.locked_ml);
  update leftover_liquid_locks set state = 'released'
   where extra_product_id = p_extra;
end $$;

------------------------------------------------------------------------------
-- 2. extras_save
--
-- p_payload:
--   { id?, category_id (шинэд), slug, name, description, images[], attrs{},
--     sort,
--     leftover?: { product_id, remaining_ml, full_ml },
--     variants: [{ id?, label, price, is_active, sort, vial_id?, initial_qty? }] }
--
-- Жагсаалтад байхгүй хуучин хувилбар устахгүй, идэвхгүй болно.
-- `initial_qty` нь ЗӨВХӨН шинэ энгийн хувилбарт — дараагийн өөрчлөлт
-- `extras_set_stock`-оор (зөрчлийн шалгалттай).
------------------------------------------------------------------------------

create or replace function extras_save(p_payload jsonb, p_by uuid)
returns jsonb language plpgsql as $$
declare
  v_id uuid := nullif(p_payload->>'id', '')::uuid;
  v_cat uuid := nullif(p_payload->>'category_id', '')::uuid;
  v_mode extra_inventory_mode_t;
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
  v_qty int;
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
    select inventory_mode into v_mode from extra_categories
     where id = v_cat and is_active;
    if not found then
      raise exception 'CATEGORY_NOT_FOUND' using errcode = 'check_violation';
    end if;
  end if;

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
    insert into extra_products (category_id, slug, name, description, images,
      attrs, sort, product_id, remaining_ml, full_ml)
    values (
      v_cat,
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
      if not found or v_vial.ml = 1 then
        raise exception 'VIAL_INVALID' using errcode = 'check_violation';
      end if;
      -- Тоо оруулаагүй савыг тусад нь зарахгүй (§7.2).
      if v_vial.on_hand is null then
        raise exception 'VIAL_NOT_COUNTED:%', v_vial.id using errcode = 'check_violation';
      end if;
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
      insert into extra_variants (extra_id, label, price, vial_id, is_active, sort)
      values (
        v_id,
        case when v_mode = 'local_quantity' then btrim(coalesce(v_var->>'label', '')) else '' end,
        (v_var->>'price')::int,
        case when v_mode = 'shared_vial' then v_vial.id end,
        coalesce((v_var->>'is_active')::boolean, true),
        coalesce((v_var->>'sort')::int, 0)
      )
      returning id into v_var_id;
      v_qty := case
        when v_mode = 'local_quantity' then greatest(coalesce((v_var->>'initial_qty')::int, 0), 0)
        when v_mode = 'leftover_liquid' then 1
        else 0 end;
      if v_qty > 0 then
        perform extra_stock_move(v_var_id, 'set', v_qty, 0, null, null,
          'Анхны тоо', p_by);
      end if;
    else
      update extra_variants set
        label = case when v_mode = 'local_quantity'
                     then btrim(coalesce(v_var->>'label', '')) else label end,
        price = (v_var->>'price')::int,
        is_active = coalesce((v_var->>'is_active')::boolean, true),
        sort = coalesce((v_var->>'sort')::int, sort)
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

------------------------------------------------------------------------------
-- 3. Нийтлэх бэлэн эсэх (§7.2) — форм ч мөн адил жагсаалт харуулна.
------------------------------------------------------------------------------

create or replace function extras_readiness(p_extra uuid)
returns text[] language sql stable as $$
  with p as (select * from extra_products where id = p_extra),
  v as (select ev.*, vl.on_hand as vial_on_hand
          from extra_variants ev
          left join vials vl on vl.id = ev.vial_id
         where ev.extra_id = p_extra and ev.is_active)
  select coalesce(array_agg(code order by code), '{}') from (
    select 'NO_VARIANT' as code where not exists (select 1 from v)
    union all
    select 'PRICE_MISSING' where exists (select 1 from v where price <= 0)
    union all
    select 'VIAL_NOT_COUNTED' from p
     where p.inventory_mode = 'shared_vial'
       and exists (select 1 from v where vial_on_hand is null)
    union all
    select 'VIAL_FLAG_OFF' from p
     where p.inventory_mode = 'shared_vial' and not feature_enabled('vial_inventory')
    union all
    select 'LEFTOVER_SOLD' from p
     where p.inventory_mode = 'leftover_liquid'
       and exists (select 1 from leftover_liquid_locks l
                    where l.extra_product_id = p.id and l.state = 'committed')
  ) c;
$$;

-- Админы жагсаалт: бараа бүрийн дутуу зүйл НЭГ дуудлагаар. Ажилтан биш бол
-- хоосон (сессийн client-ээр уншдаг тул security definer + is_staff()).
create or replace function extras_readiness_all()
returns table (extra_id uuid, missing text[])
language sql stable security definer set search_path = public as $$
  select p.id, extras_readiness(p.id) from extra_products p where is_staff();
$$;

revoke all on function extras_readiness_all() from public, anon;
grant execute on function extras_readiness_all() to authenticated, service_role;

------------------------------------------------------------------------------
-- 4. extras_set_status
------------------------------------------------------------------------------

create or replace function extras_set_status(p_extra uuid, p_status text, p_by uuid)
returns jsonb language plpgsql as $$
declare
  v_row extra_products;
  v_missing text[];
begin
  if p_status not in ('draft', 'published', 'archived') then
    raise exception 'VALIDATION' using errcode = 'check_violation';
  end if;
  select * into v_row from extra_products where id = p_extra;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'check_violation';
  end if;
  if v_row.inventory_mode = 'leftover_liquid' then
    perform 1 from inventory where product_id = v_row.product_id for update;
  end if;
  select * into v_row from extra_products where id = p_extra for update;
  if v_row.status = p_status then
    return jsonb_build_object('ok', true, 'status', p_status);
  end if;

  if p_status = 'published' then
    v_missing := extras_readiness(p_extra);
    if cardinality(v_missing) > 0 then
      return jsonb_build_object('ok', false, 'missing', to_jsonb(v_missing));
    end if;
    if v_row.inventory_mode = 'leftover_liquid' then
      perform leftover_list(p_extra, v_row.product_id, v_row.remaining_ml);
    end if;
  elsif v_row.inventory_mode = 'leftover_liquid' then
    perform leftover_unlist(p_extra, v_row.product_id);
  end if;

  update extra_products set status = p_status where id = p_extra;
  return jsonb_build_object('ok', true, 'status', p_status);
end $$;

------------------------------------------------------------------------------
-- 5. extras_set_stock — энгийн барааны «Одоо байгаа тоо» (§7.3)
------------------------------------------------------------------------------

create or replace function extras_set_stock(
  p_variant uuid,
  p_on_hand int,
  p_expected_updated_at timestamptz,
  p_note text,
  p_by uuid
)
returns jsonb language plpgsql as $$
declare
  v extra_variants;
begin
  select * into v from extra_variants where id = p_variant for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'check_violation';
  end if;
  if v.inventory_mode <> 'local_quantity' then
    raise exception 'STOCK_NOT_LOCAL' using errcode = 'check_violation';
  end if;
  -- Цонх нээгдсэнээс хойш захиалга орж/гарсан бол чимээгүй дарж бичихгүй.
  -- Миллисекундээр: браузарын `Date` микросекундийг тайрдаг.
  if date_trunc('milliseconds', p_expected_updated_at)
       is distinct from date_trunc('milliseconds', v.updated_at) then
    return jsonb_build_object('ok', false, 'reason', 'STALE',
      'on_hand', v.on_hand_qty, 'reserved', v.reserved_qty,
      'updated_at', v.updated_at);
  end if;
  if p_on_hand < v.reserved_qty then
    return jsonb_build_object('ok', false, 'reason', 'BELOW_RESERVED',
      'on_hand', v.on_hand_qty, 'reserved', v.reserved_qty,
      'updated_at', v.updated_at);
  end if;
  if p_on_hand <> v.on_hand_qty then
    perform extra_stock_move(p_variant, 'set', p_on_hand - v.on_hand_qty, 0,
      null, null, coalesce(p_note, ''), p_by);
  end if;
  select * into v from extra_variants where id = p_variant;
  return jsonb_build_object('ok', true, 'on_hand', v.on_hand_qty,
    'reserved', v.reserved_qty, 'updated_at', v.updated_at);
end $$;

------------------------------------------------------------------------------
-- 6. Эрх — зөвхөн service role (админы route handler эрхийг шалгана)
------------------------------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'leftover_list(uuid, uuid, int)',
    'leftover_unlist(uuid, uuid)',
    'extras_save(jsonb, uuid)',
    'extras_readiness(uuid)',
    'extras_set_status(uuid, text, uuid)',
    'extras_set_stock(uuid, int, timestamptz, text, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
