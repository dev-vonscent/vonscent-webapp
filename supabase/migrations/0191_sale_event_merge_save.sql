-- PR #289-ийн засвар (task 16.7, локал туршилт):
--
-- 1. Чимээгүй хасагдах. `save_sale_event` гишүүдийг delete → insert-ээр
--    БҮРЭН сольдог байв. Студи хадгалсны дараа `router.refresh()` хийдэггүй
--    бөгөөд Next-ийн client router cache (`staleTimes.dynamic: 30`, back/
--    forward үргэлж кэшээс) хуучин мөрөөр студийг дахин нээж болдог тул
--    хуучин snapshot-оос хадгалахад админы харж байгаагүй бараа / багц
--    (жишээ «LADIES NIGHT») устдаг байв. Одоо `removedProductIds` /
--    `removedCollectionIds` түлхүүр ирвэл (шинэ клиент) merge горим: зөвхөн
--    админы ИЛЭРХИЙ хассан id устана, илгээсэн мөр upsert, бусад нь хэвээр.
--    Түлхүүргүй (хуучин клиент) бол өмнөх бүрэн солих зан төлөв.
-- 2. `BUNDLE_UNAVAILABLE`: ШИНЭЭР нэмэгдэж буй багц идэвхтэй, дор хаяж нэг
--    хэмжээгээр бүтэн зарагдаж байх (`collection_sellable`). Аль хэдийн
--    event-д байгаа багц дараа нь дууссан/идэвхгүй болсон ч хадгалагдана.
--
-- Туг: `sale_events` (бараа), `sale_event_bundles` (багц) — шалгалтууд
-- өмнөх шигээ. Expand only: шинэ функц, функцийн бие, шинэ түлхүүр.

------------------------------------------------------------------------------
-- 1. Багц одоо худалдаж авах боломжтой эсэх — TS `build()`-ийн
--    `availableMls` (бүх гишүүн идэвхтэй, тэр хэмжээ идэвхтэй ба
--    `variant_sellable`)-тай ижил дүрэм.
------------------------------------------------------------------------------

create or replace function collection_sellable(p_collection uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select c.is_active
     and exists (select 1 from collection_items ci where ci.collection_id = c.id)
     and exists (
       select 1 from unnest(array[2, 5, 10, 20]) as s(ml)
        where not exists (
          select 1
            from collection_items ci
            join products p on p.id = ci.product_id
            left join inventory inv on inv.product_id = p.id
            left join product_variants pv
              on pv.product_id = p.id and pv.ml = s.ml and pv.is_active
           where ci.collection_id = c.id
             and (not p.is_active
                  or pv.id is null
                  or not variant_sellable(pv.*, p.gender, inv.is_sold_out,
                                          inv.available_ml))))
    from collections c
   where c.id = p_collection;
$$;

revoke all on function collection_sellable(uuid) from public, anon, authenticated;
grant execute on function collection_sellable(uuid) to service_role;

------------------------------------------------------------------------------
-- 2. save_sale_event — 0190-ийн бие + merge горим + BUNDLE_UNAVAILABLE
------------------------------------------------------------------------------

create or replace function save_sale_event(
  p_id uuid,
  p_data jsonb,
  p_items jsonb,
  p_user uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := p_id;
  v_ended boolean;
  v_bundles boolean := p_data ? 'collections';
  -- 0191: хасах нь зөвхөн админы ИЛЭРХИЙ хассан id-аар (merge горим).
  v_merge_products boolean := p_data ? 'removedProductIds';
  v_merge_bundles boolean := p_data ? 'removedCollectionIds';
  v_bad jsonb;
begin
  if not feature_enabled('sale_events') then
    raise exception 'FEATURE_DISABLED';
  end if;
  -- Туг хаалттай үед багцын бичилт огт болохгүй (prod-д юу ч хуримтлагдахгүй).
  if v_bundles and not feature_enabled('sale_event_bundles') then
    raise exception 'FEATURE_DISABLED';
  end if;

  if v_bundles then
    if jsonb_typeof(p_data->'collections') <> 'array' then
      raise exception 'BUNDLE_INVALID';
    end if;
    -- Зөвхөн бэлэн багц.
    select jsonb_agg(x->>'collectionId') into v_bad
      from jsonb_array_elements(p_data->'collections') x
     where not exists (
       select 1 from collections c
        where c.id = (x->>'collectionId')::uuid and c.type = 'base');
    if v_bad is not null then
      raise exception 'BUNDLE_NOT_FOUND' using detail = v_bad::text;
    end if;
    -- 0191: ШИНЭЭР нэмэгдэж буй багц идэвхтэй, дор хаяж нэг хэмжээгээр
    -- зарагдаж байх ёстой. Аль хэдийн энэ event-д байгаа (дараа нь дууссан /
    -- идэвхгүй болсон) багцыг хадгалахаас татгалзахгүй.
    select jsonb_agg(jsonb_build_object(
             'collectionId', c.id, 'collection', c.name,
             'reason', case when c.is_active then 'sold_out' else 'inactive' end)
           order by c.name)
      into v_bad
      from jsonb_array_elements(p_data->'collections') x
      join collections c on c.id = (x->>'collectionId')::uuid
     where not exists (
             select 1 from sale_event_collections sc
              where sc.event_id = v_id and sc.collection_id = c.id)
       and not collection_sellable(c.id);
    if v_bad is not null then
      raise exception 'BUNDLE_UNAVAILABLE' using detail = v_bad::text;
    end if;
    -- 16.5: 4 хэмжээ бүгд хувьгүй багц хадгалагдахгүй.
    select jsonb_agg(c.name order by c.name) into v_bad
      from jsonb_array_elements(p_data->'collections') x
      join collections c on c.id = (x->>'collectionId')::uuid
     where not exists (
       select 1 from jsonb_each_text(coalesce(x->'pcts', '{}'::jsonb)) pc
        where pc.value is not null and pc.value <> '');
    if v_bad is not null then
      raise exception 'BUNDLE_NO_PCT' using detail = v_bad::text;
    end if;
    -- Event хувь > одоогийн суурь хувь (орлох тул бага бол багц үнэтэй болно).
    select jsonb_agg(jsonb_build_object(
             'collectionId', c.id, 'collection', c.name, 'ml', pc.key::int,
             'pct', pc.value::numeric, 'basePct', collection_base_pct(c.id, pc.key::int))
           order by c.name, pc.key::int)
      into v_bad
      from jsonb_array_elements(p_data->'collections') x
      join collections c on c.id = (x->>'collectionId')::uuid
      cross join lateral jsonb_each_text(coalesce(x->'pcts', '{}'::jsonb)) pc
     where pc.value is not null and pc.value <> ''
       and pc.value::numeric <= collection_base_pct(c.id, pc.key::int);
    if v_bad is not null then
      raise exception 'BUNDLE_PCT_LOW' using detail = v_bad::text;
    end if;
  end if;

  if v_id is not null then
    select is_active and ends_at <= now()
      into v_ended
      from sale_events
     where id = v_id
       for update;
    if not found then
      raise exception 'NOT_FOUND';
    end if;
    if v_ended then
      raise exception 'EVENT_ENDED';
    end if;
  end if;

  update sale_events o
     set slug = left(o.slug, 50) || '-'
                || to_char(o.starts_at at time zone 'Asia/Ulaanbaatar', 'YYYY')
                || case when exists (
                     select 1 from sale_events z
                      where z.slug = left(o.slug, 50) || '-'
                            || to_char(o.starts_at at time zone 'Asia/Ulaanbaatar', 'YYYY'))
                   then '-' || left(o.id::text, 4) else '' end
   where o.slug = p_data->>'slug'
     and o.id is distinct from v_id
     and o.is_active
     and o.ends_at <= now();

  if v_id is null then
    insert into sale_events (slug, name, badge_label, headline, description,
                             starts_at, ends_at, is_active, show_countdown,
                             ticker_theme, created_by)
    values (p_data->>'slug', p_data->>'name',
            nullif(btrim(p_data->>'badgeLabel'), ''),
            nullif(btrim(p_data->>'headline'), ''),
            nullif(btrim(p_data->>'description'), ''),
            (p_data->>'startsAt')::timestamptz,
            (p_data->>'endsAt')::timestamptz,
            coalesce((p_data->>'isActive')::boolean, false),
            coalesce((p_data->>'showCountdown')::boolean, true),
            nullif(p_data->>'tickerTheme', ''),
            p_user)
    returning id into v_id;
  else
    update sale_events
       set slug = p_data->>'slug',
           name = p_data->>'name',
           badge_label = nullif(btrim(p_data->>'badgeLabel'), ''),
           headline = nullif(btrim(p_data->>'headline'), ''),
           description = nullif(btrim(p_data->>'description'), ''),
           starts_at = (p_data->>'startsAt')::timestamptz,
           ends_at = (p_data->>'endsAt')::timestamptz,
           is_active = coalesce((p_data->>'isActive')::boolean, false),
           show_countdown = coalesce((p_data->>'showCountdown')::boolean, true),
           ticker_theme = case when p_data ? 'tickerTheme'
                               then nullif(p_data->>'tickerTheme', '')
                               else ticker_theme end
     where id = v_id;
  end if;

  if v_merge_products then
    -- 0191: client-д харагдаагүй (хуучин snapshot) бараа устахгүй — зөвхөн
    -- админы хассан id + илгээсэн барааны хувь шинэчлэгдэнэ.
    delete from sale_event_products
     where event_id = v_id
       and product_id in (
         select x::uuid from jsonb_array_elements_text(
           coalesce(p_data->'removedProductIds', '[]'::jsonb)) x);
    delete from sale_event_discounts
     where event_id = v_id
       and product_id in (
         select (it.x->>'productId')::uuid
           from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as it(x));
    insert into sale_event_products (event_id, product_id, sort_order)
    select v_id, (it.x->>'productId')::uuid, it.ord::int
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
           with ordinality as it(x, ord)
    on conflict (event_id, product_id) do update set sort_order = excluded.sort_order;
  else
    delete from sale_event_products where event_id = v_id;

    insert into sale_event_products (event_id, product_id, sort_order)
    select v_id, (it.x->>'productId')::uuid, it.ord::int
      from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
           with ordinality as it(x, ord);
  end if;

  insert into sale_event_discounts (event_id, product_id, ml, pct)
  select v_id, (it.x->>'productId')::uuid, pc.key::int, pc.value::numeric::smallint
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as it(x)
    cross join lateral jsonb_each_text(coalesce(it.x->'pcts', '{}'::jsonb)) pc
   where pc.value is not null and pc.value <> '';

  if v_bundles and v_merge_bundles then
    -- 0191: багц хасагдах цорын ганц зам — админы хассан id.
    delete from sale_event_collections
     where event_id = v_id
       and collection_id in (
         select x::uuid from jsonb_array_elements_text(
           coalesce(p_data->'removedCollectionIds', '[]'::jsonb)) x);
    delete from sale_event_collection_discounts
     where event_id = v_id
       and collection_id in (
         select (it.x->>'collectionId')::uuid
           from jsonb_array_elements(p_data->'collections') as it(x));
    insert into sale_event_collections (event_id, collection_id, sort_order)
    select v_id, (it.x->>'collectionId')::uuid, it.ord::int
      from jsonb_array_elements(p_data->'collections') with ordinality as it(x, ord)
    on conflict (event_id, collection_id) do update set sort_order = excluded.sort_order;
  elsif v_bundles then
    delete from sale_event_collections where event_id = v_id;

    insert into sale_event_collections (event_id, collection_id, sort_order)
    select v_id, (it.x->>'collectionId')::uuid, it.ord::int
      from jsonb_array_elements(p_data->'collections') with ordinality as it(x, ord);
  end if;

  if v_bundles then

    insert into sale_event_collection_discounts (event_id, collection_id, ml, pct)
    select v_id, (it.x->>'collectionId')::uuid, pc.key::int,
           pc.value::numeric::smallint
      from jsonb_array_elements(p_data->'collections') as it(x)
      cross join lateral jsonb_each_text(coalesce(it.x->'pcts', '{}'::jsonb)) pc
     where pc.value is not null and pc.value <> '';
  end if;

  set constraints sale_events_no_overlap, sale_event_products_no_overlap,
                  sale_event_collections_no_overlap immediate;

  return v_id;
end;
$$;

revoke all on function save_sale_event(uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function save_sale_event(uuid, jsonb, jsonb, uuid) to service_role;
