-- Хугацаат хямдрал — «арга хэмжээ» (Black Friday, Цагаан сар, Наадам …).
-- Төлөвлөгөө: docs/campaigns/plan.md (§4–§6, §10–§12). Feature flag `sale_events`.
--
-- Нэг арга хэмжээ = нэр, slug, эхлэх/дуусах хугацаа, бараанууд, бараа × хэмжээ
-- бүрийн хувь. Хямдралын үнийг `product_variants.sale_price`-д БИЧИХГҮЙ —
-- `variant_price()` дотор тусдаа хүснэгтээс ТООЦООЛНО (§3.2-B). Ингэснээр:
--   · одоо явж буй гар хямдрал (0166) дарагдаж устахгүй, арга хэмжээ дуусахад
--     «сэргээх» алхам огт хэрэггүй — үнэ нь `now()`-оос хамаарсан тооцоолол;
--   · захиалга (`place_order`), каталог (`catalog_items`), хайлт, «Хямдрал»
--     таг бүгд `variant_price` / `variant_sale_active`-аар дамждаг тул нэг
--     газрын өөрчлөлтөөр бүгд зэрэг зөв болно. Гарын үсэг өөрчлөгдөхгүй.
--   · гар хямдрал + арга хэмжээ зэрэг байвал ХАМГИЙН ХЯМД нь (`least`), хувь нь
--     ҮНДСЭН үнээс, хоорондоо нэмэгдэхгүй (клиент, 2026-11-13, §16-Q1).
--
-- Нэр томьёо: «Кампанит ажил» (`campaigns`, 0135) бол бүртгэлийн купон — өөр.
--
-- Хүснэгтүүд staff-only RLS: товлосон арга хэмжээний хувь PostgREST-ээр
-- урьдчилж уншигдахгүй. Дэлгүүр зөвхөн security definer функцээр уншина.
--
-- Туг хаалттай үед: `variant_event_price` null → үнэ хөндөгдөхгүй; `live_sale_events`,
-- `sale_event_public`, `sale_event_product_ids` хоосон; бичих RPC-ууд
-- `FEATURE_DISABLED` — prod дээр юу ч хуримтлагдахгүй.
--
-- Expand only: шинэ хүснэгт, шинэ функц, `catalog_search`-д default-тай шинэ
-- параметр (хуучин дуудлага ажилласаар).

insert into feature_flags (key) values ('sale_events') on conflict do nothing;

------------------------------------------------------------------------------
-- 1. Хүснэгтүүд.
------------------------------------------------------------------------------

-- Хугацаа нь timestamptz; админ УБ өдөр сонгоно (`dayStartIso`/`dayEndIso`).
-- `ends_at` нь EXCLUSIVE хил: дуусах өдрийн дараах 00:00 → `now() < ends_at`.
-- Төлөв (тооцоолол): draft (is_active=false) · scheduled · live · ended.
create table if not exists sale_events (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  name           text not null check (length(btrim(name)) between 1 and 60),
  -- Картан дээрх тэмдэг; null → «Хямдрал».
  badge_label    text check (badge_label is null
                             or length(btrim(badge_label)) between 1 and 24),
  -- Каталогийн дээрх зурвас.
  headline       text check (headline is null or length(headline) <= 80),
  description    text check (description is null or length(description) <= 200),
  starts_at      timestamptz not null,
  ends_at        timestamptz not null,
  -- Ноорог / нийтэлсэн. Нийтлээгүй бол хугацаа ирсэн ч юу ч өөрчлөгдөхгүй.
  is_active      boolean not null default false,
  show_countdown boolean not null default true,
  created_by     uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint sale_events_period check (ends_at > starts_at)
);

create index if not exists sale_events_live_idx
  on sale_events (starts_at, ends_at) where is_active;

drop trigger if exists sale_events_updated_at on sale_events;
create trigger sale_events_updated_at
  before update on sale_events
  for each row execute function set_updated_at();

-- Гишүүнчлэл: каталогийн шүүлтүүр, badge. Хувьгүй гишүүн = «сонголт» (жишээ:
-- «Аавуудад бэлэг») — жагсаалтад орно, үнэ өөрчлөгдөхгүй.
create table if not exists sale_event_products (
  event_id   uuid not null references sale_events(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  sort_order int not null default 0,
  primary key (event_id, product_id)
);

create index if not exists sale_event_products_product_idx
  on sale_event_products (product_id);

-- Бараа × хэмжээ бүрийн хувь (клиент, 2026-11-13). Мөргүй хэмжээ = тэр
-- хэмжээнд хямдралгүй. `ml` нь `ML_SIZES` (constants.ts)-тай ижил.
create table if not exists sale_event_discounts (
  event_id   uuid not null,
  product_id uuid not null,
  ml         int not null check (ml in (2, 5, 10, 20)),
  pct        smallint not null check (pct between 1 and 90),
  primary key (event_id, product_id, ml),
  foreign key (event_id, product_id)
    references sale_event_products (event_id, product_id) on delete cascade
);

create index if not exists sale_event_discounts_product_idx
  on sale_event_discounts (product_id, ml);

------------------------------------------------------------------------------
-- 2. RLS — зөвхөн staff уншина. Бичих policy байхгүй: service-role RPC.
------------------------------------------------------------------------------

alter table sale_events enable row level security;
drop policy if exists "sale events staff read" on sale_events;
create policy "sale events staff read" on sale_events
  for select using (is_staff());

alter table sale_event_products enable row level security;
drop policy if exists "sale event products staff read" on sale_event_products;
create policy "sale event products staff read" on sale_event_products
  for select using (is_staff());

alter table sale_event_discounts enable row level security;
drop policy if exists "sale event discounts staff read" on sale_event_discounts;
create policy "sale event discounts staff read" on sale_event_discounts
  for select using (is_staff());

------------------------------------------------------------------------------
-- 3. Давхцал: нэг бараа хугацаа давхцсан хоёр ИДЭВХТЭЙ арга хэмжээнд орохгүй.
--
-- Deferred constraint trigger: хадгалах RPC эхлээд гишүүдээ солиод дараа нь
-- хугацаа/төлвөө шинэчилдэг — завсрын төлөвт худал давхцал гарахгүйн тулд
-- шалгалт транзакцийн ЭЦСИЙН төлөв дээр (RPC өөрөө `set constraints …
-- immediate`-ээр функц дотроо дуудна). Advisory lock — хоёр админ зэрэг
-- хадгалах үеийн race (0135 `campaigns_no_overlap`-ийн загвар).
------------------------------------------------------------------------------

create or replace function sale_event_check_overlap(p_event uuid)
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
           'productId', pr.id,
           'product', pr.name,
           'brand', pr.brand,
           'event', o.name,
           'startsAt', o.starts_at,
           'endsAt', o.ends_at)
         order by pr.brand, pr.name)
    into v_conflicts
    from sale_events e
    join sale_event_products p on p.event_id = e.id
    join sale_event_products op
      on op.product_id = p.product_id and op.event_id <> e.id
    join sale_events o on o.id = op.event_id
    join products pr on pr.id = p.product_id
   where e.id = p_event
     and e.is_active
     and o.is_active
     and o.starts_at < e.ends_at
     and e.starts_at < o.ends_at;
  if v_conflicts is not null then
    raise exception 'EVENT_OVERLAP'
      using errcode = 'exclusion_violation', detail = v_conflicts::text;
  end if;
end;
$$;

revoke all on function sale_event_check_overlap(uuid) from public, anon, authenticated;

create or replace function trg_sale_events_overlap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform sale_event_check_overlap(new.id);
  return null;
end $$;

create or replace function trg_sale_event_products_overlap()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform sale_event_check_overlap(new.event_id);
  return null;
end $$;

drop trigger if exists sale_events_no_overlap on sale_events;
create constraint trigger sale_events_no_overlap
  after insert or update of starts_at, ends_at, is_active on sale_events
  deferrable initially deferred
  for each row execute function trg_sale_events_overlap();

drop trigger if exists sale_event_products_no_overlap on sale_event_products;
create constraint trigger sale_event_products_no_overlap
  after insert or update on sale_event_products
  deferrable initially deferred
  for each row execute function trg_sale_event_products_overlap();

------------------------------------------------------------------------------
-- 4. Үнэ (§5.1). `variant_price` / `variant_sale_active`-ийн гарын үсэг
--    хэвээр — зөвхөн бие нь өөрчлөгдөнө.
------------------------------------------------------------------------------

-- Хувиас хямдарсан үнэ: үндсэн үнээс, 100₮-д дугуйрна, үндсэн үнээс
-- давахгүй (0166 `apply_bulk_sale`-ийн дүрэм; TS толь: `bulkSalePrice`).
-- Хувь null → null. Томьёоны ЦОРЫН ГАНЦ газар — доорх хоёр зам үүнийг дуудна.
create or replace function event_discount_price(p_price int, p_pct int)
returns int language sql immutable as $$
  select case
           when p_pct is null or p_price <= 0 then null
           else least(p_price,
                      (round(p_price * (100 - p_pct)::numeric / 100 / 100)
                       * 100)::int)
         end;
$$;

-- Одоо LIVE арга хэмжээний (бараа, хэмжээ) → хамгийн их хувь. Нэг query-д
-- НЭГ удаа уншихад (`catalog_items`).
--
-- SECURITY DEFINER: хүснэгтүүд staff-only RLS-тэй, харин үнийг anon ч бодно.
-- Зөвхөн LIVE мөр — товлосон хувь задрахгүй. Тугийг `feature_enabled()`-ээр
-- биш `feature_flags`-тэй шууд join-оор: мөр бүрт үүрлэсэн definer функц
-- дуудах нь ~6 дахин удаан байсан (dev хэмжилт).
create or replace function live_event_discounts()
returns table (product_id uuid, ml int, pct int)
language sql
stable
security definer
set search_path = public
as $$
  select d.product_id, d.ml, max(d.pct)::int
    from sale_event_discounts d
    join sale_events e on e.id = d.event_id
    join feature_flags f on f.key = 'sale_events' and f.enabled
   where e.is_active
     and e.starts_at <= now()
     and now() < e.ends_at
   group by d.product_id, d.ml;
$$;

-- Нэг хэмжээний арга хэмжээний үнэ, эсвэл null — захиалга, барааны хуудас
-- зэрэг цөөн мөртэй зам (`variant_price`).
create or replace function variant_event_price(v product_variants)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select event_discount_price(v.price, max(d.pct))
    from sale_event_discounts d
    join sale_events e on e.id = d.event_id
    join feature_flags f on f.key = 'sale_events' and f.enabled
   where d.product_id = v.product_id
     and d.ml = v.ml
     and e.is_active
     and e.starts_at <= now()
     and now() < e.ends_at;
$$;

revoke all on function live_event_discounts() from public;
revoke all on function variant_event_price(product_variants) from public;
grant execute on function live_event_discounts()
  to anon, authenticated, service_role;
grant execute on function variant_event_price(product_variants)
  to anon, authenticated, service_role;

-- 0166-ийн `variant_sale_active` бие — зөвхөн ГАР хямдрал (`sale_price`).
create or replace function variant_manual_sale_active(v product_variants)
returns boolean language sql stable as $$
  select v.sale_price is not null
     and v.sale_price < v.price
     and (v.sale_starts_at is null or v.sale_starts_at <= now())
     and (v.sale_ends_at is null or v.sale_ends_at > now());
$$;

-- Хямдрал (гар эсвэл арга хэмжээ) яг одоо хүчинтэй эсэх — «Хямдрал» таг.
create or replace function variant_sale_active(v product_variants)
returns boolean language sql stable as $$
  select variant_manual_sale_active(v)
      or coalesce(variant_event_price(v) < v.price, false);
$$;

-- Төлбөр тооцох цорын ганц цэг. `least` нь null-ийг алгасна: гар хямдрал
-- хүчингүй / арга хэмжээгүй бол тэр гишүүн тооцоонд орохгүй. PostgREST-д
-- computed column болж уншигдана: `product_variants ( …, variant_price )`.
create or replace function variant_price(v product_variants)
returns int language sql stable as $$
  select least(
           v.price,
           case when variant_manual_sale_active(v) then v.sale_price end,
           variant_event_price(v));
$$;

-- Каталог (§5.1-ийн гүйцэтгэлийн хувилбар). `catalog_items` хэмжээ БҮРТ үнэ
-- бодно (~360 мөр / query); `variant_price` → definer функц мөр бүрт дуудах
-- нь catalog_search-ийг dev дээр 94ms → 142ms болгосон. Энд live хувиудыг
-- НЭГ удаа (`live_event_discounts`, materialized CTE) уншиж join хийнэ.
-- Үнийн дүрэм нь `variant_price`-тай ЯГ ИЖИЛ (least: үндсэн, гар хямдрал,
-- `event_discount_price`) — өөрчлөхдөө хоёуланг нь зэрэг. Тест:
-- scripts/test-sale-events.ts «catalog ↔ variant_price».
-- Бие нь 0125-ынх; зөвхөн `eff` тооцоо болон `ev` CTE нэмэгдсэн.
create or replace view catalog_items with (security_invoker = true) as
  with ev as materialized (
    select product_id, ml, pct from live_event_discounts()
  )
  select
    p.id, p.slug, p.name, p.brand,
    p.gender::text as gender,
    p.concentration::text as concentration,
    p.scent_families,
    p.seasons::text[] as seasons,
    coalesce(p.is_featured, false) as is_featured,
    p.rating_avg, p.rating_count,
    coalesce(p.launched_at, p.created_at) as created_at,
    p.search_text,
    (select pi.url from product_images pi
      where pi.product_id = p.id and pi.is_visible
      order by pi.sort_order limit 1) as image_url,
    (select coalesce(nullif(pi.alt, ''), p.name) from product_images pi
      where pi.product_id = p.id and pi.is_visible
      order by pi.sort_order limit 1) as image_alt,
    coalesce(tg.kinds, '{}') as tags,
    v.sellable_count,
    v.sellable_mls,
    coalesce(v.sell_price, v.active_price, 0) as starting_price,
    coalesce(v.sell_base, v.active_base, 0) as starting_base_price
  from products p
  left join inventory inv on inv.product_id = p.id
  join lateral (
    select
      count(*) filter (where c.sellable) as sellable_count,
      array_agg(distinct pv.ml) filter (where c.sellable) as sellable_mls,
      (array_agg(c.eff order by c.eff) filter (where c.sellable))[1] as sell_price,
      (array_agg(pv.price order by c.eff) filter (where c.sellable))[1] as sell_base,
      (array_agg(c.eff order by c.eff) filter (where pv.is_active))[1] as active_price,
      (array_agg(pv.price order by c.eff) filter (where pv.is_active))[1] as active_base
    from product_variants pv
    left join ev on ev.product_id = pv.product_id and ev.ml = pv.ml
    cross join lateral (
      select
        least(pv.price,
              case when variant_manual_sale_active(pv.*) then pv.sale_price end,
              event_discount_price(pv.price, ev.pct)) as eff,
        variant_sellable(pv.*, p.gender, inv.is_sold_out, inv.available_ml)
          as sellable
    ) c
    where pv.product_id = p.id
  ) v on true
  left join lateral (
    select array_agg(t.kind::text) as kinds
      from product_tags pt
      join tags t on t.id = pt.tag_id
     where pt.product_id = p.id
  ) tg on true
  where p.is_active;

------------------------------------------------------------------------------
-- 5. Дэлгүүрийн уншилт — зөвхөн хэрэгтэй талбар, зөвхөн зөв үед (§4.7).
------------------------------------------------------------------------------

-- Одоо явж буй арга хэмжээнүүд: каталогийн chip, зурвас, badge.
create or replace function live_sale_events()
returns table (
  slug           text,
  name           text,
  badge_label    text,
  headline       text,
  description    text,
  starts_at      timestamptz,
  ends_at        timestamptz,
  show_countdown boolean,
  product_ids    uuid[]
)
language sql
stable
security definer
set search_path = public
as $$
  select e.slug, e.name, e.badge_label, e.headline, e.description,
         e.starts_at, e.ends_at, e.show_countdown,
         coalesce(array(
           select p.product_id
             from sale_event_products p
            where p.event_id = e.id
            order by p.sort_order, p.product_id
         ), '{}')
    from sale_events e
   where feature_enabled('sale_events')
     and e.is_active
     and e.starts_at <= now()
     and now() < e.ends_at
   order by e.ends_at, e.name;
$$;

-- Нэг slug-ийн нийтийн төлөв: тизер «11/23-нд эхэлнэ», «дууссан» зурвас.
-- Хувь, барааны жагсаалт БАЙХГҮЙ. Ноорог → мөргүй (олдохгүйтэй адил).
create or replace function sale_event_public(p_slug text)
returns table (
  slug      text,
  name      text,
  state     text,
  starts_at timestamptz,
  ends_at   timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.slug, e.name,
         case
           when now() < e.starts_at then 'scheduled'
           when now() < e.ends_at then 'live'
           else 'ended'
         end,
         e.starts_at, e.ends_at
    from sale_events e
   where feature_enabled('sale_events')
     and e.is_active
     and e.slug = p_slug;
$$;

-- LIVE арга хэмжээний гишүүд — `catalog_search` (invoker) хүснэгтийг шууд
-- уншиж чадахгүй тул энэ функцээр.
create or replace function sale_event_product_ids(p_slug text)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.product_id
    from sale_event_products p
    join sale_events e on e.id = p.event_id
   where feature_enabled('sale_events')
     and e.slug = p_slug
     and e.is_active
     and e.starts_at <= now()
     and now() < e.ends_at;
$$;

revoke all on function live_sale_events() from public;
revoke all on function sale_event_public(text) from public;
revoke all on function sale_event_product_ids(text) from public;
grant execute on function live_sale_events() to anon, authenticated, service_role;
grant execute on function sale_event_public(text) to anon, authenticated, service_role;
grant execute on function sale_event_product_ids(text) to anon, authenticated, service_role;

------------------------------------------------------------------------------
-- 6. Каталог: `?event=slug` (§6.1).
--
-- Шинэ параметртэй `create or replace` нь Postgres-д ШИНЭ overload үүсгэж,
-- нэрлэсэн параметрээр дуудахад «function is not unique» болно. Тиймээс
-- хуучин гарын үсгийг устгаад шинийг үүсгэнэ — `p_event` default-тай тул
-- хуучин дуудлага (p_event-гүй) ажилласаар. Бие нь 0115-тай ижил + 1 мөр.
------------------------------------------------------------------------------

drop function if exists catalog_search(
  text[], uuid[], text[], text[], text[], text[], text[], boolean, int[],
  int, int, text, int, int);

create or replace function catalog_search(
  p_terms      text[]  default null,
  p_ids        uuid[]  default null,
  p_brands     text[]  default null,
  p_genders    text[]  default null,
  p_families   text[]  default null,
  p_seasons    text[]  default null,
  p_tags       text[]  default null,
  p_featured   boolean default null,
  p_mls        int[]   default null,
  p_min_price  int     default null,
  p_max_price  int     default null,
  p_sort       text    default 'new',
  p_page       int     default 1,
  p_per_page   int     default 12,
  p_event      text    default null
)
returns table (
  total               bigint,
  id                  uuid,
  slug                text,
  name                text,
  brand               text,
  gender              text,
  concentration       text,
  scent_families      text[],
  seasons             text[],
  image_url           text,
  image_alt           text,
  starting_price      int,
  starting_base_price int,
  tags                text[],
  is_featured         boolean,
  sold_out            boolean,
  rating_avg          numeric,
  rating_count        int,
  created_at          timestamptz
)
language sql
stable
set search_path = public, extensions
as $$
  with matched as (
    select c.*, coalesce(s.sold_qty, 0) as sold_qty
      from catalog_items c
      -- anon-д нээлттэй (0034); limit-гүй байхаар хамгийн их int.
      left join top_seller_products(2147483647) s on s.product_id = c.id
     where (p_ids is null or cardinality(p_ids) = 0 or c.id = any (p_ids))
       and (p_terms is null or cardinality(p_terms) = 0
            or c.search_text like all (array(select '%' || t || '%' from unnest(p_terms) t)))
       and (p_brands is null or cardinality(p_brands) = 0 or c.brand = any (p_brands))
       and (p_genders is null or cardinality(p_genders) = 0 or c.gender = any (p_genders))
       and (p_families is null or cardinality(p_families) = 0 or c.scent_families && p_families)
       -- «all» = бүх улирал: аль ч улирлын шүүлтэд хариулна (JS-тэй ижил).
       and (p_seasons is null or cardinality(p_seasons) = 0
            or c.seasons && (p_seasons || array['all']))
       and (p_featured is not true or c.is_featured)
       and (p_tags is null or cardinality(p_tags) = 0 or c.tags && p_tags)
       -- «ml боломж» = ЯГ ОДОО захиалж болох хэмжээ.
       and (p_mls is null or cardinality(p_mls) = 0 or c.sellable_mls && p_mls)
       and (p_min_price is null or c.starting_price >= p_min_price)
       and (p_max_price is null or c.starting_price <= p_max_price)
       -- Арга хэмжээ (0181): зөвхөн LIVE үеийн гишүүд; эс бөгөөс хоосон.
       and (p_event is null or p_event = ''
            or c.id in (select sale_event_product_ids(p_event)))
  )
  select
    count(*) over () as total,
    id, slug, name, brand, gender, concentration, scent_families, seasons,
    image_url, image_alt, starting_price, starting_base_price, tags,
    is_featured, (sellable_count = 0) as sold_out,
    rating_avg, rating_count, created_at
  from matched
  order by
    -- «Онцлох» жагсаалт ба «Санал болгох»: дууссан бараа хамгийн ард.
    case when p_sort in ('featured', 'recommended') then (sellable_count = 0) end asc,
    -- «Санал болгох»: Эрэлттэй → Шинэ → Онцлох → бусад. Нэг ус хэд хэдэн
    -- бүлэгт орвол хамгийн өндөрт нь харагдана.
    case when p_sort = 'recommended' then
      case
        when 'hot' = any (tags) then 0
        when 'new' = any (tags) then 1
        when is_featured        then 2
        else 3
      end
    end asc,
    case when p_sort = 'recommended' and 'hot' = any (tags) then sold_qty end desc,
    case when p_sort = 'recommended' then name end asc,
    case when p_sort = 'price_asc'  then starting_price end asc,
    case when p_sort = 'price_desc' then starting_price end desc,
    case when p_sort = 'name'       then name end asc,
    case when p_sort = 'popular'    then sold_qty end desc,
    created_at desc
  limit greatest(coalesce(p_per_page, 12), 1)
  offset greatest(coalesce(p_page, 1) - 1, 0) * greatest(coalesce(p_per_page, 12), 1);
$$;

revoke all on function catalog_search(
  text[], uuid[], text[], text[], text[], text[], text[], boolean, int[],
  int, int, text, int, int, text) from public;
grant execute on function catalog_search(
  text[], uuid[], text[], text[], text[], text[], text[], boolean, int[],
  int, int, text, int, int, text) to anon, authenticated, service_role;

------------------------------------------------------------------------------
-- 7. «Хямдрал» таг шууд шинэчлэгдэх (0103, 0166-ийн загвар). Эхлэх/дуусах
--    мөчийг pg_cron `refresh-sale-tag` минут тутам аль хэдийн барьдаг.
------------------------------------------------------------------------------

drop trigger if exists sale_events_refresh_sale_tag on sale_events;
create trigger sale_events_refresh_sale_tag
  after insert or delete or update of starts_at, ends_at, is_active
  on sale_events
  for each statement execute function trg_refresh_sale_tag();

drop trigger if exists sale_event_products_refresh_sale_tag on sale_event_products;
create trigger sale_event_products_refresh_sale_tag
  after insert or delete or update on sale_event_products
  for each statement execute function trg_refresh_sale_tag();

drop trigger if exists sale_event_discounts_refresh_sale_tag on sale_event_discounts;
create trigger sale_event_discounts_refresh_sale_tag
  after insert or delete or update on sale_event_discounts
  for each statement execute function trg_refresh_sale_tag();

------------------------------------------------------------------------------
-- 8. Бичих RPC (Админ → Арга хэмжээ). Route handler туг (404) → staff (403)
--    → Zod шалгасны дараа service-role-оор дуудна; туг энд ДАХИН шалгагдана.
------------------------------------------------------------------------------

-- Нэг арга хэмжээг бүхэлд нь хадгална (шинэ бол үүсгэнэ): үндсэн талбарууд +
-- гишүүд + хувиуд нэг транзакцид. Гишүүдийг бүрэн сольдог.
--   p_data:  { slug, name, badgeLabel, headline, description, startsAt,
--              endsAt, isActive, showCountdown }
--   p_items: [{ productId, pcts: { "2": 10, "5": 15 } }, …] — дарааллаараа.
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
begin
  if not feature_enabled('sale_events') then
    raise exception 'FEATURE_DISABLED';
  end if;

  -- Slug-ийг жил бүр дахин ашиглана (`black-friday`, §6.2): тэр slug ДУУССАН
  -- арга хэмжээнд байвал хуучныг `black-friday-2025` болгож архивлана. Явж
  -- буй / товлосон / ноорог дээр байвал unique алдаа (SLUG_TAKEN).
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
                             created_by)
    values (p_data->>'slug', p_data->>'name',
            nullif(btrim(p_data->>'badgeLabel'), ''),
            nullif(btrim(p_data->>'headline'), ''),
            nullif(btrim(p_data->>'description'), ''),
            (p_data->>'startsAt')::timestamptz,
            (p_data->>'endsAt')::timestamptz,
            coalesce((p_data->>'isActive')::boolean, false),
            coalesce((p_data->>'showCountdown')::boolean, true),
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
           show_countdown = coalesce((p_data->>'showCountdown')::boolean, true)
     where id = v_id;
    if not found then
      raise exception 'NOT_FOUND';
    end if;
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

  -- Давхцлыг эцсийн төлөв дээр, функц дотроо шалгана — алдаа commit-ийн үед
  -- биш, энэ дуудлагын хариунд ирнэ.
  set constraints sale_events_no_overlap, sale_event_products_no_overlap immediate;

  return v_id;
end;
$$;

-- «Зогсоох»: түүх үлдэнэ. Явж буй / дууссан → `ends_at = now()`;
-- эхлээгүй → ноорог руу буцна (`ends_at > starts_at` хадгалагдана).
create or replace function stop_sale_event(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not feature_enabled('sale_events') then
    raise exception 'FEATURE_DISABLED';
  end if;
  update sale_events
     set is_active = case when starts_at > now() then false else is_active end,
         ends_at = case when starts_at <= now() and ends_at > now()
                        then greatest(now(), starts_at + interval '1 second')
                        else ends_at end
   where id = p_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
end;
$$;

-- Устгах нь зөвхөн ноорог (нийтэлсэн бол эхлээд зогсоо — түүх үлдэнэ).
create or replace function delete_sale_event(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not feature_enabled('sale_events') then
    raise exception 'FEATURE_DISABLED';
  end if;
  delete from sale_events where id = p_id and not is_active;
  if not found then
    raise exception 'NOT_DRAFT';
  end if;
end;
$$;

revoke all on function save_sale_event(uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke all on function stop_sale_event(uuid) from public, anon, authenticated;
revoke all on function delete_sale_event(uuid) from public, anon, authenticated;
grant execute on function save_sale_event(uuid, jsonb, jsonb, uuid) to service_role;
grant execute on function stop_sale_event(uuid) to service_role;
grant execute on function delete_sale_event(uuid) to service_role;

comment on table sale_events is
  'Арга хэмжээ (0181): нэртэй, хугацаатай хямдрал/сонголт. Үнэ нь '
  'variant_price()-д тооцоологдоно, sale_price-д бичигдэхгүй. Туг sale_events.';
