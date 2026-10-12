-- Багцад савны зураг (барааных шиг, `BOTTLE_STYLES`).
--
-- Бараа савны зургийг галерейдаа хуулж авдаг (`addBottleImage`), харин багц
-- нэг cover зурагтай тул сонголтоо л хадгална: дэлгүүр нь Storage-ийн эх
-- хувийг (`bottles/<style>.webp`) cover-ийн дараа хоёр дахь зураг болгоно.
-- Багц тэр объектыг хэзээ ч устгадаггүй тул хуулах шаардлагагүй.

alter table collections
  add column if not exists bottle_style text
  check (bottle_style in ('black', 'pink', 'silver'));
