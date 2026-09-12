-- Collections (Багц) — base + custom bundles (collection-requirement.md §5).
--
-- A collection groups 4+ perfumes sold at one bundle-wide ml with a % discount,
-- plus a free bonus gift the buyer picks. Two kinds share one table:
--   type='base'   — admin-made, user_id NULL, exactly 4 members, public.
--   type='custom' — a saved user bundle (≥4 members), user_id = owner.
-- Ephemeral custom bundles (built in the cart, never saved) create no rows here.
--
-- Schema only. Checkout wiring (place_order threading collection_id / is_gift,
-- proportional discount across member lines) lands in the checkout phase; the
-- columns default to NULL/false so existing order flow is unaffected.

do $$ begin
  create type collection_type_t as enum ('base', 'custom');
exception when duplicate_object then null; end $$;

create table if not exists collections (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  type          collection_type_t not null default 'base',
  -- NULL = base (admin). Set = a customer's saved custom bundle.
  user_id       uuid references profiles(id) on delete cascade,
  name          text not null,
  gender        gender_t not null default 'unisex',
  description   text default '',
  -- % off the sum of member prices (₮ discount is out of scope — % only).
  discount_pct  numeric(5,2) not null default 5 check (discount_pct >= 0 and discount_pct <= 100),
  image_url     text,
  -- Free-gift size override; NULL falls back to settings.collection.giftMl.
  gift_ml       int check (gift_ml is null or gift_ml > 0),
  is_active     boolean not null default true,
  is_featured   boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists collections_type_active_idx on collections (type, is_active);
create index if not exists collections_user_idx on collections (user_id);
create index if not exists collections_featured_idx on collections (is_featured) where is_featured;

create trigger collections_updated_at
  before update on collections
  for each row execute function set_updated_at();

-- Members are products only; the ml is chosen at view/add-to-cart time and
-- resolved to a variant then. A product appears at most once per collection.
create table if not exists collection_items (
  collection_id uuid not null references collections(id) on delete cascade,
  product_id    uuid not null references products(id) on delete restrict,
  sort_order    int not null default 0,
  primary key (collection_id, product_id)
);
-- "Which bundles use this product?" — for deactivation warnings.
create index if not exists collection_items_product_idx on collection_items (product_id);

-- Order lines carry their bundle so a placed order can be grouped and the free
-- gift is distinguishable. A member line keeps its (discounted) unit_price; the
-- gift line is is_gift=true, unit_price 0.
alter table order_items
  add column if not exists collection_id   uuid references collections(id) on delete set null,
  add column if not exists collection_name text,
  add column if not exists is_gift         boolean not null default false;
create index if not exists order_items_collection_idx on order_items (collection_id);

-- Admin-tunable collection settings (§4.4). roundTo lives here because the old
-- settings.pricing row (which held it) was withdrawn in 0027.
insert into settings (key, value) values
  ('collection', jsonb_build_object(
     'customEnabled', true,
     'minItems', 4,
     'maxItems', null,
     'customDiscountPct', 5,
     'baseDefaultDiscountPct', 5,
     'giftEnabled', true,
     'giftMl', 1,
     'giftMlOptions', jsonb_build_array(1, 2),
     'roundTo', 100
   ))
on conflict (key) do nothing;

-- ── RLS ────────────────────────────────────────────────────────────────
-- Base (active) is public; a saved custom bundle is owner-only; staff see all.
-- The import script + route handlers use the service role, which bypasses RLS.
alter table collections enable row level security;

create policy "collections read" on collections for select using (
  (type = 'base' and is_active) or user_id = auth.uid() or is_staff()
);
create policy "collections staff write" on collections for all
  using (is_staff()) with check (is_staff());
-- A customer may create/manage only their own custom bundles.
create policy "collections owner write" on collections for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and type = 'custom');

alter table collection_items enable row level security;

create policy "collection_items read" on collection_items for select using (
  exists (
    select 1 from collections c
    where c.id = collection_id
      and ((c.type = 'base' and c.is_active) or c.user_id = auth.uid() or is_staff())
  )
);
create policy "collection_items staff write" on collection_items for all
  using (is_staff()) with check (is_staff());
create policy "collection_items owner write" on collection_items for all
  using (
    exists (select 1 from collections c where c.id = collection_id and c.user_id = auth.uid())
  )
  with check (
    exists (select 1 from collections c where c.id = collection_id and c.user_id = auth.uid())
  );
