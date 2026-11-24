-- Хүргэлтийн ба усны шошго хэвлэх (Niimbot, Web Bluetooth). Feature flag `label_print`.
--
-- `label_printed_at` — хаягийн шошгыг хамгийн сүүлд хэвлэсэн цаг.
-- `perfume_label_printed_at` — захиалгын бүх усны шошгыг хамгийн сүүлд
-- хэвлэсэн цаг. NULL = хэвлээгүй; дахин хэвлэвэл цаг л шинэчлэгдэнэ.
-- Бичилт зөвхөн /api/admin/orders/label-printed-ээр (туг шалгана) — trigger,
-- pg_cron байхгүй тул туг хаалттай үед санд юу ч хуримтлагдахгүй.
--
-- Expand only: nullable багана.

alter table orders add column if not exists label_printed_at timestamptz;
alter table orders add column if not exists perfume_label_printed_at timestamptz;

insert into feature_flags (key) values ('label_print') on conflict do nothing;
