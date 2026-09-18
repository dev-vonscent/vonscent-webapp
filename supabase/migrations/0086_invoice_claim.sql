-- Нэг захиалгад ЯГ нэг QPay invoice — зэрэгцээ хүсэлт дээр ч.
--
-- Асуудал: `ensureInvoice` нь «уншаад, байхгүй бол үүсгэ» байсан бөгөөд энэ
-- хоёр алхмын хооронд түгжээ байгаагүй. Хоёр таб (эсвэл захиалга үүсгэх
-- хүсэлт ба төлбөрийн хуудас) зэрэг ажиллавал:
--
--   • хоёулаа QPay руу `POST /invoice` явуулж, ХОЁР бодит invoice үүснэ
--     (QPay `sender_invoice_no` давхардлыг хориглодоггүй — qpay/FINDINGS §2);
--   • `upsert(onConflict: order_id)` нь хожигдсоны мөрийг дарж бичнэ;
--   • гэтэл дуудагч бүр ӨӨРИЙНХӨӨ invoice-ыг буцаадаг байсан тул нэг таб
--     DB-д байхгүй invoice-ийн QR-ыг харуулна.
--
-- Хэрэглэгч тэр QR-ыг төлнө. `verifyAndMarkOrderPaid` нь
-- `orders.qpay_invoice_id` (нөгөө invoice) -ийг шалгадаг тул төлбөр МӨНХӨД
-- «төлөгдөөгүй» хэвээр үлдэнэ. Бодит мөнгө, бүртгэгдэхгүй.
--
-- Шийдэл: QPay руу залгахаас ӨМНӨ мөрөө «эзэмших». `order_id` нь primary key
-- тул `on conflict do nothing` нь яг нэг ялагч гаргана. Ялагч л QPay руу
-- залгана; хожигдсон нь ялагчийн бичихийг хүлээнэ.
--
-- Тиймээс `invoice_id` нь эзэмшсэн боловч хараахан дуусаагүй мөрөнд түр
-- хугацаанд NULL байх шаардлагатай. `unique` индекс хэвээр — Postgres олон
-- NULL-ыг зөвшөөрдөг.

alter table qpay_invoices alter column invoice_id drop not null;
alter table qpay_invoices alter column qr_text drop not null;

-- Эзэмшсэн мөч. Хоёр зорилго:
--   1. Хожигдсон талд «хүлээх үү, өөрөө оролдох уу» гэдгийг шийднэ;
--   2. QPay руу залгаж байгаад унасан процессын мөрийг мөнхөд түгжигдсэн
--      үлдээхгүй — хуучирсан эзэмшлийг дараагийн дуудагч булааж авна.
alter table qpay_invoices
  add column if not exists claimed_at timestamptz not null default now();

-- Дуусаагүй мөрийг хурдан олох (эзэмшил булаах шалгалт).
create index if not exists qpay_invoices_pending_idx
  on qpay_invoices (claimed_at) where invoice_id is null;

comment on column qpay_invoices.claimed_at is
  'Мөрийг эзэмшсэн мөч. invoice_id NULL байхад энэ нь "QPay руу залгаж '
  'байна" гэсэн үг; хэт хуучирсан бол өөр процесс эзэмшлийг булааж болно.';
