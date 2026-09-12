-- Бэлгийн нэгдсэн дүрэм (backlog A1–A4, 2026-09-02-ны шийдвэр 2–3).
--
-- Өмнө нь хоёр өөр бэлгийн систем зэрэг ажиллаж байв:
--   (а) багц бүрийн дагалдах бэлэг — дэлгүүрийн ДУРЫН үнэрээс, багцын
--       `collections.gift_ml` хэмжээгээр;
--   (б) захиалгын дүнгээс хамаарах 1мл дээж — админы сангаас.
--
-- Одооноос (а) байхгүй: бүх бэлэг зөвхөн `settings.gift` сангаас, үргэлж 1мл,
-- эрхийн тоо нь max(preset 5/10/20мл багцын баталгаа, ⌊цэвэр дүн ÷ 200,000⌋).
-- Тиймээс багц тус бүрийн бэлгийн ml override илүүдэл болов.
--
-- Тэмдэглэл: захиалгын мөрүүд дээрх `order_items.is_gift` хэвээр — хуучин
-- захиалгын багцын бэлэг тэндээ түүхээрээ үлдэнэ.

alter table collections drop column if exists gift_ml;

-- Багцын бэлгийн ml-ийн глобал тохиргоог ч цэвэрлэнэ (settings.collection).
update settings
   set value = (value - 'giftMl' - 'giftMlOptions' - 'giftEnabled')
 where key = 'collection'
   and value ?| array['giftMl', 'giftMlOptions', 'giftEnabled'];
