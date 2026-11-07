-- Купоны хугацаа дуусах сануулгын мэдэгдлийн төрөл (0174 ашиглана).
--
-- Тусдаа файл: шинэ enum утгыг нэмсэн transaction дотроо ашиглаж болдоггүй
-- (0164-ийн адил). Expand only — хуучин код энэ утгыг мэдэхгүй ч эвдрэхгүй
-- (`NotificationKindIcon` нь танихгүй төрөлд хонхны дүрс харуулна).

alter type notification_kind_t add value if not exists 'coupon_expiring';
