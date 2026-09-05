-- 2026-09-05: блогийн нүүр видео (cover_video_url) нэг өдөр амьдраад
-- клиентийн шийдвэрээр хасагдав. Баганыг хостлогдсон DB-д нэмчихсэн байсан
-- тул буцааж устгана; шинэ DB дээр no-op.
alter table blog_posts drop column if exists cover_video_url;
