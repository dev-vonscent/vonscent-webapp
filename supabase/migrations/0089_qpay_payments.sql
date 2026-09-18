-- QPay-ийн гүйлгээний баримт — маргаантай төлбөрийг мөрдөх түлхүүр.
--
-- ## Асуудал
--
-- Төлбөр батлагдсаны дараа системд үлддэг цорын ганц лавлагаа нь
-- `orders.qpay_invoice_id` байв. Гэтэл тэр нь **invoice**-ийн дугаар,
-- гүйлгээнийх биш: нэг invoice дээр хэд хэдэн гүйлгээ байж болно, мөн
-- QPay-ийн порталд эсвэл банкны хуулгад хайхад ашиглагддаг түлхүүр нь
-- `payment_id`. `checkPayment` нь QPay-ийн буцаасан мөр бүрийг уншаад
-- нийлбэр болгочихоод **хаядаг** байсан.
--
-- Үр дагавар: «би төлсөн» гэсэн хэрэглэгчтэй маргахад «манай систем ингэж
-- хэлж байна» гэхээс өөр нотолгоо байхгүй; нягтлан бодох бүртгэлд QPay-ийн
-- орлого ба `orders`-ыг тулгах холбоос байхгүй; буцаалт хийхэд оператор
-- QPay-ийн порталаас захиалгын дугаараар нь гараар хайдаг.
--
-- ## Тэмдэглэл
--
-- Энэ нь **автомат буцаалтын** урьдчилсан нөхцөл БИШ. QPay-ийн
-- `DELETE /v2/payment/refund/{payment_id}` нь баримтаараа зөвхөн **картын
-- гүйлгээнд** ажилладаг бөгөөд манай урсгал (QR → банкны апп) нь дансны
-- шилжүүлэг тул API-аар буцаах боломжгүй. Буцаалт гараар хийгдсээр байна —
-- энэ хүснэгт зөвхөн тэр ажлыг хурдан, мөрдөгдөхүйц болгоно.

create table if not exists qpay_payments (
  -- QPay-ийн гүйлгээний дугаар. Энэ бол дэмжлэг, тулгалт, буцаалтын ярианы
  -- нийтлэг лавлагаа.
  qpay_payment_id text primary key,
  order_id   uuid not null references orders(id) on delete cascade,
  -- Тухайн гүйлгээний дүн (₮, integer). Нэг захиалгад хэд хэдэн мөр байж
  -- болох тул захиалгын `total`-той заавал тэнцэхгүй.
  amount     int not null check (amount >= 0),
  currency   text,
  -- QPay-ийн `payment_date`. Манай `created_at`-аас өөр: энэ нь мөнгө
  -- бодитоор хөдөлсөн мөч.
  paid_at    timestamptz,
  -- «Khan bank», «qPay wallet» г.м. — оператор аль сувгаар орсныг харна.
  wallet     text,
  -- QPay-ийн мөрийг бүтнээр нь. Ирээдүйд шинэ талбар хэрэгтэй болоход
  -- migration бичихгүйгээр эндээс уншина.
  raw        jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists qpay_payments_order_idx
  on qpay_payments (order_id);

-- Хэрэглэгч гүйлгээний дугаараа харах шаардлагагүй (төлбөрийн хуудас нь
-- токеноор ажилладаг, дамжиж болно). Зөвхөн ажилтан.
alter table qpay_payments enable row level security;
drop policy if exists "qpay payments staff" on qpay_payments;
create policy "qpay payments staff" on qpay_payments for all
  using (is_staff()) with check (is_staff());

comment on table qpay_payments is
  'QPay-ийн PAID гүйлгээний мөрүүд. Буцаалт нь гараар хийгддэг (QPay-ийн '
  'refund API зөвхөн картад ажилладаг) тул энэ нь операторын хайлт, '
  'нягтлан бодох тулгалт, маргааны нотолгооны эх сурвалж.';
