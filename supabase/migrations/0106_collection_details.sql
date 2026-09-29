-- Бэлэн багцын хуудсанд дан усных шиг accordion (клиент, 2026-09 UG):
-- «Дэлгэрэнгүй тайлбар», «Хэрэглэх нөхцөл», «Хүргэлт ба буцаалт».
--
-- «Дэлгэрэнгүй тайлбар» нь одоогийн `description` өөрөө (өгөгдөл шилжихгүй,
-- зөвхөн хуудсан дээрх байрлал нь accordion руу орно). «Хүргэлт ба буцаалт»
-- нь бүх барааны нийтлэг текст (`DeliveryReturnsText`) тул багана хэрэггүй.
-- Шинэ багана нь зөвхөн «Хэрэглэх нөхцөл» — `products.usage_description`
-- (0022)-ийн толь.

alter table collections
  add column if not exists usage_description text not null default '';
