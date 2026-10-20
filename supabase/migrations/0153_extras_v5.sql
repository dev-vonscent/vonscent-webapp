-- Нэмэлт бараа v5 — клиентийн нэмэлт шаардлага (extras-shop-plan §18; PR11).
-- Feature flag: `extras_shop`, `vial_inventory` (хаалттай хэвээр).
--
-- 0145–0152 prod-д хараахан ороогүй тул нэмэлт барааны хүснэгтийн хуучин
-- бүтцийг (ангиллын `inventory_mode`, түүний composite FK) энд шууд устгана —
-- prod-ийн хуучин код тэдгээрийг уншдаггүй (§18.3). Prod-ийн одоогийн кодын
-- ашигладаг зүйл (`restock_log`, `orders`) зөвхөн expand: nullable/default-тай
-- багана.
--
--   1. Ангилал ↔ горим: `extra_category_modes` (горим тус бүрийн анхааруулга,
--      хэрэглэсэн барааны зөвшөөрөл). 6 → 5 ангилал: «Шилтэй ус» хоёр горимтой,
--      «Брэндийн уут, сав» → «Гоёмсог бэлгийн сав».
--   2. Хувилбарын шинэ талбар: batch code, зураг, чөлөөт хэмжээ.
--   3. Худалдан авалтын ledger: `purchase` (ширхэг × нэгж үнэ, авсан өдөр),
--      `adjust` (тооллогын залруулга, өртөггүй). Шинэ барааны анхны нөөц 0 —
--      нөөц зөвхөн purchase-аар орно, өртөггүй анхны `set` арилна.
--   4. 1ml, 2ml савыг дангаар зарахгүй (perfume/бэлгийн дээжийн reserve хэвээр).
--   5. `restock_log.purchased_on` (УБ календарийн өдөр), `orders.used_goods_consent_at`.

------------------------------------------------------------------------------
-- 1. Ангилал ↔ зөвшөөрөгдсөн нөөцийн горим
------------------------------------------------------------------------------

create table if not exists extra_category_modes (
  category_id      uuid not null references extra_categories(id),
  inventory_mode   extra_inventory_mode_t not null,
  -- Барааны хуудсанд «Сагсанд нэмэх»-ийн дээр гарах анхааруулга.
  notice           text not null default '' check (char_length(notice) <= 1000),
  -- Checkout дээр хэрэглэсэн барааны зөвшөөрөл заавал (§18.5).
  requires_consent boolean not null default false,
  primary key (category_id, inventory_mode)
);

comment on table extra_category_modes is
  'Ангилалд зөвшөөрөгдсөн нөөцийн горим. extra_products(category_id, '
  'inventory_mode) энд FK-тай. Анхааруулга, зөвшөөрөл горим тус бүрт — '
  '«Шилтэй ус»-ны бүтэн шилэнд аль аль нь хэрэггүй (§18.1 №7).';

-- Хуучин баганаас backfill (дахин ажиллахад багана байхгүй — алгасна).
do $$
begin
  if exists (select 1 from information_schema.columns
              where table_name = 'extra_categories'
                and column_name = 'inventory_mode') then
    execute 'insert into extra_category_modes (category_id, inventory_mode)
             select id, inventory_mode from extra_categories
             on conflict do nothing';
  end if;
end $$;

------------------------------------------------------------------------------
-- 2. Барааны guard — горимыг ангиллын холбоосоос; ангилал солихыг зөвхөн
--    migration (`vonscent.recategorize`) зөвшөөрнө
------------------------------------------------------------------------------

create or replace function extra_products_guard()
returns trigger language plpgsql as $$
declare
  v_modes extra_inventory_mode_t[];
begin
  if tg_op = 'INSERT' then
    -- Горим ирээгүй бол ангилал ганц горимтой үед л түүнийг авна. Олон
    -- горимтой ангилалд (`bottled`) заавал ирнэ. Зөвшөөрөгдсөн эсэхийг FK.
    if new.inventory_mode is null then
      select array_agg(inventory_mode) into v_modes
        from extra_category_modes where category_id = new.category_id;
      if cardinality(v_modes) = 1 then
        new.inventory_mode := v_modes[1];
      else
        raise exception 'EXTRA_MODE_REQUIRED' using errcode = 'check_violation';
      end if;
    end if;
    return new;
  end if;
  if new.inventory_mode is distinct from old.inventory_mode
     or (new.category_id is distinct from old.category_id
         and coalesce(current_setting('vonscent.recategorize', true), '') <> '1') then
    raise exception 'EXTRA_MODE_IMMUTABLE' using errcode = 'check_violation';
  end if;
  return new;
end $$;

------------------------------------------------------------------------------
-- 3. 6 → 5 ангилал
------------------------------------------------------------------------------

update extra_categories set slug = 'bottled', name = 'Шилтэй ус'
 where slug = 'leftover';
update extra_categories set name = 'Гоёмсог бэлгийн сав'
 where slug = 'gift-box';

insert into extra_category_modes (category_id, inventory_mode)
select id, 'local_quantity' from extra_categories where slug = 'bottled'
on conflict do nothing;

-- «Брэндийн уут, сав»-ын бараа → «Гоёмсог бэлгийн сав». Горим ижил
-- (local_quantity), id хэвээр — захиалгын мөрийн snapshot хөндөгдөхгүй.
do $$
declare
  v_from uuid := (select id from extra_categories where slug = 'brand-pouch');
  v_to   uuid := (select id from extra_categories where slug = 'gift-box');
begin
  if v_from is not null and v_to is not null then
    perform set_config('vonscent.recategorize', '1', true);
    update extra_products set category_id = v_to where category_id = v_from;
    perform set_config('vonscent.recategorize', '', true);
    update extra_categories set is_active = false where id = v_from;
  end if;
end $$;

-- Горим тус бүрийн анхааруулга, зөвшөөрөл (§18.5). Монгол текст шалгагдсан.
update extra_category_modes m set
  notice = 'Ихэнх үнэртэй усанд тохирдог ч Baccarat Rouge зэрэг зарим '
           'үнэртэй усны шүршигчийн хоолойд таардаггүй. Захиалахаасаа өмнө аль '
           'үнэртэй усанд хэрэглэхээ Facebook, Instagram, утас эсвэл сайтын '
           'чатаар лавлана уу. Лавлалгүй авч, таараагүй тохиолдолд буцаах '
           'боломжгүй.'
  from extra_categories c
 where c.id = m.category_id and c.slug = 'syringe' and m.notice = '';

update extra_category_modes m set
  notice = 'Шилнээс гаргаж хэмжээд буцааж хийх боломжгүй тул заасан '
           'хэмжээнээс ±1–2ml зөрүүтэй байж болно.',
  requires_consent = true
  from extra_categories c
 where c.id = m.category_id and c.slug = 'bottled'
   and m.inventory_mode = 'leftover_liquid' and m.notice = '';

update extra_category_modes m set requires_consent = true
  from extra_categories c
 where c.id = m.category_id and c.slug = 'empty-bottle';

------------------------------------------------------------------------------
-- 4. Бараа → ангилал+горим FK, хуучин ангиллын горимыг устгах
------------------------------------------------------------------------------

do $$
declare
  v_name text;
begin
  -- 0145-ийн (category_id, inventory_mode) → extra_categories(id, inventory_mode)
  select con.conname into v_name
    from pg_constraint con
   where con.conrelid = 'extra_products'::regclass
     and con.contype = 'f'
     and con.confrelid = 'extra_categories'::regclass
     and cardinality(con.conkey) = 2;
  if v_name is not null then
    execute format('alter table extra_products drop constraint %I', v_name);
  end if;
end $$;

do $$
begin
  alter table extra_products add constraint extra_products_category_mode_fk
    foreign key (category_id, inventory_mode)
    references extra_category_modes (category_id, inventory_mode);
exception when duplicate_object then null;
end $$;

alter table extra_categories drop column if exists inventory_mode;

comment on table extra_categories is
  'Нэмэлт барааны ангилал. Зөвшөөрөгдсөн нөөцийн горим extra_category_modes-д; '
  'шинэ ангилал = migration (seed), шинэ горим = enum + SQL + админ + checkout.';

alter table extra_category_modes enable row level security;
drop policy if exists "extra category modes read" on extra_category_modes;
create policy "extra category modes read" on extra_category_modes for select
  using (exists (select 1 from extra_categories c where c.id = category_id));
grant select on extra_category_modes to anon, authenticated;

drop trigger if exists extra_category_modes_no_delete on extra_category_modes;
create trigger extra_category_modes_no_delete
  before delete on extra_category_modes
  for each row execute function extras_forbid_delete();

------------------------------------------------------------------------------
-- 5. Хувилбарын шинэ талбар; 1ml/2ml сав дангаар зарагдахгүй
------------------------------------------------------------------------------

alter table extra_variants
  add column if not exists batch_code text
    check (char_length(batch_code) <= 60),
  add column if not exists image_url text,
  add column if not exists size_note text
    check (char_length(size_note) <= 300);

comment on column extra_variants.batch_code is
  'Хоосон/бүтэн шилний batch code. Ижил code-той ширхэг нэг хувилбарт тоогоороо.';
comment on column extra_variants.size_note is
  'Чөлөөт хэмжээ/тохирох тайлбар («8×5×4см · 20ml-ийн өндөр саванд тохирохгүй»).';

-- Одоо байгаа 1/2ml-ийн дангаар зарах хувилбарыг хаана (0147 2ml-ийг
-- зөвшөөрдөг байсан). Guard-аас өмнө — guard идэвхтэйг хориглоно.
update extra_variants ev set is_active = false
  from vials v
 where v.id = ev.vial_id and v.ml in (1, 2) and ev.is_active;

create or replace function extra_variants_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    select inventory_mode into new.inventory_mode
      from extra_products where id = new.extra_id;
    -- Нөөц 0-ээс эхэлж, хөдөлгөөнөөр (purchase г.м.) л нэмэгдэнэ.
    if (new.on_hand_qty <> 0 or new.reserved_qty <> 0)
       and coalesce(current_setting('vonscent.stock_move', true), '') <> '1' then
      raise exception 'STOCK_WRITE_FORBIDDEN' using errcode = 'check_violation';
    end if;
  else
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
  end if;
  -- 1ml (бэлгийн дээж), 2ml (үнэртний декант) сав дангаар зарагдахгүй (§18.1 №2).
  if new.vial_id is not null and new.is_active
     and (select ml from vials where id = new.vial_id) not in (5, 10, 20) then
    raise exception 'VIAL_NOT_SELLABLE' using errcode = 'check_violation';
  end if;
  return new;
end $$;

------------------------------------------------------------------------------
-- 6. Худалдан авалтын ledger (§18.3)
--
-- `purchase`: +N ширхэг, нэгж үнэ, нийт = N × нэгж, авсан өдөр (УБ). Тайлангийн
-- худалдан авалтын эх сурвалж нь энэ мөрийн `cost` — variant дээр давхар
-- хадгалахгүй. `adjust`: тооллогын залруулга, өртөггүй. Хуучин `set` түүх хэвээр.
------------------------------------------------------------------------------

alter table extra_movements
  add column if not exists unit_cost int check (unit_cost >= 0),
  add column if not exists cost bigint check (cost >= 0),
  add column if not exists purchased_on date;
alter table vial_movements
  add column if not exists unit_cost int check (unit_cost >= 0),
  add column if not exists cost bigint check (cost >= 0),
  add column if not exists purchased_on date;

alter table extra_movements drop constraint if exists extra_movements_kind_check;
alter table extra_movements add constraint extra_movements_kind_check
  check (kind in ('set', 'purchase', 'adjust', 'reserve', 'release', 'commit', 'restock'));
alter table vial_movements drop constraint if exists vial_movements_kind_check;
alter table vial_movements add constraint vial_movements_kind_check
  check (kind in ('set', 'purchase', 'adjust', 'reserve', 'release', 'commit', 'restock'));

alter table extra_movements drop constraint if exists extra_movements_purchase_chk;
alter table extra_movements add constraint extra_movements_purchase_chk check (
  case when kind = 'purchase'
       then delta_on_hand > 0 and delta_reserved = 0
            and unit_cost is not null and purchased_on is not null
            and cost = delta_on_hand::bigint * unit_cost
       else unit_cost is null and cost is null and purchased_on is null
  end);
alter table vial_movements drop constraint if exists vial_movements_purchase_chk;
alter table vial_movements add constraint vial_movements_purchase_chk check (
  case when kind = 'purchase'
       then delta_on_hand > 0 and delta_reserved = 0
            and unit_cost is not null and purchased_on is not null
            and cost = delta_on_hand::bigint * unit_cost
       else unit_cost is null and cost is null and purchased_on is null
  end);

create index if not exists extra_movements_purchase_idx
  on extra_movements (purchased_on) where kind = 'purchase';
create index if not exists vial_movements_purchase_idx
  on vial_movements (purchased_on) where kind = 'purchase';

-- Хөдөлгөөний функцэд өртөг нэмэгдэнэ. Хуучин 8 аргументтай хувилбарыг drop —
-- үлдвэл 8 аргументтай дуудлага (0149) хоёр overload-ын хооронд эргэлзэнэ.
-- Шинэ параметрүүд default-тай тул одоогийн дуудлага хэвээр ажиллана.
drop function if exists extra_stock_move(uuid, text, int, int, text, uuid, text, uuid);
drop function if exists vial_stock_move(uuid, text, int, int, text, uuid, text, uuid);

create or replace function extra_stock_move(
  p_variant uuid,
  p_kind text,
  p_delta_on_hand int,
  p_delta_reserved int,
  p_event_key text default null,
  p_order_item uuid default null,
  p_note text default '',
  p_actor uuid default null,
  p_unit_cost int default null,
  p_purchased_on date default null
)
returns boolean language plpgsql as $$
declare
  v_id bigint;
begin
  insert into extra_movements (extra_variant_id, kind, delta_on_hand,
    delta_reserved, order_item_id, event_key, note, actor,
    unit_cost, cost, purchased_on)
  values (p_variant, p_kind, p_delta_on_hand, p_delta_reserved, p_order_item,
    p_event_key, coalesce(p_note, ''), p_actor,
    p_unit_cost, p_delta_on_hand::bigint * p_unit_cost, p_purchased_on)
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
  p_actor uuid default null,
  p_unit_cost int default null,
  p_purchased_on date default null
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
  -- Тоолж эхлэх `set` нь null-ийг 0 гэж үзнэ. Purchase-ийг дуудагч
  -- (`vial_purchase`) тоолж эхлээгүй үед татгалздаг.
  if not v_counted and p_kind <> 'set' then
    if p_kind = 'purchase' then
      raise exception 'STOCK_NOT_COUNTED' using errcode = 'check_violation';
    end if;
    v_delta_on_hand := 0;
  end if;
  insert into vial_movements (vial_id, kind, delta_on_hand, delta_reserved,
    order_item_id, event_key, note, actor, unit_cost, cost, purchased_on)
  values (p_vial, p_kind, v_delta_on_hand, p_delta_reserved, p_order_item,
    p_event_key, coalesce(p_note, ''), p_actor,
    p_unit_cost, v_delta_on_hand::bigint * p_unit_cost, p_purchased_on)
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

-- Авсан өдөр: УБ календарийн одоогийн сарын 1-нээс өнөөдөр хүртэл. Өмнөх сар
-- хаагдсан — тайлан нь хожим өөрчлөгдөхгүй (0111-ийн зарчим).
create or replace function purchase_date_check(p_date date)
returns date language plpgsql stable as $$
declare
  v_today date := (now() at time zone 'Asia/Ulaanbaatar')::date;
  v_date date := coalesce(p_date, v_today);
begin
  if v_date > v_today then
    raise exception 'PURCHASE_DATE_FUTURE' using errcode = 'check_violation';
  end if;
  if v_date < date_trunc('month', v_today)::date then
    raise exception 'PURCHASE_DATE_CLOSED' using errcode = 'check_violation';
  end if;
  return v_date;
end $$;

-- Тоо, нэгж үнийн хүрээ — validator-тай ижил (src/lib/validators/extras.ts).
create or replace function purchase_args_check(p_qty int, p_unit_cost int)
returns void language plpgsql immutable as $$
begin
  if p_qty is null or p_qty < 1 or p_qty > 100000 then
    raise exception 'PURCHASE_QTY_INVALID' using errcode = 'check_violation';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 or p_unit_cost > 10000000 then
    raise exception 'PURCHASE_COST_INVALID' using errcode = 'check_violation';
  end if;
end $$;

------------------------------------------------------------------------------
-- 7. Нэмэлт бараа: нөөц нөхөх (purchase), тоо засах (adjust)
------------------------------------------------------------------------------

create or replace function extras_purchase(
  p_variant uuid,
  p_qty int,
  p_unit_cost int,
  p_purchased_on date,
  p_expected_updated_at timestamptz,
  p_note text,
  p_by uuid
)
returns jsonb language plpgsql as $$
declare
  v extra_variants;
  v_date date;
begin
  perform purchase_args_check(p_qty, p_unit_cost);
  v_date := purchase_date_check(p_purchased_on);
  select * into v from extra_variants where id = p_variant for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'check_violation';
  end if;
  -- Сав нь `vials`-аас, үлдэгдэлтэй шил эх үнэртнээс — энд зөвхөн энгийн бараа.
  if v.inventory_mode <> 'local_quantity' then
    raise exception 'STOCK_NOT_LOCAL' using errcode = 'check_violation';
  end if;
  if p_expected_updated_at is not null
     and date_trunc('milliseconds', p_expected_updated_at)
         is distinct from date_trunc('milliseconds', v.updated_at) then
    return jsonb_build_object('ok', false, 'reason', 'STALE',
      'on_hand', v.on_hand_qty, 'reserved', v.reserved_qty,
      'updated_at', v.updated_at);
  end if;
  perform extra_stock_move(p_variant, 'purchase', p_qty, 0, null, null,
    coalesce(p_note, ''), p_by, p_unit_cost, v_date);
  select * into v from extra_variants where id = p_variant;
  return jsonb_build_object('ok', true, 'on_hand', v.on_hand_qty,
    'reserved', v.reserved_qty, 'updated_at', v.updated_at);
end $$;

-- «Тоо засах» (0147) — тооллогын залруулга: одоо `adjust`, өртөггүй.
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
    perform extra_stock_move(p_variant, 'adjust', p_on_hand - v.on_hand_qty, 0,
      null, null, coalesce(p_note, ''), p_by);
  end if;
  select * into v from extra_variants where id = p_variant;
  return jsonb_build_object('ok', true, 'on_hand', v.on_hand_qty,
    'reserved', v.reserved_qty, 'updated_at', v.updated_at);
end $$;

------------------------------------------------------------------------------
-- 8. Сав: эхний тооллого (`set`), тоо засах (`adjust`), нөөц нөхөх (purchase)
------------------------------------------------------------------------------

create or replace function set_vial_count(
  p_vial uuid,
  p_count int,
  p_expected_updated_at timestamptz,
  p_note text,
  p_by uuid
) returns jsonb language plpgsql as $$
declare
  v vials;
begin
  select * into v from vials where id = p_vial for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'check_violation';
  end if;
  if p_expected_updated_at is not null
     and date_trunc('milliseconds', p_expected_updated_at)
         is distinct from date_trunc('milliseconds', v.updated_at) then
    return jsonb_build_object('ok', false, 'reason', 'STALE',
      'on_hand', v.on_hand, 'reserved', v.reserved, 'updated_at', v.updated_at);
  end if;
  if p_count is null or p_count < v.reserved then
    return jsonb_build_object('ok', false, 'reason', 'BELOW_RESERVED',
      'on_hand', v.on_hand, 'reserved', v.reserved, 'updated_at', v.updated_at);
  end if;
  if v.on_hand is distinct from p_count then
    -- Эхний тооллого = нээлтийн үлдэгдэл (`set`); дараагийнх нь залруулга.
    perform vial_stock_move(p_vial,
      case when v.on_hand is null then 'set' else 'adjust' end,
      p_count - coalesce(v.on_hand, 0), 0, null, null, coalesce(p_note, ''), p_by);
  end if;
  update vials set updated_by = p_by where id = p_vial;
  select * into v from vials where id = p_vial;
  return jsonb_build_object('ok', true, 'on_hand', v.on_hand,
    'reserved', v.reserved, 'updated_at', v.updated_at);
end $$;

create or replace function vial_purchase(
  p_vial uuid,
  p_qty int,
  p_unit_cost int,
  p_purchased_on date,
  p_expected_updated_at timestamptz,
  p_note text,
  p_by uuid
) returns jsonb language plpgsql as $$
declare
  v vials;
  v_date date;
begin
  perform purchase_args_check(p_qty, p_unit_cost);
  v_date := purchase_date_check(p_purchased_on);
  select * into v from vials where id = p_vial for update;
  if not found then
    raise exception 'NOT_FOUND' using errcode = 'check_violation';
  end if;
  -- Тодорхойгүй хуучин үлдэгдэл дээр нэмбэл нийт тоо худал болно (§18.3).
  if v.on_hand is null then
    raise exception 'STOCK_NOT_COUNTED' using errcode = 'check_violation';
  end if;
  if p_expected_updated_at is not null
     and date_trunc('milliseconds', p_expected_updated_at)
         is distinct from date_trunc('milliseconds', v.updated_at) then
    return jsonb_build_object('ok', false, 'reason', 'STALE',
      'on_hand', v.on_hand, 'reserved', v.reserved, 'updated_at', v.updated_at);
  end if;
  perform vial_stock_move(p_vial, 'purchase', p_qty, 0, null, null,
    coalesce(p_note, ''), p_by, p_unit_cost, v_date);
  update vials set updated_by = p_by where id = p_vial;
  select * into v from vials where id = p_vial;
  return jsonb_build_object('ok', true, 'on_hand', v.on_hand,
    'reserved', v.reserved, 'updated_at', v.updated_at);
end $$;

------------------------------------------------------------------------------
-- 9. extras_save (0147) — горимыг ангиллын холбоосоос, анхны нөөц 0,
--    хувилбарын шинэ талбар, 1/2ml сав хориотой
--
-- p_payload:
--   { id?, category_id (шинэд), inventory_mode (олон горимтой ангилалд заавал),
--     slug, name, description, images[], attrs{}, sort,
--     leftover?: { product_id, remaining_ml, full_ml },
--     variants: [{ id?, label, price, is_active, sort, vial_id?,
--                  batch_code?, image_url?, size_note? }] }
------------------------------------------------------------------------------

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
      -- Үлдэгдэлтэй шил = нэг физик шил. Шингэний өртөг эх савны худалдан
      -- авалтаар аль хэдийн зарлага болсон тул энд өртөггүй (§18.2).
      if v_mode = 'leftover_liquid' then
        perform extra_stock_move(v_var_id, 'set', 1, 0, null, null,
          'Анхны тоо', p_by);
      end if;
    else
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

------------------------------------------------------------------------------
-- 10. Prod-ийн одоогийн хүснэгтүүд — зөвхөн expand
------------------------------------------------------------------------------

-- Үнэртний худалдан авалтын business date (УБ). `created_at::date` нь UTC —
-- УБ-ын 00:00–08:00-д бүртгэсэн мөрийг өмнөх өдөр рүү шилжүүлнэ (§18.6).
-- Default-тай тул prod-ийн хуучин `restock_inventory` өөрчлөлтгүй ажиллана.
alter table restock_log add column if not exists purchased_on date;
update restock_log
   set purchased_on = (created_at at time zone 'Asia/Ulaanbaatar')::date
 where purchased_on is null;
alter table restock_log alter column purchased_on
  set default ((now() at time zone 'Asia/Ulaanbaatar')::date);
alter table restock_log alter column purchased_on set not null;

alter table orders add column if not exists used_goods_consent_at timestamptz;
comment on column orders.used_goods_consent_at is
  'Хэрэглэсэн барааны нөхцөлийг (хоосон шил, үлдэгдэлтэй шил) зөвшөөрсөн цаг.';

------------------------------------------------------------------------------
-- 11. Эрх — зөвхөн service role
------------------------------------------------------------------------------

do $$
declare
  f text;
begin
  foreach f in array array[
    'extra_stock_move(uuid, text, int, int, text, uuid, text, uuid, int, date)',
    'vial_stock_move(uuid, text, int, int, text, uuid, text, uuid, int, date)',
    'purchase_date_check(date)',
    'purchase_args_check(int, int)',
    'extras_purchase(uuid, int, int, date, timestamptz, text, uuid)',
    'extras_set_stock(uuid, int, timestamptz, text, uuid)',
    'set_vial_count(uuid, int, timestamptz, text, uuid)',
    'vial_purchase(uuid, int, int, date, timestamptz, text, uuid)',
    'extras_save(jsonb, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

revoke all on function extra_products_guard() from public, anon, authenticated;
revoke all on function extra_variants_guard() from public, anon, authenticated;
