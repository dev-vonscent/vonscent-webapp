# Library / Package сайжруулалтын нэгдсэн төлөвлөгөө

> 2026-08-22. Кодын сангийн бүрэн судалгаа + `docs/analysis/improvement_idea.md`, `docs/planning/roadmap.md`, `docs/planning/todo.md`, `docs/requirement_final.md`-ийн шаардлагуудыг нэгтгэв. Энэ файл `improvement_idea.md`-г орлоно (superseded).

**Одоогийн стек:** Next.js 16.2 (App Router) · React 19.2 · Tailwind 4 · Supabase · Radix UI (12 primitive) · react-hook-form 7 · zod 3 · zustand 5 · TanStack Query 5 · sharp · vitest 2.

**Стект огт байхгүй зүйлс:** carousel, lightbox, анимэйшн, огнооны сан, chart, table, rich-text editor, email SDK, error monitoring, rate limit, i18n, E2E тест.

---

## Тэргүүлэх ач холбогдлын хүснэгт

| # | Package | Юуг шийдэх | Ач холбогдол |
|---|---------|-----------|:---:|
| 1 | `embla-carousel-react` | 4 гар бичмэл carousel-ийг нэгтгэнэ | 🔴 |
| 2 | `yet-another-react-lightbox` | Шаардлагад заасан зургийн zoom | 🔴 |
| 3 | `@sentry/nextjs` + `error.tsx` | Алдааны хяналт огт байхгүй | 🔴 |
| 4 | `@upstash/ratelimit` | Нээлттэй API route-ууд хамгаалалтгүй | 🔴 |
| 5 | `resend` SDK + `react-email` | Захиалгын баталгаажуулах имэйл байхгүй | 🔴 |
| 6 | `sonner` | Гар бичмэл toast store-г орлоно | 🟡 |
| 7 | `@tanstack/react-table` | Админы 9 гар бичмэл хүснэгт | 🟡 |
| 8 | `recharts` | Админд график огт байхгүй | 🟡 |
| 9 | `@tiptap/react` эсвэл `react-markdown` | Блог `split("\n\n")` рендэр | 🟡 |
| 10 | `next/og` + JSON-LD | OG зураг, structured data байхгүй | 🟡 |
| 11 | `date-fns` + `@date-fns/tz` | Гар аргаар UTC+8 тооцоолол | 🟡 |
| 12 | `dnd-kit` | ~470 мөр pointer-event drag код | 🟢 |
| 13 | `cmdk` | Хайлтад keyboard navigation байхгүй | 🟢 |
| 14 | `motion` (framer-motion) | Layout/exit анимэйшн байхгүй | 🟢 |
| 15 | `playwright` + Testing Library | E2E, component тест байхгүй | 🟡 |
| 16 | `exceljs` (`xlsx`-г солино) | Мэдэгдэж буй эмзэг байдалтай dependency | 🔴 |
| 17 | `next-safe-action` | Client/server validation давхардал | 🟢 |
| 18 | `fuse.js` эсвэл `pg_trgm` | Fuzzy хайлт, кирилл→латин | 🟢 |

🔴 = яаралтай (аюулгүй байдал / шаардлага биелээгүй), 🟡 = өндөр үр өгөөж, 🟢 = чанарын сайжруулалт

---

## 1. UI / Хэрэглэгчийн туршлага

### 1.1 Carousel нэгтгэл — `embla-carousel-react` + `embla-carousel-autoplay`

Одоо **4 тусдаа гар бичмэл carousel** байна (~550 мөр):

- `src/features/marketing/components/hero-carousel.tsx` — өөрийн `setInterval` autoplay, swipe/keyboard байхгүй
- `src/features/products/components/product-gallery.tsx` — mobile scroll-snap + desktop thumbnail, гар аргаар index тооцоолол
- `src/features/products/components/product-carousel.tsx` — гар аргаар `atStart`/`atEnd` илрүүлэлт
- `src/features/marketing/components/promo-popup.tsx` — 4 дэх carousel, өөрийн drag/swipe

Embla нь ~7KB gzip, dependency-гүй, shadcn/ui-ийн carousel-ийн суурь болдог. Дөрвөн component бүгд нэг `useEmblaCarousel` hook дээр суурилж, swipe, loop, keyboard nav-ийг үнэгүй авна. `brand-marquee.tsx`-ийн CSS marquee-г хэвээр үлдээж болно (хөнгөн, ажиллаж байгаа).

### 1.2 Зургийн zoom / lightbox — `yet-another-react-lightbox`

`roadmap.md` Phase 2-т "Зургийн галерей (zoom / олон өнцөг)" гэж заасан ч **огт хэрэгжээгүй**. Энэ сан жижиг, Next/Image-тэй `render.slide` override-оор зохицдог, `Zoom` + `Thumbnails` plugin-тэй. `product-gallery.tsx`-д залгахад шаардлага шууд хаагдана.

### 1.3 Toast — `sonner`

`src/lib/toast.ts` (гар бичмэл zustand store) + `src/components/ui/toast.tsx` + `toaster.tsx` гурвууланг **устгаж** `sonner`-оор солино. Нэмээд авах зүйлс: promise/loading toast, success/warning variant, action товч (undo), toast бүрийн duration. Radix Toast dependency-г хасна.

### 1.4 Command palette — `cmdk`

`src/components/shared/global-search.tsx` (175 мөр) ⌘K сонсогч, debounce, Dialog-оо өөрөө бичсэн ч **үр дүн дээр сум товчоор шилжих боломжгүй**. `cmdk` нь keyboard list navigation, group, filtering-ийг өгнө; Radix Dialog дотроо ажилладаг.

### 1.5 Анимэйшн — `motion` (framer-motion)

Одоо CSS keyframes + `tw-animate-css` л байна. Cart sheet, жагсаалтын exit анимэйшн, галерей эрэмбэлэлт, page transition-д `motion`-ийн `AnimatePresence` + `layout` prop хэрэгтэй. React 19-тэй бүрэн зохицдог. Тэмдэглэл: `prefers-reduced-motion`-ийг carousel autoplay, marquee дээр бас хүндэтгэх хэрэгтэй (одоо огт шалгадаггүй).

### 1.6 Drag & drop — `@dnd-kit/core` + `@dnd-kit/sortable`

`src/features/admin/components/product-images.tsx`-ийн ~470 мөр pointer-event drag кодыг (ghost clone, гар аргаар байрлал тооцоолол) орлоно. Хүртээмж (keyboard sensor, screen reader announcement) дагалдана.

### 1.7 Pagination — өөрсдөө засах (сан хэрэггүй)

`src/features/catalog/components/catalog-pagination.tsx` хуудас бүрд товч рендэрлэдэг — 40 хуудас = 40 товч. Ellipsis-тэй truncation бол ~30 мөр код; сан нэмэх шаардлагагүй. Хүсвэл TanStack Query-ийн `useInfiniteQuery` (аль хэдийн суусан!) + `IntersectionObserver`-оор infinite scroll хийж болно.

---

## 2. Аюулгүй байдал, найдвартай ажиллагаа

### 2.1 Error monitoring — `@sentry/nextjs`

Одоо **ямар ч алдааны хяналт байхгүй**, бүр `error.tsx`, `global-error.tsx`, `not-found.tsx`, `loading.tsx` ч `src/app` дор алга. Олон `catch {}` блок алдааг чимээгүй залгидаг (`src/lib/email.ts`, `global-search.tsx`, `promo-popup.tsx`). Хийх дараалал:

1. `error.tsx` / `global-error.tsx` / `not-found.tsx` нэмэх (сан хэрэггүй, Next.js-ийн үндсэн боломж)
2. `@sentry/nextjs` суулгах — server/client/edge гурвууланд нэг wizard-аар тохирдог, source map upload автомат

### 2.2 Rate limiting — `@upstash/ratelimit` + `@upstash/redis`

Утасны нэвтрэлтээс (`src/lib/auth/phone.ts`, DB-д суурилсан гар бичмэл түгжээ) бусад **бүх нээлттэй route хамгаалалтгүй**: newsletter, contact, coupons/validate, reviews, orders, quiz, upload. Sliding-window limiter-ийг `middleware.ts` эсвэл route бүрд хэдхэн мөрөөр залгана. Vercel дээр Upstash-ийн үнэгүй тариф хангалттай.

### 2.3 `xlsx` → `exceljs`

SheetJS `xlsx@0.18.5`-д засагдаагүй advisory-нууд бий (`improvement_idea.md` §4-т аль хэдийн тэмдэглэсэн). `scripts/import-collections.ts`-д л ашигладаг тул солиход хялбар. Бонус: `exceljs`-ээр админы тайланг жинхэнэ Excel файл болгож татуулж болно (шаардлагын мөр 309-ийн "Excel / PDF тайлан татах"-ыг хаана).

---

## 3. Имэйл, төлбөр, мэдэгдэл

### 3.1 Email — `resend` SDK + `react-email`

`src/lib/email.ts` нь Resend REST API руу шууд `fetch` хийдэг, plain-text, зөвхөн 2 газар (contact form, захиалга цуцлалт) ашиглагддаг. **Захиалгын баталгаажуулалт, хүргэлтийн мэдэгдэл, newsletter илгээлт огт байхгүй.** Хийх зүйлс:

- `resend` SDK + `@react-email/components` — JSX template, `npx react-email dev`-ээр local preview
- Захиалга баталгаажсан үед (`src/lib/payments/confirm-order.ts` дотор) имэйл илгээх
- `newsletter_subscribers` хүснэгт рүү зөвхөн upsert хийгээд орхидгийг Resend Broadcasts эсвэл double opt-in flow-той холбох

### 3.2 Төлбөр — QPay-г бэхжүүлэх

Одоогийн `src/lib/payments/qpay.ts` гар бичмэл client (webhook-ийн `/payment/check` дахин баталгаажуулалт зөв хийгдсэн 👍). Сонголтууд:

- `@mnpay/qpay` (npm) — авах шаардлагагүй ч API surface харьцуулж лавлагаа болгож болно
- Refund API одоо гараар — QPay-ийн refund endpoint-ийг client-д нэмэх
- SocialPay / Pocket-ийг хоёр дахь сонголт болгож нэмэх нь Монголын зах зээлд конверси нэмнэ

### 3.3 Realtime мэдэгдэл — Supabase Realtime (шинэ dependency хэрэггүй)

`features/admin/components/notification-list.tsx` одоо зөвхөн refresh хийдэг. `supabase-js`-ийн `channel().on("postgres_changes", …)` аль хэдийн стект бий — админд шинэ захиалга шууд бууж ирдэг болгоно.

---

## 4. Админ dashboard

### 4.1 Хүснэгт — `@tanstack/react-table` + shadcn `ui/table`

`components/ui/table.tsx` огт байхгүй, 9 газар plain `<table>` бичсэн (products, orders, customers, inventory, reports, invoice…), sorting/filtering-ийг хуудас бүрд `searchParams` + `.sort()`-оор дахин бичсэн. TanStack Table (headless, React Query-тэй нэг гэр бүл) + нэг `ui/table` primitive-ээр нэгтгэвэл column visibility, row selection, bulk action-ийг үнэгүй авна.

### 4.2 График — `recharts`

`admin/reports`-ын "Сар бүрийн борлуулалт" одоо энгийн хүснэгт. `recharts` (shadcn/ui charts-ийн суурь, React 19 дэмждэг) ашиглан: сарын борлуулалтын шугаман график, захиалгын статусын donut, барааны үлдэгдлийн bar chart.

### 4.3 Rich text editor — `@tiptap/react` + рендэрт `react-markdown`

Блогийн editor одоо `<textarea rows={4}>`, рендэр нь `body.split(/\n\n+/)` → `<p>`. Heading, link, жагсаалт, зураг оруулах ямар ч боломжгүй. Хоёр зам:

- **Хөнгөн:** админд markdown бичээд `react-markdown` + `remark-gfm`-ээр рендэрлэх (Tailwind `prose` class аль хэдийн байна)
- **Бүрэн:** `@tiptap/react` WYSIWYG editor — cover зураг upload, heading, зураг embed. Контент их бичих бол энэ

FAQ, static хуудсууд (`about`, `contact` — одоо hard-coded JSX) мөн адил үүнд шилжиж болно.

### 4.4 PDF — `@react-pdf/renderer` (сонголтоор)

Нэхэмжлэх/тайлан одоо browser-ийн Save-as-PDF-д тулгуурладаг. Шаардлагын мөр 268 "Нэхэмжлэх татах"-ыг жинхэнэ PDF файлаар хаах бол `@react-pdf/renderer`. Print хуудас хангалттай гэж үзвэл алгасаж болно.

---

## 5. SEO / Marketing

### 5.1 OG зураг — `next/og` (Next.js-д багтсан, суулгах зүйлгүй)

`opengraph-image.tsx` **хаана ч байхгүй**, блог постод `openGraph` блок огт алга. `ImageResponse`-оор бүтээгдэхүүн, блог, коллекц бүрд динамик OG зураг үүсгэнэ (roadmap Phase 7-ийн шаардлага).

### 5.2 Structured data — JSON-LD (сан хэрэггүй, эсвэл `schema-dts` типийн туслалцаа)

`schema.org` markup тэг байна. Review, FAQ, блог бүгд байгаа тул `Product`+`Offer`+`AggregateRating`, `BreadcrumbList`, `Article`, `FAQPage` нэмэхэд Google-ийн rich result шууд идэвхжинэ.

### 5.3 Sitemap засвар (сан хэрэггүй)

`src/app/sitemap.ts` блогийн URL-ийг **DB биш seed тогтмолоос** авдаг — жинхэнэ постууд индекслэгддэггүй баг. Коллекц, FAQ, ангиллын URL нэмэх, `lastModified`-д бодит огноо тавих.

### 5.4 Analytics — `@next/third-parties`

GA4 + Meta Pixel одоо гар бичмэл inline `next/script`. `@next/third-parties`-ийн `GoogleAnalytics` component нь албан ёсны, performance-optimized. Дараагийн шат: Meta Conversions API (server-side event).

---

## 6. Огноо, цаг — `date-fns` + `@date-fns/tz`

`src/lib/time.ts` (73 мөр) `UB_OFFSET_MINUTES = 8*60`-г hard-code хийж `Date`-ийг гараар шилжүүлдэг; `formatDeadline()` `padStart`-аар мөр угсардаг. `@date-fns/tz`-ийн `TZDate`-ээр жинхэнэ `Asia/Ulaanbaatar` бүсийг ашиглавал DST-ийн түүхэн өөрчлөлт, ирээдүйн бодлогын өөрчлөлтөд тэсвэртэй. Нэмээд `formatDistanceToNow`-оор "2 өдрийн өмнө" гэх relative цаг (сэтгэгдэл, мэдэгдэлд хэрэгтэй).

---

## 7. Form / validation — `next-safe-action`

`zodResolver` + `useForm` **ганцхан** файлд (checkout) байна; бусад бүх form гар аргаар `useState` + `fetch`. Server-ийн zod схемүүд (`src/lib/validators/*`) client-тэй хуваалцагддаггүй тул дүрэм давхардсан/дутуу. `next-safe-action` нь Server Action + zod-ийг нэг схемээр холбож type-safe болгоно. Хамгийн багадаа: `lib/validators`-ийн схемүүдийг `zodResolver`-оор client form бүрд дахин ашиглах.

---

## 8. Хайлт — `pg_trgm` (server) эсвэл `fuse.js` (client)

Одоо Supabase `ilike` л байна. Санал:

- **Server:** Postgres `pg_trgm` + `unaccent` extension (Supabase-д бэлэн) — typo тэсвэртэй fuzzy хайлт. `src/lib/geo/translit.ts`-ийн кирилл→латин хөрвүүлгийг хайлтад ч ашиглах ("chanel" гэж бичихэд "Шанель" олдох)
- **Client:** FAQ шиг жижиг датад `fuse.js` хангалттай

---

## 9. Тест — `playwright` + `@testing-library/react` + `msw`

- ⚠️ **Bug:** `vitest.config.ts`-ийн `include: ["src/**/*.{test,spec}.ts"]` — `.tsx` ороогүй тул component тест хэзээ ч ажиллахгүй. `{ts,tsx}` болгож засах
- `@testing-library/react` + `jsdom` — component тест
- `playwright` — checkout, нэвтрэлт, админы гол урсгалын E2E
- `msw` — Supabase/QPay-ийн mock
- CI workflow (GitHub Actions) огт байхгүй — `typecheck` + `lint` + `test`-ийг push бүрд ажиллуулах

---

## 10. Бусад (бага зэрэглэл)

| Package | Юунд |
|---------|------|
| `@radix-ui/react-alert-dialog` | `confirm-dialog.tsx`-д зөв `alertdialog` role өгөх |
| `@serwist/next` | PWA + push notification (improvement_idea §-д байсан) |
| `react-custom-roulette` | todo.md B6-ийн "Хүрд" (spin wheel) хэрэгжих үед |
| `@next/bundle-analyzer` | Bundle хэмжээний хяналт |
| `eslint-plugin-jsx-a11y` | Хүртээмжийн lint (одоо ~200 файлын 50-д л `aria-*` бий) |
| `next-intl` | Хэрэв англи хувилбар хэрэг болвол — одоохондоо шаардлагагүй, бүх мөр монголоор inline |

---

## Хэрэгжүүлэх дараалал (санал)

**Үе 1 — Аюулгүй байдал, суурь (1 долоо хоног):**
`error.tsx`-үүд → `@sentry/nextjs` → `@upstash/ratelimit` → `exceljs` → vitest config засвар

**Үе 2 — Худалдааны гол урсгал (1–2 долоо хоног):**
`resend`+`react-email` (захиалгын имэйл!) → `embla-carousel-react` → `yet-another-react-lightbox` → `sonner`

**Үе 3 — SEO / Админ (1–2 долоо хоног):**
`next/og` + JSON-LD + sitemap засвар → `recharts` → `@tanstack/react-table` → `@tiptap/react`

**Үе 4 — Чанар (тасралтгүй):**
`date-fns` → `dnd-kit` → `cmdk` → `motion` → `playwright` E2E → `next-safe-action`

---

*Эх сурвалж: кодын сангийн бүрэн судалгаа (2026-08-22), [Embla vs Swiper vs Splide 2026](https://www.pkgpulse.com/guides/embla-carousel-vs-swiper-vs-splide-2026), [Resend + React Email in Next.js 2026](https://stacknotice.com/blog/resend-react-email-nextjs-2026), [QPay npm client](https://www.npmjs.com/package/@mnpay/qpay)*
