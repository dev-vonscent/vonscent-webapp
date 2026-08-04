-- Admin-managed scent families + multi-value scent family / season tagging.
--
-- Before: products.scent_family was a single value of a hard-coded enum and
-- products.season a single season_t. A perfume is rarely one thing ("Дорнын
-- модлог", "хавар-намар"), and the admin could not add a new family without a
-- migration. After: a `scent_families` lookup table the admin owns, plus array
-- columns on products so one product can carry several families and seasons.

create table if not exists scent_families (
  slug text primary key,
  label text not null,
  icon_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed with the six families that were previously baked into scent_family_t.
insert into scent_families (slug, label, icon_url, sort_order) values
  ('floral',   'Цэцэгт',  '/family-floral.png',   1),
  ('woody',    'Модлог',  '/family-woody.png',    2),
  ('fresh',    'Сэргэг',  '/family-fresh.png',    3),
  ('oriental', 'Дорнын',  '/family-oriental.png', 4),
  ('citrus',   'Цитрус',  '/family-citrus.png',   5),
  ('spicy',    'Халуун',  '/family-spicy.png',    6)
on conflict (slug) do nothing;

alter table products
  add column if not exists scent_families text[] not null default '{}',
  add column if not exists seasons season_t[] not null default '{}';

-- Backfill the singular columns into the arrays (no-op on a fresh database).
do $$ begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'scent_family'
  ) then
    update products
       set scent_families = array[scent_family::text]
     where scent_family is not null and scent_families = '{}';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_name = 'products' and column_name = 'season'
  ) then
    update products
       set seasons = array[season]
     where season is not null and seasons = '{}';
  end if;
end $$;

-- Array containment lookups (`scent_families && '{woody,spicy}'`).
create index if not exists products_families_idx on products using gin (scent_families);
create index if not exists products_seasons_idx on products using gin (seasons);

alter table products drop column if exists scent_family;
alter table products drop column if exists season;

-- Anyone may read the taxonomy (the catalog filter renders from it); only
-- staff may change it. Mirrors the tags policy in 0009_rls.sql.
alter table scent_families enable row level security;

do $$ begin
  create policy scent_families_read on scent_families
    for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy scent_families_write on scent_families
    for all using (is_staff()) with check (is_staff());
exception when duplicate_object then null; end $$;
