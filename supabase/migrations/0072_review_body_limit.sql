-- Сэтгэгдлийн текстийн дээд уртыг DB талд барих.
--
-- `REVIEW_BODY_MAX` (constants.ts) нь 1000-аас 200 болж богиноссон. Zod нь
-- client болон route хоёуланд шалгадаг ч, `reviews`-д хэрэглэгч RLS-ээр шууд
-- бичих эрхтэй (0033: "review owner insert/update") тул route-ыг тойрч урт
-- текст оруулах бүрэн боломжтой. Хязгаарыг schema дээр давхар тавина —
-- ML_SIZES-ийн адил: Zod + DB check хоёулаа нэг дүрмийг барина.
--
-- Одоо байгаа мөрүүд хамгийн ихдээ 53 тэмдэгт тул шалгуур ямар ч мөрийг
-- зөрчихгүй.

alter table reviews drop constraint if exists reviews_body_len;
alter table reviews add constraint reviews_body_len
  check (body is null or length(body) <= 200);
