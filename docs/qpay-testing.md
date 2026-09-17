# QPay тестийн гарын авлага

> Хамрах хүрээ: `src/lib/payments/*`, `/pay/[token]`, `/api/payments/*`,
> `supabase/migrations/0068_qpay_payment_page.sql`, `qpay/` harness.
> Бодит API-аас ажиглагдсан зүйлс: **`qpay/FINDINGS.md`**.
> Шинэчилсэн: 2026-09-07.

Мерчант: **БАЯНБИЛЭГ БАЛЖИННЯМ** · клиент `VONSCENT` ·
`INVOICE_CODE = VONSCENT_INVOICE` · base `https://merchant.qpay.mn/v2`.

> **Sandbox БАЙНА** (2026-09-17-нд албан ёсны баримтаас батлагдав):
> `https://merchant-sandbox.qpay.mn/v2`. Өмнө нь энэ баримт «sandbox байхгүй»
> гэж бичсэн нь **буруу** байв. `QPAY_BASE_URL`-ыг тэр рүү заавал бодит
> мөнгөгүйгээр callback хүртэл эцсээс эцэс тест хийх боломжтой — доорх §4.5
> «10₮-өөр турших» арга нь sandbox ажиллахгүй тохиолдлын нөөц хувилбар.
> Sandbox-д тусдаа креденшиал хэрэгтэй эсэхийг QPay-ээс тодруулна.

---

## 0. Хамгийн чухал 4 зүйл

QPay-тэй ажиллахад хамгийн их цаг иддэг зүйлс. Дөрвүүлээ кодод шийдэгдсэн ч
гараар тест хийхэд тааралдана:

| # | Юу | Хаана шийдэгдсэн |
|---|---|---|
| 1 | `expires_in` нь **TTL биш, unix timestamp (секунд)**. TTL гэж үзвэл 2083 он гарч token хэзээ ч сэргэхгүй. | `expiresAtFromTokenResponse()` |
| 2 | `qr_image` нь **`data:` угтваргүй** цэвэр base64. Шууд `<img src>`-д тавибал эвдэрсэн зураг гарна. | `toDataUrl()` |
| 3 | `payment/check`-ийн `paid_amount` нь төлөгдөөгүй үед **байхгүй** (`undefined`), `0` биш. | `Number(data.paid_amount ?? 0)` |
| 4 | `sender_invoice_no` давхардлыг QPay **хориглодоггүй** — нэг захиалгад 2 invoice үүсч болно. | `ensureInvoice()` — эзэмшлийн мөр (0086), зэрэгцээ дуудлагад ч нэг invoice |
| 5 | QPay **cron-оор гүйлгээг байнга шалгахыг хориглодог** — callback хүлээж аваад шалгана. | `/api/cron/reconcile-payments` нь sweep биш, зөвхөн **цуцлагдахын өмнөх** нэг шалгалт |
| 6 | Callback-д **гарын үсэг байхгүй** — QPay өөрөө «хүлээн авсны дараа шалгаж баталгаажуулна уу» гэж заадаг. | `handleQpayCallback()` QPay-ээс дахин асууна + замд нууц сегмент |

---

## 1. Гурван орчин

| Орчин | Хэзээ | QPay-д хүрэх эсэх |
|---|---|---|
| **Mock** | Өдөр тутмын хөгжүүлэлт, UI-ийн ажил | Үгүй |
| **Harness** (`qpay/`) | API-ийн хариултыг өөрөө харах, шинэ endpoint судлах | Тийм (10₮) |
| **Бодит** | Гарахын өмнөх хүлээн авалт, callback шалгах | Тийм (бодит мөнгө) |

---

## 2. Env хувьсагчид

```bash
# Заавал (эдгээр гурав байхгүй бол апп автоматаар mock руу унана)
QPAY_USERNAME=VONSCENT
QPAY_PASSWORD=...
QPAY_INVOICE_CODE=VONSCENT_INVOICE

# Заавал биш
QPAY_BASE_URL=https://merchant.qpay.mn/v2   # анхдагч
QPAY_MOCK=true                              # креденшиалтай ч mock-оор ажиллуулна
DEBUG_QPAY=1                                # бүх request/response-ыг лог (нууц утга маскална)

# Callback-ийн эх суурь. Заавал биш — байхгүй бол NEXT_PUBLIC_SITE_URL.
QPAY_CALLBACK_URL=https://vonscent.mn

# Төлбөр тулгалтын cron (/api/cron/reconcile-payments). Тавигдаагүй бол route
# нь өөрийгөө 503-аар хаана — нээлттэй орхивол QPay-ийн квот шатаах вектор.
CRON_SECRET=<урт санамсаргүй мөр>

# Callback-ийн замд шигтгэх нууц. QPay гарын үсэг өгдөггүй тул дуудагчийг
# таних цорын ганц арга. Тавигдсан үед хуучин нууцгүй зам 404 болно.
QPAY_CALLBACK_SECRET=<урт санамсаргүй мөр>

# Тестийн дүн (заавал биш). Тавьсан үед QR нь захиалгын бүтэн дүнгийн оронд
# энэ дүнг нэхнэ — ГЭХДЭЭ ЗӨВХӨН ажилтны (operator / super_admin) захиалгад.
QPAY_TEST_AMOUNT=10
NEXT_PUBLIC_SITE_URL=https://vonscent.mn
```

> **QPay localhost callback-ыг татгалздаггүй** (2026-09-08-нд хэмжив — docs-д
> өөрөөр бичсэн ч `http://localhost:3000/...`-той invoice 200-аар үүслээ).
> Зүгээр л хэзээ ч тэр рүү хандаж чадахгүй. Локалд энэ нь асуудал биш:
> төлбөрийн хуудас QPay-ээс шууд дахин асуудаг (`verify=1`) тул callback
> ирэхгүй байх нь хэдхэн секунд л нэмнэ.

`callback_url`-ыг код өөрөө угсарна:
`${NEXT_PUBLIC_SITE_URL}/api/payments/qpay/webhook?order=<order_no>`
(`callbackUrlFor()`, `src/lib/payments/invoice.ts`).

**Локалд бодит QPay руу холбох (2026-09-08-нд хийсэн):**

1. `QPAY_USERNAME` / `QPAY_PASSWORD` / `QPAY_INVOICE_CODE` гурвыг аппын `.env`-д
   бөглө. Эдгээр нь `qpay/.env`-д байдаг ч **аппын `.env` тусдаа** — хоосон
   байвал апп чимээгүйхэн mock руу унана (`isQpayMockMode()` креденшиал
   байхгүй бол `true` буцаадаг).
2. `QPAY_MOCK=false`.
3. `pnpm dev`-ийг **дахин эхлүүл** — Next нь env-ийг эхлэхдээ л уншина.

Шалгах: захиалга үүсгэхэд хариулт `"qpayMock": false` байх ба
`/pay/<token>` дээр 23 бодит лого, бодит PNG QR гарна. Буцаж mock руу орох
бол `QPAY_MOCK=true` болгоод дахин эхлүүл.

> ⚠️ `qpay/` фолдер git-д ороогүй (`git ls-files qpay/` хоосон), дотор нь
> `.env` ба `requirement.md` нь нууц үг агуулдаг тул `qpay/.gitignore`-оор
> хаагдсан. Өөр машин дээр ажиллуулах бол `.env.example`-ээс хуулж бөглөнө.

---

## 3. Mock орчинд тест (30 секунд)

Креденшиалгүйгээр бүх урсгалыг эцсээс эцэс хүртэл шалгана.

```bash
# .env дотор QPAY_MOCK=true (эсвэл QPAY_* гурвыг хоосон болго)
pnpm dev
```

1. Сагсанд бараа нэмээд `/checkout` → QPay сонгоод захиалга өг.
2. `/pay/<token>` руу автоматаар шилжинэ. **Mock** тэмдэг, SVG QR харагдана.
3. **«Төлбөр баталгаажуулах (mock)»** дар.
4. Хуудас «Төлбөр амжилттай — захиалга баталгаажлаа» болно.

Шалгах зүйлс:

- `orders.status`: `pending` → `confirmed`, `payment_status` → `paid`
- `inventory.reserved_ml` буурч, `on_hand_ml` мөн буурсан (commit болсон)
- `orders.reserve_expires_at` = `null`
- `order_status_history`-д «Төлбөр төлөгдсөн» мөр нэмэгдсэн
- Хэрэглэгчид имэйл, админд Telegram (env тохируулагдсан бол)

Mock үед `/api/payments/qpay/webhook` нь **403 MOCK_MODE** буцаана — симуляц
зөвхөн `/api/payments/qpay/mock/confirm`-оор явна, тэр нь mock орчинд л
ажиллана. Бодит креденшиал орсон даруйд мөн 403 болно.

---

## 4. Harness (`qpay/`) — API-г шууд харах

Бодит API-д хүрдэг, зөвхөн 10₮-ийн invoice үүсгэдэг тусдаа жижиг проект.
`node_modules` нь тусдаа:

```bash
cd qpay
cp .env.example .env      # QPAY_USERNAME / PASSWORD / INVOICE_CODE бөглө
npm install
```

| Команд | Юу хийдэг |
|---|---|
| `npm run token` | `POST /auth/token` — кэшийг мөн шалгана (2 дахь дуудалт сүлжээнд хүрэхгүй) |
| `npm run invoice` | `POST /invoice` — 10₮-ийн invoice, QR-ыг `out/`-д PNG болгож хаяна |
| `npm run check` | `POST /payment/check` — сүүлийн invoice төлөгдсөн эсэх |
| `npm run invoice:get` | `GET /invoice/{id}` |
| `npm run invoice:cancel` | `DELETE /invoice/{id}` |

> ⚠️ `npm run invoice` дуудлага бүр **шинэ бодит invoice үүсгэнэ**
> (`sender_invoice_no` нь timestamp). Дуусаад `npm run invoice:cancel`-ээр
> цэвэрлэ — цуцлагдсаныг `npm run invoice:get` дээр `CANCELED` гэж харна.
> Үүсгэсэн invoice бүрийн id нь `out/qr-<id>.png` нэрээр үлддэг.

`DEBUG_QPAY=1` тавибал бүх request/response JSON гарна (token, password
маскална; `qr_image` нь урттай тул хэмжээгээр л харуулна).

Аппын клиент нь энэ harness-ээс порт хийгдсэн — шинэ зүйл судлах бол эхлээд
harness дээр батлаад, дараа нь `src/lib/payments/qpay.ts` руу авчирна.

---

## 4.5 Бодит төлбөрийг 10₮-өөр турших

QPay-д sandbox байхгүй тул callback бодитоор ирэхийг харах цорын ганц арга бол
үнэхээр төлөх. Гэхдээ 19,000₮-ийн захиалга тутамд бүтнээр нь төлөх шаардлагагүй:

```bash
QPAY_TEST_AMOUNT=10
```

Тавьсан үед `/pay/<token>`-ийн QR **10₮** нэхнэ. Захиалгын `total` хэвээр —
зөвхөн QPay-ийн цуглуулах дүн өөрчлөгдөж, `qpay_invoices.amount`-д бичигдэнэ.

**Хамгаалалт — зөвхөн ажилтны захиалгад үйлчилнэ.** `NODE_ENV` биш, худалдан
авагчаар нь шүүдэг: захиалга `operator` эсвэл `super_admin` эрхтэй хэрэглэгчийнх
байх ёстой. Тиймээс энэ хувьсагчийг production-д санамсаргүй тавьсан ч
хэрэглэгчээс 10₮ авах боломжгүй, харин ажилтан бодит сайт дээр тестлэж чадна.

Төлбөрийн хуудсанд улаан «Тест горим — QR нь 10₮ нэхнэ» гэсэн зурвас гарна.
Гарахгүй байвал таны бүртгэл ажилтны эрхгүй байна.

Баталгаажуулалт мөн **invoice-ийн дүнтэй** харьцуулдаг болсон (`orders.total`
биш) — эс тэгвээс 10₮ төлсөн тест захиалга мөнхөд «төлөгдөөгүй» хэвээр үлдэнэ.

## 5. Бодит төлбөрийн тест

### 5.1 Callback хүлээж авах

QPay `callback_url`-д **localhost хүлээж авахгүй**. Хоёр арга:

**А. Tunnel (локал код тест хийх)**

```bash
# cloudflared (заавал бүртгэл шаардахгүй)
cloudflared tunnel --url http://localhost:3000
# → https://<random>.trycloudflare.com

# гарсан URL-ыг .env-д тавь, dev-ийг ДАХИН эхлүүл
NEXT_PUBLIC_SITE_URL=https://<random>.trycloudflare.com
```

**Б. Preview deploy (илүү бодитой)** — Vercel preview дээр QPay env-ийг
тохируулаад тэр домэйныг `NEXT_PUBLIC_SITE_URL` болгоно.

### 5.2 Урсгал

1. `QPAY_MOCK`-ыг **устга** (эсвэл `false`), гурван креденшиалыг тохируул.
2. Хямд захиалга үүсгэ. Хамгийн бага дүн нь хүргэлтийн хураамжаас хамаарна —
   `settings.shipping`-ийг түр 0 болгож, 2ml бараа сонговол хамгийн бага дүн
   гарна.
3. `/pay/<token>` дээр:
   - **Апп сонголт** — QPay-ийн «Төлбөрийн хэрэгсэл» шиг **Банк**, **Цахим
     хэтэвч** гэж бүлэглэгдсэн, 4 баганатай айкон сүлжээ. Утаснаас нэгийг
     дарж бодит апп нээгдэхийг шалга. Апп суулгаагүй бол 1.5 секундын дараа
     «апп нээгдсэнгүй» гэсэн тайлбар гарах ёстой.
   - **Сүүлд хэрэглэсэн** — нэг апп дараад хуудсыг сэргээхэд тэр нь дээд талд
     тусдаа мөр болж гарах ёстой (`localStorage`: `vonscent-last-bank`).
   - **QR** — desktop дээр шууд, утсан дээр «QR кодоор төлөх» дарж нээнэ.
   - **линкээр төлөх** — `qPay_shortUrl`.
4. Төл.
5. Хуудас 3 секундэд нэг `payment_status`-ыг, 15 секундэд нэг **QPay-ээс
   шууд** шалгадаг тул автоматаар «Төлбөр амжилттай» болно.

### 5.3 Юу шалгах

```sql
-- Захиалгын төлөв
select order_no, status, payment_status, total, reserve_expires_at, qpay_invoice_id
  from orders order by created_at desc limit 5;

-- Хадгалагдсан invoice артефакт
select order_id, invoice_id, amount, short_url,
       length(qr_text) as qr_text_len,
       length(qr_image) as qr_image_len,
       jsonb_array_length(deeplinks) as banks
  from qpay_invoices order by created_at desc limit 5;

-- Нэг захиалгад нэг invoice байх ёстой (idempotency)
select order_id, count(*) from qpay_invoices group by order_id having count(*) > 1;

-- Төлбөрийн дараах түүх
select * from order_status_history
 where order_id = (select id from orders order by created_at desc limit 1)
 order by created_at;
```

`banks` нь 23 орчим, `qr_image_len` ~10,000 байх ёстой. `banks = 0` бол
deeplink ирээгүй — QPay-ийн хариултыг `DEBUG_QPAY=1`-ээр хар.

### 5.4 Callback-ыг гараар давтах

QPay-ийн ping-ийг симуляц хийх (бодит invoice төлөгдсөн байх шаардлагатай —
endpoint нь QPay-ээс дахин шалгадаг):

```bash
curl -i "https://<domain>/api/payments/qpay/webhook/$QPAY_CALLBACK_SECRET?order=VS-1042"
```

| Хариу | Утга |
|---|---|
| `200 {"ok":true}` | Төлбөр батлагдаж захиалга `confirmed` болсон |
| `402 NOT_PAID` | QPay төлбөр байхгүй гэж хэлж байна |
| `402 NO_INVOICE` | Захиалгад `qpay_invoice_id` байхгүй |
| `404 ORDER_NOT_FOUND` | Захиалгын дугаар буруу |
| `502 CHECK_FAILED` | QPay-тэй холбогдож чадсангүй — **QPay дахин оролдоно** |
| `403 MOCK_MODE` | Апп mock орчинд байна |

`CHECK_FAILED` нь зориуд 5xx: QPay 4xx-ыг «болсон» гэж үзээд дахин
оролддоггүй, харин бодит төлбөр батлагдаагүй үлдэх нь хамгийн хортой хувилбар.

---

## 6. Төлбөрийн урсгал (кодын зураг)

```
/checkout
  └─ POST /api/orders
       ├─ claimOrderRequest()      → идемпотентын эзэмшил (order_requests, 0087)
       ├─ place_order()            → orders.status = 'pending', нөөц түгжигдэнэ
       ├─ completeOrderRequest()   → эзэмшлийг захиалгад холбоно
       ├─ ensureInvoice()          → claim (0086) → POST /invoice → qpay_invoices
       ├─ sendOrderCustomerEmail('placed') → дугаар + төлбөрийн линк
       └─ { payToken } буцаана
  └─ router.push(/pay/<payToken>)

/pay/[token]                        (force-dynamic, robots: noindex)
  ├─ getPaymentByToken()            → order + invoice (байхгүй бол үүсгэнэ)
  └─ PaymentPanel
       ├─ 3 сек тутам  GET /api/payments/status?token=…
       ├─ 15 сек тутам GET …&verify=1        → QPay-ээс шууд шалгана
       └─ «Төлбөрөө шалгах» товч ба mock товч

Төлбөр орж ирэхэд (аль нэг замаар):
  QPay callback  ─┐
  эсвэл verify=1 ─┴─→ verifyAndMarkOrderPaid()
                        ├─ checkPayment()   → QPay: бодитоор төлөгдсөн үү?
                        └─ mark_order_paid()→ status = 'confirmed',
                                              нөөц commit, имэйл + Telegram
```

### Сэргээх замууд (алдагдсан захиалга)

```
/order/find          дугаар + утас → /api/orders/lookup → /order/<pay_token>
/order/<pay_token>   захиалгын төлөв + «Төлбөр төлөх» (нэвтрэх шаардлагагүй)
/account/orders      бүртгэлтэй хэрэглэгчид — карт бүр дээр «Төлбөр төлөх»
имэйл                захиалга үүсэхэд «Төлбөрөө хийх» линк (contact_email)
```

`/api/cron/reconcile-payments` (Vercel Cron, 5 мин тутам) нь `unpaid` +
invoice-той захиалга бүрийг QPay-ээс дахин асууна. Нөөцийн хугацаа 35 минут —
`release_expired_reserves` цуцлахаас өмнө дор хаяж нэг тулгалт өнгөрөх
математик баталгаа. `CRON_SECRET` тавигдаагүй бол route нь 503 буцаана.

**Захиалга төлбөрийн дараа батална.** `place_order` нь `pending` төлөвтэй
захиалга үүсгээд нөөцийг л түгжинэ; `confirmed` болох цорын ганц зам нь
`mark_order_paid`. Төлөгдөөгүй захиалга `reserve_expires_at`-д хүрээд
`release_expired_reserves` (pg_cron)-оор цуцлагдаж, бараа дэлгүүрт буцна.

`checkPayment` нь `null` буцаавал энэ нь **«батлагдаагүй»**, «төлөгдөөгүй» биш
— QPay-ийн доголдлыг «төлбөр байхгүй» гэж үзвэл бодит мөнгө хэрэгсэхгүй болно.

---

## 6.5 QPay-ийн хязгаарлалт: гүйлгээг байнга бүү шалга

QPay-ийн Merchant V2 баримтад `payment/check` ба `GET /payment/{id}` хоёрын
доор шууд бичсэн байдаг:

> **АНХААРУУЛГА:** Cron job ашиглан гүйлгээг байнга шалгахыг хориглоно.
> Заавал Callback URL хүлээн авсны дараа шалгана уу.

Энэ нь кодын хоёр газарт хязгаар тавьдаг тул **өргөтгөхөөсөө өмнө уншина уу**:

1. **`/api/cron/reconcile-payments`** — бүх төлөгдөөгүй захиалгыг сканнердах
   уруу таталт байнга гарна. Гэхдээ энэ route зориуд зөвхөн
   `reserve_expires_at` нь дараагийн 6 минутад дуусах захиалгыг л авдаг:
   захиалга тутамд амьдралынхаа туршид **дээд тал нь нэг** нэмэлт
   `payment/check`, тэр нь буцаагдашгүй цуцлалтын өмнөх сүүлчийн боломж дээр.
   Энэ бол давтамжит хяналт биш. Query-г өргөтгөвөл хориг руу буцна —
   `route.test.ts`-ийн «scope» тестүүд үүнийг цоожилсон.

2. **`/pay/[token]`-ийн poller** — 3 секунд тутам ӨӨРИЙН DB-ээ асуудаг (QPay-д
   хүрэхгүй, хямд), 20 дахь бүрд нь л (60 сек) QPay руу `verify=1` явуулна.
   Энэ нь 15 секунд байсныг сулруулсан хувилбар: нэг нээлттэй хуудас 20
   минутын турш ~80 `payment/check` үүсгэж байв. Дахин богиносговол мөн тэр
   хоригтой мөргөлдөнө.

Хэрэв QPay-ийн квот/хязгаарын талаар анхааруулга ирвэл эхлээд эдгээр хоёр
тоог хар: `PRE_EXPIRY_MINUTES` (cron) ба `VERIFY_EVERY` (payment-panel.tsx).

## 6.6 Буцаалт — яагаад гараар хэвээр вэ

QPay-д `DELETE /v2/payment/refund/{payment_id}` ба
`DELETE /v2/payment/cancel/{payment_id}` байдаг ч хоёулаа баримтаараа
**зөвхөн картын гүйлгээнд**:

> «**Картын гүйлгээний** төлбөрийг буцаахад ашиглана.»
> «**АНХААРУУЛГА:** Картын гүйлгээний үед буцаах боломжтой.»

Манай урсгал бол QR → банкны апп deeplink, өөрөөр хэлбэл **дансны
шилжүүлэг** — картын гүйлгээ биш. Тиймээс автомат буцаалт бодит захиалгын
бараг бүхэнд ажиллахгүй бөгөөд зориуд **хийгээгүй**.

Буцаалт нь хэвээрээ хоёр алхам:

1. Оператор QPay-ийн мерчант порталаас гараар буцаана —
   `/admin/orders/<id>` дээрх **QPay гүйлгээний дугаар** (`qpay_payments`,
   0089) нь тэр хайлтын түлхүүр.
2. Сайт дээр «Буцаасан гэж тэмдэглэх» дарж баримтыг бүртгэнэ
   (`mark_order_refunded`, 0073 — мөнгө хөдөлгөхгүй, зөвхөн төлөв).

Энэ дараалал (эхлээд цуцлалт, дараа нь буцаалт) нь дүрэм: цуцлалт л мл,
оноо, купоныг буцаадаг.

## 7. Хамгаалалт

- **`pay_token`, `order_no` биш.** `order_no` нь `VS-1000`, `VS-1001` … гэсэн
  sequence (0006) — тааж олох боломжтой. Тиймээс төлбөрийн хуудас,
  status endpoint, mock confirm бүгд токеноор ажиллана.
- **Callback-д гарын үсэг байхгүй** (албан ёсоор батлагдсан). Тиймээс webhook
  нь өөрт ирсэн өгөгдлийг хэзээ ч шууд хүлээж авахгүй — QPay-ээс
  `payment/check`-ээр дахин шалгана. Нэмээд зам нь нууц сегменттэй
  (`QPAY_CALLBACK_SECRET`) ба хурдны хязгаартай: `order_no` дараалсан тул
  нууцгүй endpoint нь захиалгын төлвийг зураглах оракул, мөн QPay-ийн квот
  шатаах хүчитгэгч болдог.
- **Дүн бүтэн төлөгдсөн байх.** `paidAmount < order.total` бол `NOT_PAID`.
- **Mock confirm нь mock орчинд л ажиллана** — бодит креденшиалтай үед 403.
- Төлбөрийн хуудас нь холбоо барих нэр, утас, хаяг **харуулахгүй**: линк нь
  бусдад дамжиж болно.
- `/pay/[token]` нь `robots: noindex` — чат/мессенжер линкийг тайлж үздэг.

---

## 8. Түгээмэл асуудлууд

| Шинж тэмдэг | Шалтгаан | Юу хийх |
|---|---|---|
| QR хоосон/эвдэрсэн дөрвөлжин | `qr_image`-д `data:` угтвар нэмэгдээгүй | `toDataUrl()` дамжсан эсэхийг шалга |
| Банкны логонууд гарахгүй | `next.config.ts`-д `qpay.mn` / `s3.qpay.mn` байхгүй | `remotePatterns`-ыг шалга |
| Банкны апп жагсаалт хоосон | `deeplinks` нь `[]` — invoice хуучин, эсвэл QPay `urls` буцаагаагүй | `qpay_invoices`-ыг хар; шинэ invoice үүсгэ. Mock орчинд бол хавтангууд линкгүй харагдана — энэ нь хэвийн |
| Банк дарахад юу ч болохгүй | Тухайн апп суулгаагүй — custom scheme дуугүй бүтдэг | 1.5 секундын дараа гарах тайлбарыг хар; өөр банк эсвэл QR ашигла |
| Банкны нэр англиар | `qpay-banks.ts`-д тэр scheme байхгүй | Шинэ аппыг `BANKS`-д нэм (QPay-ийн нэр fallback болж ажилласаар байна) |
| Шинэ апп «Бусад» бүлэгт орсон | Мөн адил — scheme бүртгэгдээгүй | `BANKS`-д `category` зааж нэм |
| «Сүүлд хэрэглэсэн» гарахгүй | `localStorage` хаагдсан (private цонх) эсвэл өмнө нь апп дараагүй | Хэвийн — тэр хэсэг зүгээр л харагдахгүй |
| Хуудас мөнхөд «хүлээж байна» | Callback ирээгүй | «Төлбөрөө шалгах» дар (`verify=1`); tunnel/`NEXT_PUBLIC_SITE_URL`-ыг шалга |
| `401` бүх дуудалтад | Креденшиал буруу, эсвэл `QPAY_BASE_URL` алдаатай | `npm run token` harness дээр |
| Token дахин дахин авагдана | `expires_in`-ыг TTL гэж уншсан | `expiresAtFromTokenResponse` тест 3 мөрийг үз |
| Нэг захиалгад 2 invoice | `createInvoice`-ыг шууд дуудсан | Зөвхөн `ensureInvoice`-оор дамжуул |
| Захиалга `confirmed` болохгүй | `mark_order_paid` алдаа, эсвэл дүн бүтэн биш | `502/402`-ын хариуг ба `orders.total`-ыг хар |
| Mock товч 403 | Креденшиал орчинд байна | Хүсвэл `QPAY_MOCK=true` тавь |

---

## 9. Гарахын өмнөх чеклист

- [ ] `QPAY_USERNAME` / `QPAY_PASSWORD` / `QPAY_INVOICE_CODE` production env-д
- [ ] `QPAY_MOCK` production-д **байхгүй** (эсвэл `false`)
- [ ] `QPAY_TEST_AMOUNT` production-д **байхгүй** (ажилтны эрхээр хамгаалагдсан
      ч тавих шалтгаан байхгүй)
- [ ] `NEXT_PUBLIC_SITE_URL = https://vonscent.mn` (QPay localhost авахгүй)
- [ ] Migration 0088–0090 хийгдсэн (`revoke`, `qpay_payments`,
      `mark_order_paid(p_by, p_source)`)
- [ ] anon key-ээр `rpc/mark_order_paid` дуудахад `42501` (0088 ажиллаж буйг
      баталгаажуулна); аппын бүх урсгал хэвийн
- [ ] Төлбөр батлагдсаны дараа `qpay_payments`-д мөр орж, админы захиалгын
      хуудсанд гүйлгээний дугаар харагдана
- [ ] Гараар «Төлсөн гэж тэмдэглэх» дарахад түүхэнд «(гараар тэмдэглэсэн)»
      гэж бичигдэж, `changed_by` дүүрнэ
- [ ] Захиалга цуцлахад QPay invoice нь `CANCELED` болсныг
      `npm run invoice:get` (harness) -ээр батал
- [ ] `CRON_SECRET` production env-д (эс тэгвээс төлбөр тулгалт ажиллахгүй —
      алдагдсан callback-тай захиалга 35 минутын дараа цуцлагдана)
- [ ] `migrate`: 0086 (invoice claim), 0087 (order_requests) хийгдсэн
- [ ] `/api/cron/reconcile-payments` нууцгүйгээр 401, нууцтайгаар 200
- [ ] Зочны сэргээх зам: `/order/find` дээр дугаар + утсаар захиалга олдоно;
      буруу утсаар «олдсонгүй» гэдэг ИЖИЛ хариу гарна
- [ ] Бодит нэг төлбөр эцсээс эцэс хийж, `orders.status = 'confirmed'` болсон
- [ ] Callback бодитоор ирсэн (лог/`order_status_history`-ээр батлагдсан)
- [ ] Банкны аппын deeplink утаснаас ажилласан (дор хаяж 2 банк)
- [ ] Банкны лого бүгд гарсан (гарахгүй бол хавтан дээр нэрний товчлол харагдана)
- [ ] `select order_id, count(*) … having count(*) > 1` хоосон (idempotency)
- [ ] `qpay_invoices` дээр RLS ажиллаж байгаа (anon уншиж чадахгүй)
- [ ] Банкны шилжүүлгийн данс `BANK_TRANSFER` (`src/lib/constants.ts`) дээр
      бодит утга — одоо байгаа нь **байршуулагч**
- [ ] `docs/qpay-testing.md` §0-ын 4 хамгаалалт бүгд тестээр хучигдсан
      (`pnpm test src/lib/payments` — 24 тест;
      `pnpm test src/features/payment` — хуудасны 12 тест)

---

## 10. Батлагдаагүй үлдсэн зүйлс

Бодит төлбөр хийх үед нэмж бататгах шаардлагатай (`qpay/FINDINGS.md` §
«Бататгаагүй»-г мөн үз):

1. ~~`payment/check`-ийн `payment_status`-ийн утгууд~~ → **батлагдав
   (2026-09-17, албан ёсны баримт):** `NEW`, `FAILED`, `PAID`, `REFUNDED`.
   Код зөвхөн `PAID`-ыг тоолдог нь зөв — `REFUNDED` мөр эерэг дүнтэй байдаг
   тул түүнийг тоолвол буцаасан мөнгийг дахин орлого гэж бүртгэх байв.
   `rows[]`-ийн бодит бүтэц бодит төлбөрөөр хараахан хараагүй хэвээр.
2. Callback-ыг QPay яг ямар методоор (GET vs POST) дууддаг. Код хоёуланг нь
   хүлээж авдаг. **Гарын үсэг/HMAC/IP allowlist нь байхгүй нь батлагдсан** —
   тиймээс хамгаалалт нь замын нууц сегмент (`QPAY_CALLBACK_SECRET`).
3. ~~Төлөгдсөний дараах `invoice_status`~~ → **батлагдав (2026-09-17):**
   `OPEN` → `CLOSED` (төлөгдсөн), `CANCELLED` (цуцалсан). Код `invoice_status`
   -ыг уншдаггүй тул өөрчлөлт шаардлагагүй.
4. ~~`deeplinks`-ийн бүтэн линкийн формат~~ → **батлагдав (2026-09-08).**
   23 линк бүгд `<scheme>://q?qPay_QRcode=<qr_text>`, `qr_text` нь бүгдэд ижил.
   Апп нь QPay-ийн линкийг хадгалсаар байна — QPay банк нэмэхэд жагсаалт өөрөө
   шинэчлэгддэг бол угсарсан хувилбар кодын өөрчлөлт шаардана.
