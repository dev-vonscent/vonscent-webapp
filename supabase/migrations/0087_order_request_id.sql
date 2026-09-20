-- Давхар захиалгаас сэргийлэх идемпотентын түлхүүр.
--
-- Асуудал: `POST /api/orders` нь дуудалт бүрд шинэ захиалга үүсгэдэг. Сул
-- сүлжээн дээр хүсэлт серверт хүрч захиалга үүсээд хариу нь замдаа алдагдвал
-- checkout нь «Сүлжээнд холбогдож чадсангүй… дахин оролдоно уу» гэж ХЭЛЖ,
-- хэрэглэгч дахин дарна — хоёр захиалга, хоёр нөөцийн түгжээ, хоёр invoice.
-- Rate limit энийг шийдэхгүй: тэр блоклодог, нэгтгэдэггүй.
--
-- Клиент checkout сесс тутамд нэг UUID үүсгэж илгээнэ.
--
-- **Яагаад тусдаа хүснэгт вэ.** `orders.request_id` багана нэмэх нь эхлээд
-- энгийн харагдана, гэхдээ түлхүүрийг ЗАХИАЛГА ҮҮССЭНИЙ ДАРАА бичихээс өөр
-- аргагүй болно — тэр зайд хоёр зэрэгцээ хүсэлт хоёулаа `place_order`-ыг
-- дуудаж, хоёр нөөц түгжигдэнэ. Эзэмшлийн мөр нь `place_order`-оос ӨМНӨ
-- атомароор тавигдана: ялагч л захиалга үүсгэнэ, хожигдсон нь хүлээнэ.
-- (`qpay_invoices`-ийн 0086-тай ижил загвар.)

create table if not exists order_requests (
  request_id uuid primary key,
  -- Ялагч захиалгаа үүсгэтэл NULL. Хожигдсон тал үүнийг хүлээнэ.
  order_id   uuid references orders(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Хуучирсан эзэмшлийг булаах шалгалт (route нь `created_at`-аар шүүнэ).
create index if not exists order_requests_pending_idx
  on order_requests (created_at) where order_id is null;

-- Зөвхөн service role хүрнэ: энэ хүснэгтийг route handler л уншиж бичнэ,
-- хэрэглэгчийн сесс хэзээ ч шууд хандахгүй.
alter table order_requests enable row level security;

comment on table order_requests is
  'Идемпотентын түлхүүр — нэг checkout оролдлого = нэг UUID. Ижил түлхүүртэй '
  'хоёр дахь хүсэлт шинэ захиалга үүсгэхгүй, байгаагийнх нь дугаарыг буцаана.';
