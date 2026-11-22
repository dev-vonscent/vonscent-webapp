-- Нэмэлт бараа ба савны тоон нөөц — schema (docs/planning/extras-shop-plan.md
-- §4, §5; PR1). Feature flag: `extras_shop`, `vial_inventory` (анхдагч false).
--
-- Expand only: шинэ хүснэгт, nullable багана. Хуучин код энэ migration-ий
-- дараа ч яг өмнөх шигээ ажиллана — нэмэлт барааны мөр, савны reserve нь
-- дараагийн migration-уудад, тугаар хаалттай орно.
--
-- Нөөцийн гурван горим (`extra_inventory_mode_t`):
--   local_quantity  — хувилбар бүр өөрийн ширхэгтэй (хайрцаг, шприц, уут…)
--   shared_vial     — хоосон декант сав; тоо нь `vials`-д, үнэртэнтэй хуваалцана
--   leftover_liquid — эх шил өөрөө: 1 ширхэг + эх үнэртний шингэний түгжээ
-- Горим нь ангиллаас бараа, хувилбар руу composite FK-аар буудаг тул зөрөх
-- өгөгдөл import script-ээр ч үүсэхгүй. Checkout, нөөцийн код горимоор л
-- салбарлана — ангиллын slug-аар биш.
--
-- Нөөцийн тоо (`extra_variants.on_hand_qty/reserved_qty`, `vials.on_hand/
-- reserved`) ЗӨВХӨН хөдөлгөөний бичлэгтэй хамт өөрчлөгдөнө (`extra_stock_move`,
-- `vial_stock_move`). Өөр зам (админы шууд update, import) guard trigger-т
-- бүдэрнэ — «эхний тоо + Σ хөдөлгөөн = одоогийн тоо» үргэлж үнэн.

insert into feature_flags (key) values ('extras_shop') on conflict do nothing;
insert into feature_flags (key) values ('vial_inventory') on conflict do nothing;

------------------------------------------------------------------------------
-- 1. Төрөл
------------------------------------------------------------------------------

do $$
begin
  create type extra_inventory_mode_t as enum
    ('local_quantity', 'shared_vial', 'leftover_liquid');
exception when duplicate_object then null;
end $$;

------------------------------------------------------------------------------
-- 2. Ангилал — 6 мөр seed, засах хуудас байхгүй (§2.2 F)
------------------------------------------------------------------------------

create table if not exists extra_categories (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique check (slug ~ '^[a-z][a-z0-9-]*$'),
  name           text not null,
  inventory_mode extra_inventory_mode_t not null,
  image_url      text,
  sort           int not null default 0,
  is_active      boolean not null default true,
  unique (id, inventory_mode)
);

insert into extra_categories (slug, name, inventory_mode, sort) values
  ('gift-box',     'Бэлгийн хайрцаг',  'local_quantity',  10),
  ('vial',         'Грамын сав',       'shared_vial',     20),
  ('leftover',     'Үлдэгдэлтэй шил',  'leftover_liquid', 30),
  ('empty-bottle', 'Хоосон шил',       'local_quantity',  40),
  ('syringe',      'Шприц',            'local_quantity',  50),
  ('brand-pouch',  'Брэндийн уут, сав', 'local_quantity', 60)
on conflict (slug) do nothing;

comment on table extra_categories is
  'Нэмэлт барааны ангилал. inventory_mode нь нөөцийн мөчлөгийг тодорхойлно; '
  'шинэ ангилал = migration (seed), шинэ горим = enum + SQL + админ + checkout.';

------------------------------------------------------------------------------
-- 3. Хоосон декант сав — тоон нөөц (§5.2)
------------------------------------------------------------------------------

create table if not exists vials (
  id            uuid primary key default gen_random_uuid(),
  -- 1ml, 2ml сав өнгөгүй; 5/10/20ml гурван өнгөтэй.
  style         text check (style in ('black', 'pink', 'silver')),
  ml            int not null check (ml in (1, 2, 5, 10, 20)),
  -- null = тоолж эхлээгүй: зарах боломж хязгааргүй, гэхдээ reserve
  -- бичигдсээр (тоолж эхлэхэд захиалгад байгаа сав «Захиалгад орсон»-д).
  on_hand       int check (on_hand >= 0),
  reserved      int not null default 0 check (reserved >= 0),
  low_threshold int not null default 10 check (low_threshold >= 0),
  is_active     boolean not null default true,
  note          text not null default '',
  updated_by    uuid references profiles(id) on delete set null,
  updated_at    timestamptz not null default now(),
  check ((ml in (1, 2)) = (style is null)),
  check (on_hand is null or reserved <= on_hand)
);
create unique index if not exists vials_style_ml_uq
  on vials (coalesce(style, '-'), ml);

drop trigger if exists vials_updated_at on vials;
create trigger vials_updated_at
  before update on vials
  for each row execute function set_updated_at();

-- 9 өнгөт + 2ml + 1ml. Бүгд тоолж эхлээгүй (null).
insert into vials (style, ml)
select s, m
  from unnest(array['black', 'pink', 'silver']) s
  cross join unnest(array[5, 10, 20]) m
on conflict do nothing;
insert into vials (style, ml) values (null, 2), (null, 1)
on conflict do nothing;

comment on table vials is
  'Хоосон декант савны тоо: өнгө × хэмжээ. on_hand = нийт (савлагдаад '
  'хүргэгдээгүйг оруулаад), reserved = хүргэгдээгүй захиалгад орсон. '
  'on_hand null = тоолж эхлээгүй (хязгааргүй). Тоо зөвхөн vial_stock_move-оор.';

create table if not exists vial_movements (
  id             bigserial primary key,
  vial_id        uuid not null references vials(id),
  kind           text not null check (kind in
                   ('set', 'reserve', 'release', 'commit', 'restock')),
  delta_on_hand  int not null default 0,
  delta_reserved int not null default 0,
  order_item_id  uuid references order_items(id) on delete set null,
  -- Давхар хэрэгжүүлэлтээс хамгаална: `<order_item>:vial:<kind>:<cycle>`.
  -- Админы гараар оруулсан тоо (`set`) түлхүүргүй.
  event_key      text unique,
  note           text not null default '',
  actor          uuid references profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists vial_movements_vial_idx
  on vial_movements (vial_id, created_at desc);

------------------------------------------------------------------------------
-- 4. Нэмэлт бараа (§5.1)
------------------------------------------------------------------------------

create table if not exists extra_products (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid not null references extra_categories(id),
  -- Ангиллаас хуулна (trigger), дараа нь өөрчлөгдөхгүй.
  inventory_mode extra_inventory_mode_t not null,
  slug           text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name           text not null check (char_length(btrim(name)) between 1 and 120),
  description    text not null default '' check (char_length(description) <= 4000),
  images         text[] not null default '{}' check (cardinality(images) <= 12),
  status         text not null default 'draft'
                 check (status in ('draft', 'published', 'archived')),
  -- leftover_liquid: эх үнэртэн, үлдсэн ба бүтэн савны хэмжээ.
  product_id     uuid references products(id),
  remaining_ml   int check (remaining_ml > 0),
  full_ml        int check (full_ml > 0),
  -- Зөвхөн дэлгэцийн утга (ж: хайрцагт `capacity`). Тооцоонд оролцохгүй.
  attrs          jsonb not null default '{}' check (jsonb_typeof(attrs) = 'object'),
  sort           int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, inventory_mode),
  foreign key (category_id, inventory_mode)
    references extra_categories (id, inventory_mode),
  check ((inventory_mode = 'leftover_liquid')
         = (product_id is not null and remaining_ml is not null
            and full_ml is not null)),
  check (remaining_ml is null or remaining_ml <= full_ml)
);
create index if not exists extra_products_category_idx
  on extra_products (category_id, sort) where status = 'published';
create index if not exists extra_products_product_idx
  on extra_products (product_id) where product_id is not null;

drop trigger if exists extra_products_updated_at on extra_products;
create trigger extra_products_updated_at
  before update on extra_products
  for each row execute function set_updated_at();

create table if not exists extra_variants (
  id             uuid primary key default gen_random_uuid(),
  extra_id       uuid not null,
  -- Бараанаас хуулна (trigger), дараа нь өөрчлөгдөхгүй.
  inventory_mode extra_inventory_mode_t not null,
  label          text not null default '' check (char_length(label) <= 60),
  price          int not null check (price between 0 and 10000000),
  on_hand_qty    int not null default 0 check (on_hand_qty >= 0),
  reserved_qty   int not null default 0 check (reserved_qty >= 0),
  vial_id        uuid references vials(id),
  is_active      boolean not null default true,
  sort           int not null default 0,
  updated_at     timestamptz not null default now(),
  foreign key (extra_id, inventory_mode)
    references extra_products (id, inventory_mode),
  check ((inventory_mode = 'shared_vial') = (vial_id is not null)),
  check (inventory_mode = 'shared_vial' or reserved_qty <= on_hand_qty),
  check (inventory_mode <> 'shared_vial'
         or (on_hand_qty = 0 and reserved_qty = 0)),
  check (inventory_mode <> 'leftover_liquid' or on_hand_qty <= 1),
  unique (id, extra_id, inventory_mode)
);
create unique index if not exists extra_variants_one_leftover
  on extra_variants (extra_id) where inventory_mode = 'leftover_liquid';
-- Давхар хувилбараас хамгаална (форм ч мөн шалгана).
create unique index if not exists extra_variants_label_uq
  on extra_variants (extra_id, lower(btrim(label)))
  where inventory_mode = 'local_quantity';
create unique index if not exists extra_variants_vial_uq
  on extra_variants (extra_id, vial_id) where inventory_mode = 'shared_vial';
create index if not exists extra_variants_extra_idx
  on extra_variants (extra_id, sort);

drop trigger if exists extra_variants_updated_at on extra_variants;
create trigger extra_variants_updated_at
  before update on extra_variants
  for each row execute function set_updated_at();

create table if not exists extra_movements (
  id               bigserial primary key,
  extra_variant_id uuid not null references extra_variants(id),
  kind             text not null check (kind in
                     ('set', 'reserve', 'release', 'commit', 'restock')),
  delta_on_hand    int not null default 0,
  delta_reserved   int not null default 0,
  order_item_id    uuid references order_items(id) on delete set null,
  -- `<order_item>:extra:<kind>:<cycle>`; restock нь буцаалтын түлхүүртэй.
  event_key        text unique,
  note             text not null default '',
  actor            uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists extra_movements_variant_idx
  on extra_movements (extra_variant_id, created_at desc);

------------------------------------------------------------------------------
-- 5. Үлдэгдэлтэй шилний шингэний түгжээ (§5.5)
--
-- Нэг үлдэгдэлтэй шил = нэг физик шил = НЭГ мөр (байнгын). Эх үнэртнийг
-- extra_products.product_id-аас уншина. Түгжээ нь inventory.reserved_ml-д
-- суудаг тул декант тэр ml-ийг зарахгүй.
------------------------------------------------------------------------------

create table if not exists leftover_liquid_locks (
  extra_product_id uuid primary key references extra_products(id),
  locked_ml        int not null check (locked_ml > 0),
  state            text not null
                   check (state in ('listed', 'reserved', 'committed', 'released')),
  order_item_id    uuid references order_items(id) on delete set null,
  updated_at       timestamptz not null default now(),
  -- `order_item_id`-ийг `set null` болгосон ч захиалгын мөр устах нь зөвхөн
  -- тест/reset — тэр үед ч check эвдрэхгүйн тулд committed нь мөргүй байж болно.
  check (state <> 'reserved' or order_item_id is not null),
  check (state not in ('listed', 'released') or order_item_id is null)
);

drop trigger if exists leftover_liquid_locks_updated_at on leftover_liquid_locks;
create trigger leftover_liquid_locks_updated_at
  before update on leftover_liquid_locks
  for each row execute function set_updated_at();

------------------------------------------------------------------------------
-- 6. Үнэртний цутгах сав (§5.3)
------------------------------------------------------------------------------

alter table products add column if not exists vial_style text
  check (vial_style in ('black', 'pink', 'silver'));
comment on column products.vial_style is
  'Декант цутгах савны өнгө. null = хүйсээр (эрэгтэй хар, эмэгтэй ягаан, '
  'unisex мөнгөлөг — default_vial_style).';

alter table product_variants add column if not exists bottle_override_style text
  check (bottle_override_style in ('black', 'pink', 'silver'));
comment on column product_variants.bottle_override_style is
  'Тоон горимд (vial_inventory) bottle_override асаалттай үед орлох савны өнгө.';

------------------------------------------------------------------------------
-- 7. Бүтцийн хамгаалалт (trigger)
------------------------------------------------------------------------------

-- Горимыг эцгээс нь хуулж, дараа нь өөрчлөхийг хориглоно.
create or replace function extra_products_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    select inventory_mode into new.inventory_mode
      from extra_categories where id = new.category_id;
    return new;
  end if;
  if new.category_id is distinct from old.category_id
     or new.inventory_mode is distinct from old.inventory_mode then
    raise exception 'EXTRA_MODE_IMMUTABLE' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists extra_products_guard on extra_products;
create trigger extra_products_guard
  before insert or update on extra_products
  for each row execute function extra_products_guard();

create or replace function extra_variants_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    select inventory_mode into new.inventory_mode
      from extra_products where id = new.extra_id;
    -- Нөөц 0-ээс эхэлж, `set` хөдөлгөөнөөр л нэмэгдэнэ.
    if (new.on_hand_qty <> 0 or new.reserved_qty <> 0)
       and coalesce(current_setting('vonscent.stock_move', true), '') <> '1' then
      raise exception 'STOCK_WRITE_FORBIDDEN' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if new.extra_id is distinct from old.extra_id
     or new.inventory_mode is distinct from old.inventory_mode then
    raise exception 'EXTRA_MODE_IMMUTABLE' using errcode = 'check_violation';
  end if;
  if new.vial_id is distinct from old.vial_id then
    -- Сав солих = өөр бараа. Хуучныг идэвхгүй болгоод шинэ хувилбар нэм.
    raise exception 'EXTRA_VIAL_IMMUTABLE' using errcode = 'check_violation';
  end if;
  if (new.on_hand_qty, new.reserved_qty) is distinct from
       (old.on_hand_qty, old.reserved_qty)
     and coalesce(current_setting('vonscent.stock_move', true), '') <> '1' then
    raise exception 'STOCK_WRITE_FORBIDDEN' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists extra_variants_guard on extra_variants;
create trigger extra_variants_guard
  before insert or update on extra_variants
  for each row execute function extra_variants_guard();

create or replace function vials_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if (new.on_hand is not null or new.reserved <> 0)
       and coalesce(current_setting('vonscent.stock_move', true), '') <> '1' then
      raise exception 'STOCK_WRITE_FORBIDDEN' using errcode = 'check_violation';
    end if;
    return new;
  end if;
  if (new.style, new.ml) is distinct from (old.style, old.ml) then
    raise exception 'VIAL_IMMUTABLE' using errcode = 'check_violation';
  end if;
  if (new.on_hand, new.reserved) is distinct from (old.on_hand, old.reserved)
     and coalesce(current_setting('vonscent.stock_move', true), '') <> '1' then
    raise exception 'STOCK_WRITE_FORBIDDEN' using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists vials_guard on vials;
create trigger vials_guard
  before insert or update on vials
  for each row execute function vials_guard();

-- Устгахгүй, архивлана (service role RLS-ийг тойрдог тул бодлого хангалтгүй).
-- Хөдөлгөөн, захиалгын мөр, түгжээ эдгээрийг заадаг.
create or replace function extras_forbid_delete()
returns trigger language plpgsql as $$
begin
  raise exception 'EXTRA_DELETE_FORBIDDEN:%', tg_table_name
    using errcode = 'check_violation';
end $$;

drop trigger if exists extra_categories_no_delete on extra_categories;
create trigger extra_categories_no_delete
  before delete on extra_categories
  for each row execute function extras_forbid_delete();
drop trigger if exists extra_products_no_delete on extra_products;
create trigger extra_products_no_delete
  before delete on extra_products
  for each row execute function extras_forbid_delete();
drop trigger if exists extra_variants_no_delete on extra_variants;
create trigger extra_variants_no_delete
  before delete on extra_variants
  for each row execute function extras_forbid_delete();
drop trigger if exists vials_no_delete on vials;
create trigger vials_no_delete
  before delete on vials
  for each row execute function extras_forbid_delete();
drop trigger if exists leftover_liquid_locks_no_delete on leftover_liquid_locks;
create trigger leftover_liquid_locks_no_delete
  before delete on leftover_liquid_locks
  for each row execute function extras_forbid_delete();

------------------------------------------------------------------------------
-- 8. Нөөцийн хөдөлгөөн — тоо өөрчлөх ЦОРЫН ГАНЦ зам
--
-- Дуудагч мөрийг аль хэдийн `for update` түгжсэн байна. `event_key` давхардвал
-- (ижил үйл явдал дахин ирсэн) юу ч өөрчлөхгүй, false буцаана — idempotent.
-- Тоо сөрөг болох, reserve нөөцөөс хэтрэх нь хүснэгтийн check-т бүдэрнэ.
------------------------------------------------------------------------------

create or replace function extra_stock_move(
  p_variant uuid,
  p_kind text,
  p_delta_on_hand int,
  p_delta_reserved int,
  p_event_key text default null,
  p_order_item uuid default null,
  p_note text default '',
  p_actor uuid default null
)
returns boolean language plpgsql as $$
declare
  v_id bigint;
begin
  insert into extra_movements (extra_variant_id, kind, delta_on_hand,
    delta_reserved, order_item_id, event_key, note, actor)
  values (p_variant, p_kind, p_delta_on_hand, p_delta_reserved, p_order_item,
    p_event_key, coalesce(p_note, ''), p_actor)
  on conflict (event_key) do nothing
  returning id into v_id;
  if v_id is null then
    return false;
  end if;
  if p_delta_on_hand <> 0 or p_delta_reserved <> 0 then
    perform set_config('vonscent.stock_move', '1', true);
    update extra_variants
       set on_hand_qty = on_hand_qty + p_delta_on_hand,
           reserved_qty = reserved_qty + p_delta_reserved
     where id = p_variant;
    perform set_config('vonscent.stock_move', '', true);
  end if;
  return true;
end $$;

create or replace function vial_stock_move(
  p_vial uuid,
  p_kind text,
  p_delta_on_hand int,
  p_delta_reserved int,
  p_event_key text default null,
  p_order_item uuid default null,
  p_note text default '',
  p_actor uuid default null
)
returns boolean language plpgsql as $$
declare
  v_id bigint;
  v_counted boolean;
  v_delta_on_hand int := p_delta_on_hand;
begin
  select on_hand is not null into v_counted from vials where id = p_vial;
  -- Тоолж эхлээгүй (null) савны on_hand хэвээр null — commit нь зөвхөн
  -- reserved-ийг бууруулна, хөдөлгөөнд ч 0 гэж бичнэ. Ингэснээр
  -- «Σ delta_on_hand = coalesce(on_hand, 0)» тоолж эхэлсний дараа ч үнэн.
  -- Тоолж эхлэх `set` нь null-ийг 0 гэж үзнэ.
  if not v_counted and p_kind <> 'set' then
    v_delta_on_hand := 0;
  end if;
  insert into vial_movements (vial_id, kind, delta_on_hand, delta_reserved,
    order_item_id, event_key, note, actor)
  values (p_vial, p_kind, v_delta_on_hand, p_delta_reserved, p_order_item,
    p_event_key, coalesce(p_note, ''), p_actor)
  on conflict (event_key) do nothing
  returning id into v_id;
  if v_id is null then
    return false;
  end if;
  if v_delta_on_hand <> 0 or p_delta_reserved <> 0 or p_kind = 'set' then
    perform set_config('vonscent.stock_move', '1', true);
    update vials
       set on_hand = case
             when on_hand is null and p_kind <> 'set' then null
             else coalesce(on_hand, 0) + v_delta_on_hand end,
           reserved = reserved + p_delta_reserved
     where id = p_vial;
    perform set_config('vonscent.stock_move', '', true);
  end if;
  return true;
end $$;

------------------------------------------------------------------------------
-- 9. Савны дүрэм
------------------------------------------------------------------------------

-- ⚠ src/lib/vials.ts-ийн `defaultVialStyle`-тэй таарах ёстой.
create or replace function default_vial_style(p_gender gender_t)
returns text language sql immutable parallel safe as $$
  select case p_gender
    when 'male' then 'black'
    when 'female' then 'pink'
    else 'silver'
  end;
$$;

-- Хэрэгтэй савны мөр. 1ml, 2ml өнгөгүй.
create or replace function vial_for(p_style text, p_ml int)
returns uuid language sql stable as $$
  select v.id from vials v
   where v.ml = p_ml
     and (case when p_ml <= 2 then v.style is null else v.style = p_style end);
$$;

-- Нэг ширхэг зарж болох уу. Тоолж эхлээгүй бол хязгааргүй.
create or replace function vial_available(p_vial uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select v.is_active and (v.on_hand is null or v.on_hand - v.reserved > 0)
       from vials v where v.id = p_vial),
    false);
$$;

-- Зарж болох тоо. null = хязгааргүй (тоолж эхлээгүй), идэвхгүй бол 0.
create or replace function vial_available_qty(p_vial uuid)
returns int language sql stable security definer set search_path = public as $$
  select case
    when not v.is_active then 0
    when v.on_hand is null then null
    else greatest(v.on_hand - v.reserved, 0)
  end
  from vials v where v.id = p_vial;
$$;

revoke all on function vial_available(uuid) from public;
grant execute on function vial_available(uuid) to anon, authenticated, service_role;
revoke all on function vial_available_qty(uuid) from public;
grant execute on function vial_available_qty(uuid) to anon, authenticated, service_role;

do $$
declare
  f text;
begin
  foreach f in array array[
    'extra_stock_move(uuid, text, int, int, text, uuid, text, uuid)',
    'vial_stock_move(uuid, text, int, int, text, uuid, text, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

------------------------------------------------------------------------------
-- 10. RLS
--
-- Нийтийн унших: туг асаалттай, бараа `published`, ангилал идэвхтэй.
-- Хувилбар эцгээрээ (subquery-д extra_products-ийн RLS үйлчилнэ).
-- Бичих бодлого байхгүй — админ API service role + RPC-ээр бичнэ.
-- Сав, хөдөлгөөн, түгжээ зөвхөн ажилтан.
------------------------------------------------------------------------------

alter table extra_categories enable row level security;
alter table extra_products enable row level security;
alter table extra_variants enable row level security;
alter table extra_movements enable row level security;
alter table vials enable row level security;
alter table vial_movements enable row level security;
alter table leftover_liquid_locks enable row level security;

drop policy if exists "extra categories read" on extra_categories;
create policy "extra categories read" on extra_categories for select
  using ((is_active and feature_enabled('extras_shop')) or is_staff());

drop policy if exists "extra products read" on extra_products;
create policy "extra products read" on extra_products for select
  using (
    (status = 'published'
     and feature_enabled('extras_shop')
     and exists (select 1 from extra_categories c
                  where c.id = category_id and c.is_active))
    or is_staff()
  );

drop policy if exists "extra variants read" on extra_variants;
create policy "extra variants read" on extra_variants for select
  using (
    (is_active and exists (select 1 from extra_products p where p.id = extra_id))
    or is_staff()
  );

drop policy if exists "extra movements staff" on extra_movements;
create policy "extra movements staff" on extra_movements for select
  using (is_staff());
drop policy if exists "vials staff" on vials;
create policy "vials staff" on vials for select using (is_staff());
drop policy if exists "vial movements staff" on vial_movements;
create policy "vial movements staff" on vial_movements for select
  using (is_staff());
drop policy if exists "leftover locks staff" on leftover_liquid_locks;
create policy "leftover locks staff" on leftover_liquid_locks for select
  using (is_staff());

grant select on extra_categories, extra_products, extra_variants
  to anon, authenticated;
grant select on extra_movements, vials, vial_movements, leftover_liquid_locks
  to authenticated;

revoke all on function extra_products_guard() from public, anon, authenticated;
revoke all on function extra_variants_guard() from public, anon, authenticated;
revoke all on function vials_guard() from public, anon, authenticated;
revoke all on function extras_forbid_delete() from public, anon, authenticated;
