-- Per-size bundle discounts, and tags for bundles.
--
-- Until now a bundle carried one `discount_pct` applied to every size, so a
-- 2ml set and a 20ml set of the same four perfumes were discounted equally.
-- The shop wants to push the larger sizes harder, so the discount becomes a
-- per-ml value.
--
-- `collections.discount_pct` stays and keeps its meaning: it is the **default**
-- for any size without a row here. That way every bundle already in the
-- catalogue keeps pricing exactly as it does today, and a size only changes
-- once someone deliberately overrides it.
create table if not exists collection_ml_discounts (
  collection_id uuid not null references collections(id) on delete cascade,
  -- Matches the product_variants check: the shop sells these four sizes.
  ml            int not null check (ml in (2, 5, 10, 20)),
  discount_pct  numeric(5,2) not null
                  check (discount_pct >= 0 and discount_pct <= 100),
  primary key (collection_id, ml)
);

-- Bundles get the same two tag systems products already have (0003, 0035): the
-- customer-facing trio in `tags`, and the internal free-form pool in
-- `custom_tags`. Both pools are shared with products rather than duplicated —
-- «Шинэ» means the same thing on a bundle as on a bottle.
create table if not exists collection_tags (
  collection_id uuid not null references collections(id) on delete cascade,
  tag_id        uuid not null references tags(id) on delete cascade,
  primary key (collection_id, tag_id)
);

create table if not exists collection_custom_tags (
  collection_id uuid not null references collections(id) on delete cascade,
  tag_id        uuid not null references custom_tags(id) on delete cascade,
  primary key (collection_id, tag_id)
);

-- ── RLS ────────────────────────────────────────────────────────────────
-- Readable exactly as far as the parent bundle is: the same predicate
-- `collection_items` uses, so a hidden bundle does not leak its pricing or its
-- tags. Writes are staff-only — unlike collection_items there is no owner
-- clause, because a customer's custom bundle is priced from settings and never
-- carries its own per-size discount or tags.
alter table collection_ml_discounts enable row level security;
alter table collection_tags enable row level security;
alter table collection_custom_tags enable row level security;

drop policy if exists "collection_ml_discounts read" on collection_ml_discounts;
create policy "collection_ml_discounts read" on collection_ml_discounts
  for select using (
    exists (
      select 1 from collections c
      where c.id = collection_id
        and ((c.type = 'base' and c.is_active) or c.user_id = auth.uid() or is_staff())
    )
  );
drop policy if exists "collection_ml_discounts write" on collection_ml_discounts;
create policy "collection_ml_discounts write" on collection_ml_discounts
  for all using (is_staff()) with check (is_staff());

drop policy if exists "collection_tags read" on collection_tags;
create policy "collection_tags read" on collection_tags
  for select using (
    exists (
      select 1 from collections c
      where c.id = collection_id
        and ((c.type = 'base' and c.is_active) or c.user_id = auth.uid() or is_staff())
    )
  );
drop policy if exists "collection_tags write" on collection_tags;
create policy "collection_tags write" on collection_tags
  for all using (is_staff()) with check (is_staff());

drop policy if exists "collection_custom_tags read" on collection_custom_tags;
create policy "collection_custom_tags read" on collection_custom_tags
  for select using (
    exists (
      select 1 from collections c
      where c.id = collection_id
        and ((c.type = 'base' and c.is_active) or c.user_id = auth.uid() or is_staff())
    )
  );
drop policy if exists "collection_custom_tags write" on collection_custom_tags;
create policy "collection_custom_tags write" on collection_custom_tags
  for all using (is_staff()) with check (is_staff());
