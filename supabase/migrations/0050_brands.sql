-- Брэндийн сан (admin → Брэнд): a real table for what has until now been a
-- free-text column on every product.
--
-- `products.brand` is read as a display string in ~65 places — order and cart
-- snapshots, invoices, the catalog filter, search, the quiz — so it stays
-- exactly where it is. What it lacked was an owner: nothing said which brand
-- names exist, nothing held a logo, and two operators typing «Tom ford» and
-- «Tom Ford» silently split one house into two filter facets.
--
-- So this adds the list beside the column rather than replacing it:
--   * `brands` — the names the admin may pick from, each with a logo.
--   * `products.brand_id` — which row a product points at.
--   * a trigger that rewrites `products.brand` when a brand is renamed.
--
-- That last part is what makes the denormalised column safe to keep: the text
-- stays the fast path every reader already uses, and the table stays the one
-- place a name is edited.

create table if not exists brands (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  logo_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brands_active_idx on brands (is_active, name);

drop trigger if exists brands_updated_at on brands;
create trigger brands_updated_at
  before update on brands
  for each row execute function set_updated_at();

-- Seed from the catalogue that already exists. `distinct on (lower(name))`
-- collapses casing variants; whichever spelling sorts first wins and the admin
-- can correct it afterwards — the rename trigger will carry the fix onto the
-- products.
insert into brands (slug, name)
select distinct on (lower(p.brand))
  trim(both '-' from regexp_replace(lower(p.brand), '[^a-z0-9]+', '-', 'g')),
  p.brand
from products p
where coalesce(p.brand, '') <> ''
order by lower(p.brand), p.brand
on conflict (slug) do nothing;

alter table products
  add column if not exists brand_id uuid references brands(id) on delete set null;

create index if not exists products_brand_id_idx on products (brand_id);

-- Point every existing product at its row.
update products p
   set brand_id = b.id
  from brands b
 where p.brand_id is null
   and lower(b.name) = lower(p.brand);

/**
 * Keep the denormalised display column honest.
 *
 * Renaming a brand has to reach the products or the catalogue immediately
 * disagrees with itself — the filter would list the new name while every card
 * still printed the old one. Only `products.brand` is touched, never an order
 * or cart snapshot: those deliberately freeze what the customer bought.
 */
create or replace function sync_products_brand_name()
returns trigger language plpgsql as $$
begin
  if new.name is distinct from old.name then
    update products set brand = new.name where brand_id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists brands_name_sync on brands;
create trigger brands_name_sync
  after update of name on brands
  for each row execute function sync_products_brand_name();

-- Anyone may read the list (the catalog filter and the storefront render from
-- it); only staff may change it. Mirrors the scent_families policy in 0018.
alter table brands enable row level security;

do $$ begin
  create policy brands_read on brands for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy brands_write on brands
    for all using (is_staff()) with check (is_staff());
exception when duplicate_object then null; end $$;

comment on table brands is
  'Админы удирдах брэндийн жагсаалт (нэр + лого). products.brand нь харагдах '
  'текст хэвээр; brand_id нь энэ мөр рүү заана. Нэр солиход brands_name_sync '
  'trigger нь products.brand-ыг шинэчилнэ.';
