-- Four-part product description (todo.md B3, requirement_fb.md §"Дэлгэрэнгүй тайлбар").
--
-- The client writes a product page in four distinct voices:
--   1. the perfume and the brand behind it   -> products.description (existing)
--   2. what the individual notes smell like  -> notes_description
--   3. where and when to wear it             -> usage_description
--   4. a one-liner for cards and previews    -> short_description
--
-- Kept as columns rather than one blob so the storefront can lay each part out
-- on its own and skip the ones the admin left blank. `description` keeps its
-- meaning, so every existing product stays valid with three empty sections.

alter table products
  add column if not exists notes_description text not null default '',
  add column if not exists usage_description text not null default '',
  add column if not exists short_description text not null default '';
