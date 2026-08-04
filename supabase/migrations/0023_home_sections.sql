-- Curated home page sections (todo.md B7).
--
-- Until now the home page only had hard-coded rails driven by marketing tags
-- ("new", "hot", "sale"), so the client could not say "these six waters, in
-- this order, under this heading". A section is either:
--   * kind = 'manual' — an explicit, hand-ordered product list, or
--   * kind = 'tag'    — everything carrying `tag`, ordered newest first
-- so the existing tag rails become editable rows too rather than a special
-- case in the page component.

create table if not exists home_sections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text not null default '',
  /** Optional "see all" link shown beside the heading. */
  href text not null default '',
  kind text not null default 'manual' check (kind in ('manual', 'tag')),
  /** Only for kind = 'tag'. */
  tag tag_kind_t,
  /** Cap on how many products the rail shows. */
  max_items int not null default 8 check (max_items between 1 and 24),
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists home_sections_active_idx
  on home_sections (is_active, sort_order);

-- Membership + the admin's hand-picked order. Deleting a product drops it out
-- of every section rather than leaving a dangling rail entry.
create table if not exists home_section_products (
  section_id uuid not null references home_sections(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  sort_order int not null default 0,
  primary key (section_id, product_id)
);
create index if not exists home_section_products_order_idx
  on home_section_products (section_id, sort_order);

alter table home_sections enable row level security;
create policy "home sections read" on home_sections for select
  using (is_active or is_staff());
create policy "home sections write" on home_sections for all
  using (is_staff()) with check (is_staff());

alter table home_section_products enable row level security;
-- The join rows are only ever read through an already-visible section.
create policy "home section products read" on home_section_products for select
  using (
    exists (
      select 1 from home_sections s
      where s.id = section_id and (s.is_active or is_staff())
    )
  );
create policy "home section products write" on home_section_products for all
  using (is_staff()) with check (is_staff());

-- The two sections the client asked for by name. Empty until the admin picks
-- products, and the home page skips empty sections, so seeding them costs
-- nothing on a fresh store.
insert into home_sections (title, subtitle, kind, sort_order)
select 'Онцлох', 'Бидний сонголт', 'manual', 1
where not exists (select 1 from home_sections where title = 'Онцлох');

insert into home_sections (title, subtitle, kind, sort_order)
select 'Багц уснууд', 'Хамтдаа авахад тохирох', 'manual', 2
where not exists (select 1 from home_sections where title = 'Багц уснууд');
