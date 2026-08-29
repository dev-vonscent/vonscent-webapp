-- Hero carousel dropped: the home hero is a static, theme-aware artwork now,
-- so the admin-managed banner table and its policies are dead weight.
drop policy if exists "banner read" on hero_banners;
drop policy if exists "banner write" on hero_banners;
drop index if exists hero_banners_active_idx;
drop table if exists hero_banners;
