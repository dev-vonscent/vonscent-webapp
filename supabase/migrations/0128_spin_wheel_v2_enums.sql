-- Азын хүрд v2 (docs/lucky-wheel.md §9) — enum-ийн шинэ утгууд.
--
-- Тусдаа файл: шинэ enum утгыг нэмсэн транзакц дотор ашиглаж болдоггүй
-- (Postgres «unsafe use of new value»). Migration бүр өөрийн транзакцтай тул
-- 0129 эдгээрийг ашиглахаас өмнө энэ файл commit болсон байна.

-- «Баярлалаа» салбар — шагналгүй.
alter type spin_prize_kind_t add value if not exists 'none';

-- Захиалгаас олсон эрхээр эргүүлсэн эргэлт (100,000₮ тутамд нэг).
alter type spin_type_t add value if not exists 'order';
