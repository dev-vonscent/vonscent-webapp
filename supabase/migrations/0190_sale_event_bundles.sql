-- Бэлэн багцыг арга хэмжээнд оруулах (task 16.7; 8.1 «Black Friday зэрэг
-- урамшуулалд багцыг оруулах»). Feature flag `sale_event_bundles` (мөн
-- `sale_events` нээлттэй байх ёстой).
--
-- Загвар (`variant_price`-ийн 0181 загвар): event-ийн хувь багцын хадгалсан
-- хувийг ДАРЖ БИЧИХГҮЙ — LIVE үед тооцоологдоно. Event дуусахад мөр нь
-- `live_event_collection_discounts()`-ээс алга болж, багц өмнөх хувь руугаа
-- өөрөө буцна (буцаах cron / бичилт байхгүй).
--   · Event-ийн хувь багцын суурь хувийг ОРЛОНО (нэмэгдэхгүй): 100,000₮,
--     суурь 5% → 95,000₮, Black Friday 10% → 90,000₮.
--   · Хамгаалалт: ажиллах үед `greatest(суурь, event)` — суурь хувийг админ
--     дараа нь өсгөсөн ч арга хэмжээний үеэр багц хэзээ ч үнэтэй болохгүй.
--     Хадгалах үед event хувь > одоогийн суурь хувь байхыг шаардана.
--   · Багцын үнийг TS (`priceCollectionLines`, route handler) боддог хэвээр;
--     SQL зөвхөн задаргааг (`order_apply_price_breakdown`) ижил томьёогоор
--     (`collection_bundle_price`, float8 — JS-ийн `bundlePrice`-тэй бит
--     бүрээр ижил) хувааж бичнэ: суурь хэсэг «Багцын хямдрал», нэмэлт хэсэг
--     «<Event нэр>» мөр (барааны ижил event-ийн мөртэй нийлнэ).
--
-- 16.3: багц нь БАРААНЫ ижил дүрмээр түгжигдэнэ — нийтэлсэн (is_active)
-- хоёр арга хэмжээний хугацаа давхцвал нэг багц хоёуланд орохгүй; ноорог
-- түгжихгүй (deferred constraint trigger, 0181 §3-ын толь).
-- 16.5: 4 хэмжээ бүгд хувьгүй багцыг хадгалахгүй.
--
-- Туг хаалттай: `live_event_collection_discounts` хоосон → үнэ, каталог,
-- задаргаа хөндөгдөхгүй; `save_sale_event` `collections` түлхүүртэй ирвэл
-- FEATURE_DISABLED → санд юу ч бичигдэхгүй.
--
-- Expand only: шинэ хүснэгт, шинэ функц, функцийн бие. Хуучин код
-- `collections` түлхүүр илгээдэггүй → багцын мөрүүд хөндөгдөхгүй.

insert into feature_flags (key) values ('sale_event_bundles') on conflict do nothing;

------------------------------------------------------------------------------
-- 1. Хүснэгтүүд
------------------------------------------------------------------------------

create table if not exists sale_event_collections (
  event_id      uuid not null references sale_events(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  sort_order    int not null default 0,
  primary key (event_id, collection_id)
);

create index if not exists sale_event_collections_collection_idx
  on sale_event_collections (collection_id);

-- Багц × хэмжээ бүрийн event хувь. Мөргүй хэмжээ = тэр хэмжээнд багцын
-- суурь хувь хэвээр.
create table if not exists sale_event_collection_discounts (
  event_id      uuid not null,
  collection_id uuid not null,
  ml            int not null check (ml in (2, 5, 10, 20)),
  pct           smallint not null check (pct between 1 and 90),
  primary key (event_id, collection_id, ml),
  foreign key (event_id, collection_id)
    references sale_event_collections (event_id, collection_id) on delete cascade
);

create index if not exists sale_event_collection_discounts_collection_idx
  on sale_event_collection_discounts (collection_id, ml);

alter table sale_event_collections enable row level security;
drop policy if exists "sale event collections staff read" on sale_event_collections;
create policy "sale event collections staff read" on sale_event_collections
  for select using (is_staff());

alter table sale_event_collection_discounts enable row level security;
drop policy if exists "sale event collection discounts staff read"
  on sale_event_collection_discounts;
create policy "sale event collection discounts staff read"
  on sale_event_collection_discounts
  for select using (is_staff());

------------------------------------------------------------------------------
-- 2. 16.3 — давхцал (барааны `sale_event_check_overlap`-ийн толь)
------------------------------------------------------------------------------

create or replace function sale_event_check_bundle_overlap(p_event uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conflicts jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('sale_events'));
  select jsonb_agg(jsonb_build_object(
           'collectionId', c.id,
           'collection', c.name,
           'event', o.name,
           'startsAt', o.starts_at,
           'endsAt', o.ends_at)
         order by c.name)
    into v_conflicts
    from sale_events e
    join sale_event_collections p on p.event_id = e.id
    join sale_event_collections op
      on op.collection_id = p.collection_id and op.event_id <> e.id
    join sale_events o on o.id = op.event_id
    join collections c on c.id = p.collection_id
   where e.id = p_event
     and e.is_active
     and o.is_active
     and o.starts_at < e.ends_at
     and e.starts_at < o.ends_at;
  if v_conflicts is not null then
    raise exception 'EVENT_BUNDLE_OVERLAP'
      using errcode = 'exclusion_violation', detail = v_conflicts::text;
  end if;
end;
$$;

revoke all on function sale_event_check_bundle_overlap(uuid)
  from public, anon, authenticated;

-- Арга хэмжээний хугацаа / төлөв өөрчлөгдөхөд бараа ба багц хоёуланг.
create or replace function trg_sale_events_overlap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform sale_event_check_overlap(new.id);
  perform sale_event_check_bundle_overlap(new.id);
  return null;
end $$;

create or replace function trg_sale_event_collections_overlap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform sale_event_check_bundle_overlap(new.event_id);
  return null;
end $$;

drop trigger if exists sale_event_collections_no_overlap on sale_event_collections;
create constraint trigger sale_event_collections_no_overlap
  after insert or update on sale_event_collections
  deferrable initially deferred
  for each row execute function trg_sale_event_collections_overlap();

------------------------------------------------------------------------------
-- 3. Үнэ
------------------------------------------------------------------------------

-- Багцын үнэ — TS `bundlePrice` (features/collections/pricing.ts)-ийн ЯГ
-- толь: `max(0, round(memberSum * (1 - pct/100) / step) * step)`, step ≤ 1
-- бол бүхэл ₮. float8 нь IEEE double — JS Number-тэй ижил үйлдлүүд ижил
-- дарааллаар тул бит бүрээр ижил дүн; `Math.round` (тэнцүүд +∞ рүү) =
-- `floor(x + 0.5)` эерэг x-д. Тест: scripts/test-event-bundles.ts.
create or replace function collection_bundle_price(
  p_member_sum bigint, p_pct numeric, p_step int)
returns int
language sql
immutable
as $$
  select greatest(0,
    case
      when coalesce(p_step, 100) <= 1 then
        floor(p_member_sum::float8 * (1 - p_pct::float8 / 100) + 0.5)
      else
        floor(p_member_sum::float8 * (1 - p_pct::float8 / 100)
              / p_step::float8 + 0.5) * p_step
    end)::int;
$$;

-- Хэмжээний суурь хувь: `collection_ml_discounts.discount_pct`, эс бөгөөс
-- багцын `discount_pct` (TS `discountForMl`).
create or replace function collection_base_pct(p_collection uuid, p_ml int)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
           (select d.discount_pct from collection_ml_discounts d
             where d.collection_id = p_collection and d.ml = p_ml),
           c.discount_pct)
    from collections c
   where c.id = p_collection;
$$;

revoke all on function collection_base_pct(uuid, int) from public;
grant execute on function collection_base_pct(uuid, int)
  to anon, authenticated, service_role;

-- Одоо LIVE арга хэмжээн дэх багцын хэмжээ бүрийн хувь. Нийтийн мэдээлэл
-- (үнээрээ аль хэдийн ил) — anon уншина; ноорог / товлосон / дууссан мөр
-- ХЭЗЭЭ Ч гарахгүй. Хоёр туг хоёулаа нээлттэй үед л.
-- Нэг багц нэг үед нэг нийтэлсэн event-д л байна (§2), гэхдээ хамгаалалт
-- болгож (collection, ml)-ээр хамгийн их хувийг авна.
create or replace function live_event_collection_discounts()
returns table (
  collection_id uuid,
  ml            int,
  pct           int,
  event_slug    text,
  event_name    text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (d.collection_id, d.ml)
         d.collection_id, d.ml, d.pct::int, e.slug, e.name
    from sale_event_collection_discounts d
    join sale_events e on e.id = d.event_id
    join feature_flags f1 on f1.key = 'sale_events' and f1.enabled
    join feature_flags f2 on f2.key = 'sale_event_bundles' and f2.enabled
   where e.is_active
     and e.starts_at <= now()
     and now() < e.ends_at
   order by d.collection_id, d.ml, d.pct desc, e.starts_at, e.id;
$$;

revoke all on function live_event_collection_discounts() from public;
grant execute on function live_event_collection_discounts()
  to anon, authenticated, service_role;

------------------------------------------------------------------------------
-- 4. Задаргаа — 0189-ийн бие + багцын event хэсэг
------------------------------------------------------------------------------

-- Захиалгын event-д орсон бэлэн багц бүрийн нэмэлт хямдрал (₮, qty-тай):
-- суурь хувиар бодсон багцын үнэ − бодитоор төлсөн (TS-ийн бодсон гишүүдийн
-- unit_price-ийн нийлбэр). Туг хаалттай / LIVE event-гүй бол мөргүй.
-- `order_apply_price_breakdown`-ийн дараа (base_price бөглөгдсөн) дуудна.
create or replace function order_bundle_event_rows(p_order uuid)
returns table (label text, amount bigint)
language sql
stable
security definer
set search_path = public
as $$
  with st as (
    select coalesce((select (value->>'roundTo')::int from settings
                      where key = 'collection'), 100) as step
  ), b as (
    select i.collection_id, i.ml, i.qty,
           sum(i.base_price)::bigint as member_sum,
           sum(i.unit_price)::bigint as paid
      from order_items i
     where i.order_id = p_order
       and i.line_kind = 'perfume'
       and not i.is_gift
       and i.collection_id is not null
       and i.base_price is not null
     group by i.collection_id, i.ml, i.qty
  ), r as (
    select ev.event_name as label,
           greatest(collection_bundle_price(b.member_sum,
                      collection_base_pct(b.collection_id, b.ml), st.step)
                    - b.paid, 0) * b.qty as amount
      from b
      cross join st
      join live_event_collection_discounts() ev
        on ev.collection_id = b.collection_id and ev.ml = b.ml
  )
  select r.label, sum(r.amount)::bigint from r where r.amount > 0 group by r.label;
$$;

revoke all on function order_bundle_event_rows(uuid) from public, anon, authenticated;
grant execute on function order_bundle_event_rows(uuid) to service_role;

create or replace function order_apply_price_breakdown(p_order uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bundle_event int;
begin
  -- Үнэртний мөр (бэлэг, шагнал, нэмэлт бараанаас бусад). 0189-тэй ижил.
  update order_items i
     set base_price = pv.price,
         sale_label = case
           when i.collection_name is null and i.unit_price < pv.price
             then coalesce(variant_sale_label(pv.*), 'Хямдрал')
         end,
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

  -- 0190: багцын event хэсэг «Багцын хямдрал»-аас салж «<Event нэр>» мөр
  -- болно → `gross_subtotal`-аас хасагдаж, `sale_discount`-д нэмэгдэнэ.
  select coalesce(sum(amount), 0)::int into v_bundle_event
    from order_bundle_event_rows(p_order);

  update orders o
     set gross_subtotal = (
           select coalesce(sum(coalesce(i.list_price, i.unit_price)::bigint * i.qty), 0)::int
             from order_items i where i.order_id = p_order) - v_bundle_event,
         sale_discount = (
           select coalesce(sum((i.base_price - i.unit_price)::bigint * i.qty), 0)::int
             from order_items i
            where i.order_id = p_order and i.sale_label is not null) + v_bundle_event,
         sale_breakdown = coalesce((
           select jsonb_agg(jsonb_build_object('label', s.label, 'amount', s.amount)
                            order by s.manual, s.amount desc, s.label)
             from (
               select u.label,
                      u.label = 'Хямдрал' as manual,
                      sum(u.amount)::int as amount
                 from (
                   select i.sale_label as label,
                          (i.base_price - i.unit_price)::bigint * i.qty as amount
                     from order_items i
                    where i.order_id = p_order and i.sale_label is not null
                   union all
                   select r.label, r.amount from order_bundle_event_rows(p_order) r
                 ) u
                group by u.label
             ) s
            where s.amount > 0), '[]'::jsonb)
   where o.id = p_order;
end $$;

revoke all on function order_apply_price_breakdown(uuid) from public, anon, authenticated;
grant execute on function order_apply_price_breakdown(uuid) to service_role;

------------------------------------------------------------------------------
-- 5. Хадгалах — 0187-ийн бие + `p_data.collections`
------------------------------------------------------------------------------

-- p_data.collections: [{ collectionId, pcts: { "2": 10, "10": 15 } }, …].
-- Түлхүүр ирээгүй (хуучин код / туг хаалттай) бол багцын мөр хөндөгдөхгүй.
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

  delete from sale_event_products where event_id = v_id;

  insert into sale_event_products (event_id, product_id, sort_order)
  select v_id, (it.x->>'productId')::uuid, it.ord::int
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
         with ordinality as it(x, ord);

  insert into sale_event_discounts (event_id, product_id, ml, pct)
  select v_id, (it.x->>'productId')::uuid, pc.key::int, pc.value::numeric::smallint
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as it(x)
    cross join lateral jsonb_each_text(coalesce(it.x->'pcts', '{}'::jsonb)) pc
   where pc.value is not null and pc.value <> '';

  if v_bundles then
    delete from sale_event_collections where event_id = v_id;

    insert into sale_event_collections (event_id, collection_id, sort_order)
    select v_id, (it.x->>'collectionId')::uuid, it.ord::int
      from jsonb_array_elements(p_data->'collections') with ordinality as it(x, ord);

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
