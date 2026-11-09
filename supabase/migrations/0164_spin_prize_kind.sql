-- Азын хүрдний гранд шагналын мэдэгдлийн төрөл (0165 ашиглана).
--
-- Тусдаа файл: шинэ enum утгыг нэмсэн transaction дотроо ашиглаж болдоггүй
-- (0128-ын адил). Expand only — хуучин код энэ утгыг мэдэхгүй ч эвдрэхгүй.

alter type notification_kind_t add value if not exists 'prize_won';
