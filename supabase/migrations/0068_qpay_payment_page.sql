-- Төлбөрийн хуудас: нээх токен + QPay-ийн invoice артефактууд.
--
-- Хоёр зүйлийг шийднэ.
--
-- 1. **`orders.pay_token`.** `order_no` бол `VS-` + дараалсан sequence
--    (0006-д 1000-аас эхэлдэг) — өөрөөр хэлбэл `VS-1001`, `VS-1002` … гэж
--    тааж олох боломжтой. Тиймээс төлбөрийн хуудсыг захиалгын дугаараар
--    нээвэл дурын хүн бусдын захиалгын дүн, QR-ыг харна. Токен нь тааж
--    олдохгүй, URL-д тавьж имэйл/SMS-ээр илгээхэд тохиромжтой ба захиалгыг
--    өөрөө тодорхойлдог тул `/pay/<token>` гэсэн нэг л сегмент хүрэлцэнэ.
--
--    `default`-оор олгосон нь `place_order` (0052) руу хүрэхгүйгээр шинэ
--    захиалга бүрт токен үүсгэнэ.
--
-- 2. **`qpay_invoices`.** QPay `POST /invoice`-оос `qr_text`, `qr_image`
--    (base64 PNG), `qPay_shortUrl` ба 23 банкны deeplink буцаадаг. Хуудас
--    reload хийхэд, эсвэл хэрэглэгч дараа нь эргэж ирэхэд эдгээр дахин
--    хэрэгтэй — QPay-ийн `GET /invoice/{id}` нь тэднийг буцаадаггүй.
--
--    Тусдаа хүснэгт болсон шалтгаан: `qr_image` нь ~10KB, deeplink-ууд ~5KB.
--    `orders`-д jsonb болгож нэмбэл админы `select *` бүр захиалга тутамд
--    15KB нэмж татах болно. `orders.qpay_invoice_id` хэвээр — webhook
--    (confirm-order.ts) түүнээр хайдаг.
--
--    Deeplink-ийг хадгалж байгаа нь **зориуд**: FINDINGS.md-д «бүгд ижил
--    qr_text-ийг `?qPay_QRcode=` параметрээр агуулна, зөвхөн scheme нь
--    ялгаатай» гэж бичсэн ч бүтэн линкийн host/path хэсэг батлагдаагүй.
--    Таамгаар дахин угсарвал бодит төлбөр эвдэрнэ.

-- ── 1. Төлбөрийн хуудсыг нээх токен ────────────────────────────────────
alter table orders
  add column if not exists pay_token text
    default encode(gen_random_bytes(16), 'hex');

-- Хуучин захиалгууд: default нь зөвхөн шинэ мөрд үйлчилнэ.
update orders set pay_token = encode(gen_random_bytes(16), 'hex')
 where pay_token is null;

alter table orders alter column pay_token set not null;

create unique index if not exists orders_pay_token_idx on orders (pay_token);

-- ── 2. QPay invoice артефактууд ────────────────────────────────────────
create table if not exists qpay_invoices (
  order_id   uuid primary key references orders(id) on delete cascade,
  -- QPay-ийн UUID. `unique` нь webhook-ийн хайлтыг хамгаална.
  invoice_id text not null unique,
  -- EMVCo QR payload — QR-ыг үүнээс зурна.
  qr_text    text not null,
  -- QPay-ийн буцаасан цэвэр base64 PNG, `data:` угтваргүй (FINDINGS §2).
  -- Угтварыг харуулах үед код нэмнэ.
  qr_image   text,
  short_url  text,
  -- [{ name, description, logo, link }] — QPay-ийн `urls[]` дуулиангүй.
  deeplinks  jsonb not null default '[]'::jsonb,
  -- Invoice үүсгэх үеийн дүн. Захиалгын `total` дараа өөрчлөгдвөл
  -- (админ гараар засвал) хоёр нь зөрсөн гэдгийг харуулах баримт.
  amount     int not null check (amount >= 0),
  created_at timestamptz not null default now()
);

-- Хэрэглэгч төлбөрийн хуудсаа токеноор нээдэг тул уншилт нь service role-оор
-- (route handler) явна — anon policy шаардлагагүй. Ажилтан админаас харна.
alter table qpay_invoices enable row level security;
drop policy if exists "qpay invoices staff" on qpay_invoices;
create policy "qpay invoices staff" on qpay_invoices for all
  using (is_staff()) with check (is_staff());

comment on column orders.pay_token is
  'Төлбөрийн хуудсыг нээх нэг удаагийн бус, тааж олдохгүй токен: /pay/<token>. '
  'order_no нь дараалсан тул түүнийг URL-д ашиглаж болохгүй.';
