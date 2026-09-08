# QPay V2 холболтын тест орчин (VONSCENT)

Энэ фолдер бол **бие даасан туршилтын орчин**. Зорилго нь QPay-ийн бодит API
яг ямар хэлбэрээр ажилладгийг батлаад, түүнийгээ `vonscent` төсөл рүү зөв
суулгах суурь болгох.

`vonscent` төслийн код энд **огт өөрчлөгддөггүй**.

- Ажиглагдсан бодит хариултууд → [`FINDINGS.md`](./FINDINGS.md)
- QPay-ээс ирсэн анхны мэдээлэл → `requirement.md` *(нууц үг агуулсан тул git-д орохгүй)*
- Албан ёсны баримт → https://developer.qpay.mn/mn/docs

---

## 1. Төлбөрийн урсгал

```
┌──────────┐                                           ┌──────────┐
│ Худалдан │                                           │  QPay    │
│  авагч   │                                           │  API     │
└────┬─────┘                                           └────┬─────┘
     │                                                      │
     │  1. Захиалга үүсгэх                                   │
     │ ─────────────────────►┌──────────────┐               │
     │                       │              │  2. POST /auth/token
     │                       │   Таны       │ ─────────────►│
     │                       │   сервер     │◄───────────── │  access_token (24 цаг)
     │                       │              │               │
     │                       │              │  3. POST /invoice
     │                       │              │ ─────────────►│
     │  4. QR + deeplink     │              │◄───────────── │  invoice_id, qr_text,
     │ ◄─────────────────────│              │               │  qr_image, urls[]
     │                       └──────┬───────┘               │
     │                              │                       │
     │  5. Банкны аппаас QR уншиж төлнө                      │
     │ ─────────────────────────────────────────────────────►│
     │                              │                       │
     │                       ┌──────┴───────┐  6. callback_url дуудна
     │                       │   Webhook    │◄───────────── │   (⚠ баталгаагүй)
     │                       │              │               │
     │                       │              │  7. POST /payment/check
     │                       │              │ ─────────────►│
     │                       │              │◄───────────── │  count, paid_amount, rows[]
     │                       │              │               │
     │                       │  8. Дүн тохирвол л            │
     │  9. "Төлөгдлөө"       │     захиалгыг paid болгоно    │
     │ ◄─────────────────────└──────────────┘               │
```

**Хамгийн чухал зарчим:** 6-р алхмын callback бол зөвхөн *"шалгаач"* гэсэн
дохио. Түүнд ирсэн дүн, статуст **хэзээ ч шууд итгэхгүй**. 7-р алхмын
`payment/check` л эцсийн үнэн — үүнийг requirement.md дээр QPay өөрөө
шаардсан байгаа.

---

## 2. Endpoint лавлах

Суурь URL: `https://merchant.qpay.mn/v2`

| Метод | Зам | Зориулалт | Гол талбарууд |
|---|---|---|---|
| `POST` | `/auth/token` | Token авах | Basic auth → `access_token`, `expires_in` |
| `POST` | `/auth/refresh` | Token сунгах | `Bearer <refresh_token>` |
| `POST` | `/invoice` | Нэхэмжлэх үүсгэх | → `invoice_id`, `qr_text`, `qr_image`, `urls[]` |
| `GET` | `/invoice/{id}` | Нэхэмжлэх харах | → `invoice_status`, `total_amount` |
| `DELETE` | `/invoice/{id}` | Нэхэмжлэх цуцлах | → `{}` |
| `POST` | `/payment/check` | **Төлбөр баталгаажуулах** | `object_type: "INVOICE"`, `object_id` → `count`, `paid_amount`, `rows[]` |
| `GET` | `/payment/{id}` | Гүйлгээ харах | → `payment_status` гэх мэт |
| `POST` | `/payment/list` | Гүйлгээний жагсаалт | `start_date`, `end_date`, `offset` |
| `DELETE` | `/payment/cancel/{id}` | Картын гүйлгээ буцаах | |
| `DELETE` | `/payment/refund/{id}` | Буцаалт | |

Токеноос бусад бүх дуудлагад `Authorization: Bearer <access_token>` шаардлагатай.

---

## 3. Ажиллуулах

```bash
cd /Users/shagai/Projects/von/qpay
npm install

cp .env.example .env    # дараа нь утгуудыг бөглөнө
```

`.env`-ийн утгууд (`requirement.md`-с):

| Хувьсагч | Утга |
|---|---|
| `QPAY_USERNAME` | `VONSCENT` |
| `QPAY_PASSWORD` | *(requirement.md-д байгаа)* |
| `QPAY_INVOICE_CODE` | `VONSCENT_INVOICE` |
| `QPAY_BASE_URL` | `https://merchant.qpay.mn/v2` |
| `QPAY_CALLBACK_URL` | public HTTPS URL (localhost болохгүй) |
| `QPAY_TEST_AMOUNT` | `10` |

Дараа нь дарааллаар:

```bash
npm run token          # 1. Token авах + кэш ажиллаж буйг батлах
npm run invoice        # 2. Нэхэмжлэх үүсгэх, QR-г терминалд зурах
npm run invoice:get    # 3. Нэхэмжлэхийн статус харах
npm run check          # 4. Төлбөр шалгах
npm run invoice:cancel # 5. Тест нэхэмжлэхээ цэвэрлэх
```

Алдаа гарвал бүтэн request/response-ыг харах:

```bash
DEBUG_QPAY=1 npm run invoice
```

`invoice_id`-г скриптүүд `out/last-invoice.json`-с автоматаар авна. Өөр
нэхэмжлэх шалгах бол аргументаар дамжуулна:

```bash
npm run check -- c85af2b4-8e1d-4677-a667-115c07606020
```

---

## 4. Хүлээгдэж буй үр дүн

`npm run token`
```
✓ access_token авлаа (364 тэмдэгт)
  fromCache : false  ← сүлжээгээр авсан
  expires_in (түүхий утга) : 1788800862
  тайлбар                  : unix timestamp (секунд) — TTL БИШ
✓ Дахин дуудав — fromCache: true
```

`npm run invoice`
```
✓ invoice_id: c85af2b4-…
  богино холбоос: https://s.qpay.mn/…
<терминал дээр бодит QR>
✓ qr_image хадгалагдлаа: out/qr-<id>.png
Банк / wallet deeplink (23):
  • Khan bank   khanbank://
  …
```

`npm run invoice:get` → `invoice_status : OPEN`

`npm run check`
```
count       : 0
paid_amount : 0
✓ Төлөгдөөгүй байна. Тест төлбөр хийгээгүй тул энэ нь ЗӨВ үр дүн.
```

> `count: 0` бол **алдаа биш**. Бодит төлбөр хийгээгүй тул гүйлгээ байхгүй нь
> зөв. Бодитоор 10₮ төлж үзвэл `count: 1`, `paid_amount: 10` болно.

---

## 5. Анхаарах зүйлс

### 5.1 Token-ийг заавал кэшлэх
requirement.md-д QPay тусгайлан "token-ийг timestamp-д тулгуурлан нэг удаагийн
давтамжтайгаар үүсгэ" гэж шаардсан. Дуудлага бүрт `/auth/token` руу хандах нь
буруу. `src/client.ts` нь token-оо кэшэлж, зэрэгцээ дуудлагад давхар token
авахаас сэргийлдэг (`inFlight` promise).

### 5.2 `expires_in` нь TTL БИШ, unix timestamp
`1788800862` гэдэг нь "1.7 тэрбум секундын дараа" биш, `2026-09-07T17:07:42Z`
гэсэн цаг. Буруу тайлбарлавал token эсвэл хэзээ ч дуусахгүй, эсвэл шууд
дууссан мэт харагдана. `expiresAtFromTokenResponse` хоёуланг нь зөв ялгадаг.
Бодит хүчинтэй хугацаа ≈ **24 цаг**.

### 5.3 `sender_invoice_no` давхардлыг QPay шалгадаггүй
Туршиж баталсан: нэг дугаараар 2 удаа дуудахад **2 өөр invoice үүслээ**.
Тиймээс нэг захиалгад олон нэхэмжлэх үүсэх, тус бүр нь төлөгдөх эрсдэлтэй.
**Idempotency-г та өөрөө хариуцна:** захиалгад `qpay_invoice_id` аль хэдийн
байвал шинийг үүсгэхгүй, хуучныг буцаана.

### 5.4 Callback-д хэзээ ч шууд итгэхгүй
QPay-ийн callback нь гарын үсэггүй, нээлттэй HTTP дуудлага. Хэн ч түүнийг
хуурч дуудаж болно. Дараах дарааллыг заавал баримтална:

1. Callback хүлээж авна
2. `POST /payment/check`-ээр `invoice_id`-г шалгана
3. `paid_amount`-ыг **серверийн өөрийн тооцоолсон** захиалгын дүнтэй тулгана
4. Дүн тохирсон тохиолдолд л захиалгыг `paid` болгоно

### 5.5 Дүнг client-ээс хэзээ ч авахгүй
Нэхэмжлэхийн дүнг сагснаас биш, **сервер тал өгөгдлийн сангаас дахин
тооцоолсон** утгаар үүсгэнэ. `vonscent`-д энэ логик аль хэдийн бий:
`src/features/checkout/api.ts` доторх `computeSummary`.

### 5.6 `callback_url` нь public HTTPS байх ёстой
`localhost` эсвэл `http://` хаяг ажиллахгүй. Локал дээр бодит callback барих
бол `ngrok` эсвэл `cloudflared` tunnel хэрэглэнэ.

### 5.7 Production credential
Эдгээр нь sandbox биш, **бодит** мерчант эрх. Туршихдаа бага дүн (10₮)
хэрэглэ, эсвэл огт бүү төл. Үүссэн тест нэхэмжлэхээ `npm run invoice:cancel`-
ээр цэвэрлэ.

### 5.8 Дүнгийн төрөл холимог
`GET /invoice/{id}`-д `total_amount` нь string (`"10.00"`), харин
`gross_amount` нь number (`10`) ирдэг. Харьцуулахын өмнө заавал `Number()`.

### 5.9 `paid_amount` байхгүй байж болно
`count: 0` үед `payment/check` нь `paid_amount`-ыг **огт буцаадаггүй**.
`result.paid_amount ?? 0` гэж бичнэ.

### 5.10 `qr_image`-д `data:` угтвар байхгүй
Цэвэр base64 PNG ирдэг. Вэбэд харуулах бол өөрөө нэмнэ:
`data:image/png;base64,${qr_image}`.

---

## 6. Дараагийн алхам — `vonscent` рүү суулгах

`vonscent` төсөлд QPay-ийн **хагас хийгдсэн** код аль хэдийн байна. Энэ
harness-ээр батлагдсаны дараа дараах газруудыг засах шаардлагатай:

| Файл | Юу засах |
|---|---|
| `src/lib/payments/qpay.ts` | Token кэш нэмэх (одоо дуудлага бүрт шинээр авдаг); `checkPayment` / `getInvoice` нэмэх; алдааг `null` болгож нуухаа болих |
| `src/app/api/payments/qpay/webhook/route.ts` | Callback хүлээж авмагц `payment/check` дуудаж дүн+статусыг тулгах, дараа нь л `mark_order_paid` дуудах (одоо шууд итгэдэг) |
| `src/app/api/orders/route.ts` | Захиалгад `qpay_invoice_id` байвал шинэ invoice үүсгэхгүй байх (idempotency) |
| `src/lib/env.ts` | QPay env-үүдийг `process.env`-с шууд биш, төвлөрсөн typed env рүү оруулах |
| `src/middleware.ts` | Webhook замыг Supabase session middleware-ээс чөлөөлөх эсэхийг шалгах |
| `supabase/migrations/` | `payments` хүснэгт нэмэх эсэхийг шийдэх (одоо зөвхөн `orders.qpay_invoice_id` байна) |
| `src/app/(shop)/order/success/page.tsx` | 23 банкны deeplink-ийг жагсаах (одоо зөвхөн QR харуулдаг) |
| `next.config.ts` | Банкны логоны хост нэмэх: `qpay.mn`, `s3.qpay.mn` |

`src/client.ts` доторх `getToken`, `expiresAtFromTokenResponse`, `QpayError`,
`request` дөрөв нь `vonscent` рүү шууд зөөхөд бэлэн загвар юм.

---

## 7. Бүтэц

```
qpay/
├── README.md                    ← энэ файл
├── FINDINGS.md                  ← бодит API-аас ажиглагдсан зүйлс
├── requirement.md               ← QPay-ээс ирсэн мэдээлэл (git-д ордоггүй)
├── .env / .env.example
├── out/                         ← үүссэн QR зураг, сүүлийн invoice (git-д ордоггүй)
└── src/
    ├── config.ts                ← env унших + шалгах
    ├── types.ts                 ← QPay V2-ийн wire төрлүүд
    ├── client.ts                ← token кэш, алдааны боловсруулалт, бүх endpoint
    └── scripts/
        ├── _shared.ts
        ├── 01-token.ts
        ├── 02-invoice.ts
        ├── 03-check.ts
        ├── 04-invoice-get.ts
        └── 05-invoice-cancel.ts
```
