-- Дэлгүүрийн «Нэмэлт бараа»: дагалдах хэрэгсэл (шприц, грамын сав, гоёмсог
-- бэлгийн сав) дээр, үнэртний шил доор. Зөвхөн эрэмбэ — хуучин кодтой
-- ажиллана.

update extra_categories set sort = 10 where slug = 'syringe';
update extra_categories set sort = 20 where slug = 'vial';
update extra_categories set sort = 30 where slug = 'gift-box';
update extra_categories set sort = 40 where slug = 'bottled';
update extra_categories set sort = 50 where slug = 'empty-bottle';
update extra_categories set sort = 60 where slug = 'brand-pouch';
