-- Нэмэлт таг-ийн сан (requirement_final.md A2 «Нэмэлт Tag»): a free-form,
-- admin-managed tag pool separate from the fixed customer-facing trio
-- (new/hot/sale in `tags`). Custom tags are internal — they feed search and
-- (later) the quiz; they are never shown as product badges. The pool starts
-- empty: the client will supply the tag list (questions.md №27).

create table if not exists custom_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists product_custom_tags (
  product_id uuid not null references products(id) on delete cascade,
  tag_id uuid not null references custom_tags(id) on delete cascade,
  primary key (product_id, tag_id)
);

alter table custom_tags enable row level security;
alter table product_custom_tags enable row level security;

-- Everyone may read (search needs them); writes go through the admin API
-- (service role) only.
drop policy if exists "custom tags read" on custom_tags;
create policy "custom tags read" on custom_tags for select using (true);
drop policy if exists "product custom tags read" on product_custom_tags;
create policy "product custom tags read" on product_custom_tags
  for select using (true);
