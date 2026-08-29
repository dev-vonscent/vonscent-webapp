# Дизайн аудит — 2026-08-28

Хамрах хүрээ: `(shop)`, `(auth)`, `(account)`, `(admin)`, `src/features`, `src/components`.
Стандарт: WCAG 2.1 AA. Theme: `.black` / `.white` / `.pink`.
Арга: globals.css token-ийн контраст тооцоо (84 хос × 3 theme) + Chrome дээрх бодит DOM хэмжилт (1280px) + кодын статик шинжилгээ.

**Хураангуй:** Critical 6 · Major 14 · Minor 12 · контраст унасан хос 29 · кодод `focus-visible:ring` 0, `role="alert"`/`aria-live` 0.

> **Төлөв (2026-08-28 засварын дараа):** Critical 6/6, Major 12/14, Minor 12/12 хаагдсан.
> Дэлгэрэнгүйг доорх «7. Засварын төлөв» хэсгээс. Үлдсэн 2: хоёрдогч товчны
> гадаргууны контраст (текст шошготой тул тодорхойлолт алдагдаагүй) ба
> §5-ын нэгдсэн `EmptyState`/`PageHeader`/`CountBadge` рефактор (L хэмжээ).
> Gradient-ийг **зориудаар** хэвээр үлдээв — клиентийн шийдвэр.

## Хамгийн түрүүнд засах 5

1. **Focus indicator сэргээх** — `globals.css:403-408` бүх outline-ыг `!important`-оор устгасан, орлуулах ring кодод байхгүй.
2. **Pink theme-ийн контраст** — primary CTA 3.67:1, линк 3.44:1, карт дээрх muted 4.25:1.
3. **Админ формын label ↔ input холбоо** — `htmlFor`/`id` алга.
4. **Touch target 44px** — сагсны +/−, устгах (16px), quick-add/wishlist (32px).
5. **Алдааг зарлах** — `role="alert"` + `aria-describedby`.

## 1. Контраст (token, theme бүрээр)

| Элемент | black | white | pink | Шаардлага |
|---|---|---|---|---|
| Үндсэн текст | 21.0 | 19.8 | 13.8 | 4.5 |
| Muted текст (хуудас) | 8.13 | 5.33 | 4.60 | 4.5 |
| Muted текст (карт) | 7.47 | 5.11 | **4.25** | 4.5 |
| Primary CTA текст | 15.1 | 17.9 | **3.67** | 4.5 |
| Линк / gold-strong | 21.0 | 17.9 | **3.44** | 4.5 |
| Gold accent | 14.2 | 5.33 | **3.15** | 4.5 |
| gold-soft | 8.13 | **3.45** | **2.58** | 4.5 |
| success / warning | 14.2 | 7.56 | **2.58** | 4.5 |
| focus ring (--ring) | 3.04 | **2.52** | **2.09** | 3.0 |
| chart-3 / chart-4 | **4.43 / 2.69** | **3.45 / 2.05** | **4.60 / 2.09** | 4.5 |

Санал: pink `--primary` ≈ `#c2245c`, `--muted-foreground` ≈ `#8a4a60`, `--gold` ≈ `#a8425f`, `--gold-soft`/`--success`/`--warning`-ыг дахин тохируулах; `--ring` black `#8a8a8a`, white `#6b6b6b`, pink `#b03a63`.

## 2. Critical олдворууд

- **2.4.7 Focus** — `src/app/globals.css:403-408`. `*:focus, *:focus-visible, *:focus-within { outline:none !important }`. Компонентууд зөвхөн `focus-visible:outline-none` давтдаг (`button.tsx:7`, `input.tsx:14`, `checkbox.tsx:15`, `slider.tsx:29`).
- **1.4.11 Border** — `globals.css:398-401` бүх border тунгалаг. Гадаргуугийн ялгаа: card↔bg black 1.09:1 / white 1.04:1 / pink 1.08:1; secondary товч 1.23 / 1.14 / 1.21. Form control-ууд танигдахгүй.
- **2.5.5 Touch target** — `cart-sheet.tsx:128-134,157-173,220-246` (16–24px), `quick-add.tsx:89`, `wishlist-button.tsx:29` (`size-8`), `product-gallery.tsx:97-111` (dots). Нүүр хуудсанд 26, каталогт 15 ийм элемент (1280px хэмжилт).
- **3.3.2 Label** — `coupon-manager.tsx:140-198`, `customer-control.tsx:62,89`, `order-status-control.tsx:52`, `products-toolbar.tsx:44-79`, `data-table.tsx:77`, `variant-price-table.tsx:57-85`.
- **3.3.1 Алдаа** — `ui/form-field.tsx:7-10`, `contact-form.tsx:63-96`, `customer-control.tsx:115`, `checkout/address-fields.tsx:154`.
- **1.4.3 Зураг дээрх текст** — product-card badge (`#d4d4d4` / `#f87171`, 10% дүүргэлт), улирлын картын гарчиг, hero overlay.

## 3. Major

- `product-carousel.tsx:81-89` — сум зөвхөн hover дээр (`group-focus-within` алга); `brand-marquee.tsx:69` мөн адил.
- `product-purchase.tsx:113-141`, `quick-add.tsx:145-161` — хэмжээ сонголтод `aria-pressed` алга (`builder.tsx:258,480` зөв хийсэн).
- `ui/table.tsx:60-64` — `scope="col"` алга; `admin/data-table.tsx:85-127` — `caption`/`aria-label`, `aria-sort` алга.
- `report-charts.tsx` — 3 график текст хувилбаргүй; бага үлдэгдэл зөвхөн өнгөөр.
- `product-image-cell.tsx:101-108,337-347` — `title`-аар л нэрлэгдсэн товчнууд.
- Theme-д сохор CTA: `hero-carousel.tsx:67`, `wishlist/page.tsx:161,171` (бусад 8 газарт `in-[.black]:` хамгаалалттай).

## 4. Minor (бодит DOM-оос)

- `/collections/build` — H1 алга. `/login`, `/register` — `<main>`, landmark алга.
- Нүүр: H2 → H4 үсрэлт. Footer-ийн имэйл талбар label-гүй.
- `/catalog`, `/products/*`, `/cart` — `<footer>` landmark алга.
- Breadcrumb `<nav>`-д `aria-label` алга, `<ol>` биш.
- Header/bottom-nav-д `aria-current="page"` алга.

## 5. Дизайн систем

| Ангилал | Тоо | Гол эх үүсвэр |
|---|---|---|
| Hardcode hex (globals.css-ээс гадна) | 16 | `lib/og.tsx` 7, `global-error.tsx` 5 |
| `white`/`black` түүхий утилит | 61 | `phone-auth-form.tsx` 9, `(shop)/page.tsx` 12 |
| Arbitrary `[...]` | 81 | `(shop)/page.tsx` 12, `(auth)/layout.tsx` 9 |
| `text-[8..15px]` | 32 | зэрэгцээ микро-масштаб |
| Gradient (дүрмээр хориотой) | 17 | `(shop)/page.tsx` 6, `scent-quiz.tsx` 4 |
| tailwind gray/zinc/neutral | 0 | цэвэр |
| `dark:` variant | 0 | цэвэр |

Бусад: `rounded-2xl` (29 хэрэглээ) token-гүй; тоолуурын badge 8 файлд гараар; empty state 18 хувилбар; page header 26 админ файлд хуулбарлагдсан; `py-10…py-28` хэмнэл тогтворгүй; `formatPrice`-ыг 3 газар тойрсон.

## 6. Хийх дараалал

1. `:focus-visible` ring + `--ring` token (S)
2. Pink token гүнзгийрүүлэх (S)
3. Form control-д 3:1 хүрээ/гадаргуу (M)
4. Админ label ↔ input (M)
5. `FieldError` → `role="alert"` + `aria-describedby` (S)
6. 44px touch target (M)
7. `aria-pressed` / `aria-current` / `scope` / `aria-sort` (M)
8. Зураг дээрх шошгонд scrim (S)
9. `EmptyState` / `PageHeader` / `CountBadge` (L)
10. Gradient дүрэм + `--radius-2xl` (S)


---

## 7. Засварын төлөв (2026-08-28)

### Хаагдсан

| # | Асуудал | Шийдэл |
|---|---|---|
| 1 | 2.4.7 Focus indicator | Глобал `outline:none !important` устгав. `:focus-visible` → 2px `--ring` outline + 2px завсар. `--ring` нь theme бүрийн өргөлтийн өнгө (хар `#d4d4d4`, цагаан `#171717`, ягаан `#b81f56`) — саарал browser default биш. Компонентоос 20 ширхэг `outline-none` устгав. |
| 2 | 1.4.3 Pink theme контраст | `--primary` `#e84a7f`→`#c2245c` (цагаан текст 5.67:1), `muted-foreground`→`#8a4a60`, `gold-strong`→`#b81f56`, `gold`→`#a8425f`, `gold-soft`→`#8f4a63`, `destructive`→`#b3213f`, `success`/`warning`→`#7d4457`. Бүх текст token 3 theme × (bg, card) дээр ≥4.5:1. |
| 3 | 1.4.11 Form control хүрээ | Шинэ `--field-edge` token + `field-edge` utility (`inset 0 0 0 1px`). Талбарын гадаргуу ба хуудасны дэвсгэр хоёулантай нь ≥3:1. Input, Select trigger, Checkbox, Radio, digit cell, textarea. |
| 4 | 3.3.2 Админ label ↔ input | Шинэ `<Field>` компонент (`ui/field.tsx`) `useId`-аар `htmlFor`/`id`/`aria-describedby`-г автоматаар холбоно; `Input`, `SelectTrigger` контекстээс уншина. Label байхгүй toolbar-уудад `aria-label`. |
| 5 | 3.3.1 Алдаа зарлах | `FieldError` → `role="alert"` + `id`; `fieldErrorProps()` → `aria-invalid` + `aria-describedby`. contact-form, address-fields, customer-control. |
| 6 | 2.5.5 Touch target | Сагсны +/− ба устгах → 44px. Wishlist/quick-add (32px харагдац) → 44px `::before` талбай. Галерейн цэгүүд → 44px. Хэмжээний сонголт → `min-h-11`. Checkbox/radio (16px) → 44px `::before`. |
| 7 | ARIA төлөв | `aria-pressed` (хэмжээний сонголт), `aria-current="page"` (header, bottom-nav, breadcrumb), `scope="col"`/`scope="row"`, `aria-sort`, `aria-label` (DataTable). |
| 8 | Зураг дээрх текст | Барааны таг badge → `!bg-background/85 backdrop-blur-sm`. Хүйс/улирлын картын scrim → `from-black/85`, шошго нь тодорхой `text-white`. |
| 9 | Theme-д сохор CTA | `hero-carousel`, `wishlist` → `in-[.black]:` хамгаалалт. |
| 10 | Hover-only удирдлага | Carousel сум ба marquee → `group-focus-within`. |
| 11 | График текст хувилбаргүй | `ChartTable` (sr-only `<table>`) 3 график бүрд. Үлдэгдэл багыг өнгөөр биш, тэнхлэгийн шошгонд «· бага» гэж бичив. |
| 12 | Landmark / heading | `(shop)` layout-д `SiteFooter` (бүх хуудсанд footer), `(auth)`-д `<main>`, `/collections/build`-д `<h1>`, footer-ийн `<h4>` → `<h2>`. |
| 13 | Breadcrumb | `<nav aria-label="Замын мөр">` + `<ol>` + `aria-current="page"`. |
| 14 | Newsletter имэйл талбар | `aria-label`. |
| 15 | `rounded-2xl` token-гүй | `--radius-2xl` нэмэв. |
| 16 | Chart цуврал контраст | 3 theme бүрд 5 өнгийг ≥4.5:1 болгож дахин тохируулав. |

### Үлдсэн (зориуд)

- **Gradient 17 ширхэг** — клиентийн шийдвэрээр хэвээр. `docs/spec/design.md`-ийн «gradient хориотой» дүрэм кодтой зөрчилдөж байгааг тэмдэглэв.
- **Хоёрдогч товчны гадаргууны контраст (1.23:1)** — товч бүр текст шошготой тул 1.4.11-ийн «тодорхойлоход шаардлагатай визуал мэдээлэл» алдагдаагүй. Хүрээ нэмэх нь хүрээгүй системийн үндсэн дүрмийг эвдэнэ.
- **§5-ын нэгдсэн компонент рефактор** — `EmptyState` (18 хувилбар), `PageHeader` (26 админ файл), `CountBadge` (8 файл), микро-масштаб `text-[8..15px]`, `py-10…py-28` хэмнэл. Эдгээр нь хүртээмжийн алдаа биш, дизайн системийн цэгцлэлт — тусдаа PR.
- **`lib/og.tsx` / `global-error.tsx` hardcode hex** — эхнийх нь theme-гүй статик OG зураг, хоёр дахь нь CSS ачаалагдаагүй үед ажиллах ёстой.
