# Сайжруулалтын TODO

> Эх төлөвлөгөө: `docs/analysis/library_upgrade_plan.md` (2026-08-22). Дууссан ажлыг `- [x]` болгож тэмдэглэнэ.

## Үе 1 — Аюулгүй байдал, суурь 🔴

- [x] **1.1** `src/app`-д `error.tsx`, `global-error.tsx`, `not-found.tsx`, гол route-уудад `loading.tsx` нэмэх (сан хэрэггүй) ✓ 2026-08-23
- [x] **1.2** `@sentry/nextjs` суулгаж server/client/edge-д тохируулах, чимээгүй `catch {}` блокуудыг Sentry руу report хийдэг болгох ✓ 2026-08-23 — `NEXT_PUBLIC_SENTRY_DSN` env тавигдтал унтраалттай (promo-popup-ын clipboard catch нь зөв fallback тул хэвээр)
- [ ] **1.3** `@upstash/ratelimit` + `@upstash/redis` — newsletter, contact, coupons/validate, reviews, orders, quiz, upload route-уудад sliding-window limiter залгах (Upstash бүртгэл хэрэгтэй — хойшлуулсан)
- [x] **1.4** `xlsx` → `exceljs` солих (`scripts/import-collections.ts`), хуучин package-г устгах ✓ 2026-08-23 — sample файлаар `--dry` шалгасан
- [x] **1.5** `vitest.config.ts` include-г `src/**/*.{test,spec}.{ts,tsx}` болгож засах ✓ 2026-08-23
- [x] **1.6** GitHub Actions CI: push бүрд `typecheck` + `lint` + `test` ✓ 2026-08-23 — `.github/workflows/ci.yml`

## Үе 2 — Худалдааны гол урсгал 🔴🟡

- [ ] **2.1** `resend` SDK + `react-email` — `src/lib/email.ts`-г SDK руу шилжүүлж JSX template нэмэх
- [ ] **2.2** Захиалга баталгаажсан үед имэйл илгээх (`src/lib/payments/confirm-order.ts`) — зөвхөн `contact_email`-тэй захиалгад; имэйлгүй бол чимээгүй алгасна
- [ ] **2.3** Хүргэлтийн/статус өөрчлөгдсөн мэдэгдлийн имэйл — мөн зөвхөн имэйлтэй захиалгад. **Шийдвэр (2026-08-23): SMS огт ашиглахгүй (үнэ өртөгтэй тул); имэйлгүй захиалагчид мэдэгдэл очихгүй нь зөвшөөрөгдсөн**
- [x] **2.4** `embla-carousel-react` + `embla-carousel-autoplay` (+ hero-д `embla-carousel-fade`) суулгах ✓ 2026-08-23
- [x] **2.5** `hero-carousel.tsx`-г Embla руу шилжүүлэх ✓ 2026-08-23 — fade plugin-ээр хуучин cross-fade хадгалагдсан, swipe/loop нэмэгдсэн
- [x] **2.6** `product-gallery.tsx`-г Embla руу шилжүүлэх (mobile + desktop нэг instance) ✓ 2026-08-23
- [x] **2.7** `product-carousel.tsx`-г Embla руу шилжүүлэх ✓ 2026-08-23
- [x] **2.8** `promo-popup.tsx`-ийн carousel-г Embla руу шилжүүлэх ✓ 2026-08-23 — гар бичмэл drag logic устсан
- [x] **2.9** `yet-another-react-lightbox` (+Zoom, Thumbnails) — галерейн зураг дармагц zoom lightbox нээгдэнэ ✓ 2026-08-23
- [x] **2.10** `sonner` — `lib/toast.ts` adapter болж, `ui/toast.tsx` устсан, `@radix-ui/react-toast` хасагдсан ✓ 2026-08-23

## Үе 3 — SEO / Админ 🟡

- [ ] **3.1** `sitemap.ts` засвар: блогийн URL-ийг DB-ээс авах, коллекц/FAQ/ангиллын URL нэмэх, бодит `lastModified`
- [ ] **3.2** `next/og` — бүтээгдэхүүн, блог, коллекцод динамик `opengraph-image.tsx`
- [ ] **3.3** JSON-LD: `Product`+`Offer`+`AggregateRating`, `BreadcrumbList`, `Article`, `FAQPage`
- [ ] **3.4** Блог постод `openGraph` metadata блок нэмэх
- [ ] **3.5** `@next/third-parties`-ийн `GoogleAnalytics`-руу шилжих
- [ ] **3.6** `recharts` — админ reports-д сарын борлуулалтын шугаман график, статусын donut, үлдэгдлийн bar chart
- [ ] **3.7** shadcn `ui/table` primitive үүсгэх
- [ ] **3.8** `@tanstack/react-table` — админы хүснэгтүүдийг (products, orders, customers, inventory, reports) нэгтгэх
- [ ] **3.9** Блог editor: `@tiptap/react` WYSIWYG эсвэл markdown + `react-markdown`+`remark-gfm` рендэр (аль нэгийг сонгох)
- [ ] **3.10** FAQ, static хуудсуудыг (about, contact) мөн editor-т шилжүүлэх

## Үе 4 — Чанар 🟢

- [ ] **4.1** `date-fns` + `@date-fns/tz` — `src/lib/time.ts`-ийн hard-coded UTC+8-г `Asia/Ulaanbaatar` бүсээр солих
- [ ] **4.2** `formatDistanceToNow`-оор relative цаг ("2 өдрийн өмнө") — сэтгэгдэл, мэдэгдэлд
- [ ] **4.3** `dnd-kit` — `product-images.tsx`-ийн ~470 мөр гар бичмэл drag кодыг солих
- [ ] **4.4** `cmdk` — `global-search.tsx`-д keyboard navigation
- [ ] **4.5** `motion` — cart sheet, жагсаалтын exit анимэйшн, page transition
- [ ] **4.6** `prefers-reduced-motion` — carousel autoplay, marquee дээр хүндэтгэх
- [ ] **4.7** `@testing-library/react` + `jsdom` component тест
- [ ] **4.8** `playwright` E2E: checkout, нэвтрэлт, админы гол урсгал
- [ ] **4.9** `msw` — Supabase/QPay mock
- [ ] **4.10** `next-safe-action` эсвэл `lib/validators` схемүүдийг `zodResolver`-оор бүх client form-д дахин ашиглах
- [ ] **4.11** Хайлт: `pg_trgm` + `unaccent` (Supabase extension) + кирилл→латин хөрвүүлэг; FAQ-д `fuse.js`
- [ ] **4.12** Catalog pagination-д ellipsis truncation (одоо 40 хуудас = 40 товч)

## UI/UX (бүтээгдэхүүний хуудасны аудит, 2026-08-23)

- [x] Desktop зургийн харьцаа 4:5 → квадрат — CTA эхний дэлгэцэд багтдаг болсон ✓
- [x] Зураастай «хуучин үнэ» + -X% тэмдэг — `products.sale_pct` багана (0038, display-only: төлөх үнэд нөлөөгүй), админ формд «Хямдралын %» талбар ✓
- [x] CTA доор «Нөөцөд бэлэн · УБ-т 24 цагт хүргэнэ» мөр ✓
- [ ] Нэрний доор ★ үнэлгээ + сэтгэгдлийн тоо (өгөгдөл `ratingAvg`/`ratingCount` бэлэн)
- [ ] Хүслийн товчийг CTA-ийн хажууд ойртуулах
- [ ] «Дэлгэрэнгүй тайлбар» богино тайлбартай давхардахгүй байх (контент)

## Нэмэлт / хүлээлгэнд

- [ ] `@radix-ui/react-alert-dialog` — `confirm-dialog.tsx`-д зөв role
- [ ] `eslint-plugin-jsx-a11y` + хүртээмжийн аудит (skip-link, carousel `aria-live`)
- [x] Telegram bot — шинэ захиалга + төлбөр төлөгдөх бүрд админд мэдэгдэл ✓ 2026-08-23 — `src/lib/notify/telegram.ts`, олон chat_id дэмжинэ (release үед клиентийн id-г таслалаар нэмнэ); Vercel-д `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` тавихаа мартуузай
- [ ] Supabase Realtime — админы `notification-list.tsx`-д шинэ захиалга шууд буух (Telegram-аар түр хаагдсан)
- [ ] `@react-pdf/renderer` — нэхэмжлэх PDF татах (шаардлага мөр 268)
- [ ] `@serwist/next` — PWA + push notification
- [ ] `react-custom-roulette` — "Хүрд" (todo.md B6) хэрэгжих үед
- [ ] `@next/bundle-analyzer` — bundle хэмжээний хяналт
- [ ] SocialPay / Pocket төлбөрийн нэмэлт сонголт
- [ ] Meta Conversions API (server-side event)
