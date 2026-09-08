# QPay V2 — бодит API-аас ажиглагдсан зүйлс

Бүх утга `https://merchant.qpay.mn/v2` (production), `VONSCENT` клиентээр
**2026-09-07**-нд ажиглагдаж, **2026-09-08**-нд дахин баталгаажсан. Нууц утгууд
таслагдсан.

---

## 1. `POST /auth/token`

Basic auth, body **шаардахгүй**. HTTP 200.

```json
{
  "token_type": "bearer",
  "refresh_expires_in": 1788800862,
  "refresh_token": "eyJhbGciOiJI…",
  "access_token": "eyJhbGciOiJI…",
  "expires_in": 1788800862,
  "scope": "get_token",
  "not-before-policy": "0",
  "session_state": "prod_new"
}
```

**Хамгийн чухал олдвор:** `expires_in` нь **unix timestamp (секунд)**, TTL биш.
`1788800862` = `2026-09-07T17:07:42Z` — өөрөөр хэлбэл token нь **~24 цаг**
хүчинтэй. Хэрэв үүнийг TTL гэж үзвэл `now + 1788800862 сек` = 2083 он гэсэн
утгагүй хугацаа гарна; эсрэгээрээ TTL гэж тооцох кодыг timestamp-аар хооллоход
token хэзээ ч дуусахгүй мэт харагдана. `src/client.ts`-ийн
`expiresAtFromTokenResponse` хоёуланг нь зөв ялгаж авдаг.

`not-before-policy` нь **string** ("0") ирж байна, тоо биш.

`access_token` нь ~364 тэмдэгтийн JWT.

---

## 2. `POST /invoice`

Илгээсэн body:

```json
{
  "invoice_code": "VONSCENT_INVOICE",
  "sender_invoice_no": "VS-TEST-1788714468077",
  "invoice_receiver_code": "terminal",
  "invoice_description": "VONSCENT test VS-TEST-1788714468077",
  "amount": 10,
  "callback_url": "https://vonscent.mn/api/payments/qpay/webhook"
}
```

Хариулт (HTTP 200):

```json
{
  "invoice_id": "c85af2b4-8e1d-4677-a667-115c07606020",
  "qr_text": "00020101021215312794049627940496…6304AE86",
  "qr_image": "<base64 PNG, ~10 344 тэмдэгт>",
  "qPay_shortUrl": "https://s.qpay.mn/zNr4bs145B",
  "urls": [ /* 23 ширхэг */ ]
}
```

- `invoice_id` — UUID.
- `qr_text` — EMVCo QR payload. Мерчантын нэр `BALJINNYaMBAYaNBILEG`,
  хот `ULAANBAATAR` гэж шууд шигтгэгдсэн байна.
- `qr_image` — **`data:` угтваргүй** цэвэр base64 PNG. `<img>`-д ашиглахдаа
  `data:image/png;base64,` угтварыг өөрөө нэмнэ.
- `qPay_shortUrl` — вэб дээр линк болгож тавихад тохиромжтой.

### `urls[]` — 23 банк/wallet

Бүгд ижил `qr_text`-ийг `?qPay_QRcode=` параметрээр агуулна; **зөвхөн scheme
нь ялгаатай**. Тиймээс UI-д линк бүрийг тусад нь хадгалах шаардлагагүй —
`name` + `logo` + `link` гурвыг л харуулна.

Ажиглагдсан жагсаалт:

| # | name | scheme |
|---|---|---|
| 1 | qPay wallet | `qpaywallet://` |
| 2 | Khan bank | `khanbank://` |
| 3 | State bank 3.0 | `statebankmongolia://` |
| 4 | Xac bank | `xacbank://` |
| 5 | Trade and Development bank | `tdbbank://` |
| 6 | Social Pay | `socialpay-payment://` |
| 7 | Most money | `most://` |
| 8 | National investment bank | `nibank://` |
| 9 | Chinggis khaan bank | `ckbank://` |
| 10 | Capitron bank | `capitronbank://` |
| 11 | Bogd bank | `bogdbank://` |
| 12 | Trans bank | `transbank://` |
| 13 | M bank | `mbank://` |
| 14 | Ard App | `ard://` |
| 15 | Toki App | `toki://` |
| 16 | Arig bank | `arig://` |
| 17 | Monpay | `monpay://` |
| 18 | Hipay | `hipay://` |
| 19 | Happy Pay | `tdbwallet://` |
| 20 | Sono | `sono://` |
| 21 | PayOn | `payon://` |
| 22 | Tino | `tino://` |
| 23 | Pass.mn | `pass://` |

`logo` нь `https://qpay.mn/q/logo/*.png` эсвэл `https://s3.qpay.mn/p/*`.
Next.js-д ашиглах бол `next.config.ts`-ийн `images.remotePatterns`-д эдгээр
хостыг нэмэх хэрэгтэй болно. **2026-09-08:** 23 линкийн лого зөвхөн энэ хоёр
хостоос ирснийг бүтнээр шалгав.

### ✅ Deeplink-ийн формат батлагдав (2026-09-08)

Урьд нь «зөвхөн scheme нь ялгаатай» гэж таамагласныг 23 линк дээр бүтнээр
шалгалаа. Бүгд яг ийм хэлбэртэй, ганц ч ялгаагүй:

```
<scheme>://q?qPay_QRcode=<qr_text>
```

`qr_text` нь 23 линкэд **яг ижил** — invoice-ийн үндсэн `qr_text`. Өөрөөр
хэлбэл scheme-ийн жагсаалт мэдэгдэж байвал линкийг дахин угсарч болно.

Гэсэн ч апп нь QPay-ийн буцаасан линкийг **хадгалсаар байна**
(`qpay_invoices.deeplinks`): QPay маргааш банк нэмэхэд хадгалсан жагсаалт
өөрөө шинэчлэгддэг бол угсарсан жагсаалт кодын өөрчлөлт шаардана.

Батлагдсан 23 scheme (`src/lib/payments/qpay-banks.ts`-ийн бүртгэлтэй яг
таарсан): `ard`, `arig`, `bogdbank`, `capitronbank`, `ckbank`, `hipay`,
`khanbank`, `mbank`, `monpay`, `most`, `nibank`, `pass`, `payon`,
`qpaywallet`, `socialpay-payment`, `sono`, `statebankmongolia`, `tdbbank`,
`tdbwallet`, `tino`, `toki`, `transbank`, `xacbank`.

### ⚠ `sender_invoice_no` давхардлыг QPay ХОРИГЛОДОГГҮЙ

Тусгайлан туршиж үзсэн: яг нэг `sender_invoice_no`-оор дараалан 2 удаа
`POST /invoice` дуудахад **хоёулаа HTTP 200 буцаж, өөр өөр `invoice_id`
үүслээ**. Docs-д "unique байх ёстой" гэж бичсэн ч API талаас албадан
шалгадаггүй.

Үр дагавар: нэг захиалгад олон invoice үүсэх, тус бүр нь тусад нь төлөгдөх
эрсдэлтэй. Иймд **idempotency-г мерчант тал өөрөө хариуцна** — захиалгад
`qpay_invoice_id` аль хэдийн байвал шинэ invoice үүсгэхгүй, хуучныг нь буцаах.

---

## 3. `GET /invoice/{invoice_id}`

```json
{
  "invoice_id": "c85af2b4-8e1d-4677-a667-115c07606020",
  "invoice_status": "OPEN",
  "sender_invoice_no": "VS-TEST-1788714468077",
  "invoice_description": "VONSCENT test VS-TEST-1788714468077",
  "invoice_due_date": null,
  "enable_expiry": false,
  "expiry_date": "2026-09-06T17:07:48.599Z",
  "allow_partial": false,
  "minimum_amount": "0.00",
  "allow_exceed": false,
  "maximum_amount": "0.00",
  "total_amount": "10.00",
  "gross_amount": 10,
  "tax_amount": 0,
  "surcharge_amount": 0,
  "discount_amount": 0,
  "callback_url": "https://vonscent.mn/api/payments/qpay/webhook",
  "lines": [ { "line_description": "…", "line_quantity": "1.00", "line_unit_price": "10.00", … } ],
  "transactions": []
}
```

- `invoice_status` = **`"OPEN"`** (төлөгдөөгүй үед).
- **Дүнгийн төрөл холимог:** `total_amount` нь **string** (`"10.00"`),
  харин `gross_amount`/`tax_amount`/`discount_amount` нь **number** (`10`, `0`).
  Аль алиныг нь `Number()`-ээр дамжуулж харьцуулах хэрэгтэй.
- `lines[]` автоматаар үүсдэг — бид `lines` илгээгээгүй ч
  `invoice_description`-оос нэг мөр үүсгэсэн.
- `expiry_date` нь `enable_expiry: false` байхад ч буцаж ирдэг —
  утга нь бодитоор хэрэгжихгүй.

---

## 4. `POST /payment/check`

Илгээсэн body:

```json
{
  "object_type": "INVOICE",
  "object_id": "c85af2b4-8e1d-4677-a667-115c07606020",
  "offset": { "page_number": 1, "page_limit": 100 }
}
```

Хариулт (төлөгдөөгүй invoice):

```json
{ "count": 0, "rows": [] }
```

**Анхаар:** `paid_amount` талбар `count: 0` үед **огт байхгүй** (`undefined`),
`0` биш. `result.paid_amount > 0` гэж шалгах код TypeScript-д алдаа өгөхгүй ч
`undefined`-тай харьцуулж эндүү ажиллаж болзошгүй — `?? 0` заавал хийнэ.

Төлөгдсөн үед `rows[]` дотор `payment_id`, `payment_status` (`"PAID"`),
`payment_amount`, `payment_date`, `payment_wallet` ирнэ гэж docs-д заасан —
**энэ хэсэг бодит төлбөрөөр хараахан батлагдаагүй.**

---

## 5. `DELETE /invoice/{invoice_id}`

HTTP 200, body **хоосон объект `{}`**. Амжилтын ямар ч талбар буцаадаггүй —
статус кодыг л шалгана.

**2026-09-08:** цуцалсны дараа `GET /invoice/{id}` нь мөрөө устгадаггүй,
`invoice_status` нь **`"CANCELED"`** болно (нэг `L`-тэй, америк бичиглэл).
Гурван OPEN invoice цуцлаад гурвуулаа энэ утгыг буцаав.

---

## Бататгаагүй үлдсэн зүйлс

Эдгээрийг **бодит төлбөр** хийх үед (эсвэл tunnel босгож callback барих үед)
шалгах шаардлагатай. Бүгд нь төлбөр орж ирснээр л мэдэгдэх зүйлс:

1. `payment/check`-ийн `rows[]`-ийн бодит бүтэц ба `payment_status`-ийн утгууд.
   Код зөвхөн `"PAID"`-ыг мөнгө гэж тоолдог.
2. Callback-ыг QPay яг ямар метод (GET vs POST), ямар параметртэйгээр дууддаг.
   Код хоёуланг нь хүлээж авдаг.
3. `invoice_status` **төлөгдсөний** дараа ямар утга болох (`"CLOSED"`? `"PAID"`?).
   Цуцалсны утга нь `"CANCELED"` гэж §5-д батлагдсан.
4. Төлөгдсөн invoice-ыг `DELETE` хийхэд ямар алдаа буцаах.
5. `GET /payment/{payment_id}`, `POST /payment/list` — бодит payment_id хэрэгтэй.

### 2026-09-08-нд дахин батлагдсан

| Юу | Үр дүн |
|---|---|
| `expires_in` нь timestamp | 1788916398 → 2026-09-09T01:13Z, ~1440 мин |
| Token кэш | 2 дахь дуудалт сүлжээнд хүрээгүй (`fromCache: true`) |
| `payment/check` төлөгдөөгүй үед | `{ "count": 0, "rows": [] }` — `paid_amount` **түлхүүр огт байхгүй** |
| `invoice_status` шинэ invoice дээр | `"OPEN"` |
| `lines[]` автоматаар үүсэх | `invoice_description`-оос 1 мөр |
| `expiry_date` нь `enable_expiry: false` үед ч ирэх | Тийм, утга нь хэрэгжихгүй |
