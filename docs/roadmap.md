# Roadmap — vonscent.mn

Хөгжүүлэлтийг 8 фазад хувааж, фаз бүр дээр тодорхой task list гаргав.
Фазууд нь дарааллаар хамааралтай — өмнөх фазын суурь дээр дараагийнх босно.
Task бүр checkbox-той тул биелэх тусам тэмдэглэнэ.

Тэмдэглэгээ: 🔴 critical (бизнесийн цөм) · 🟡 чухал · 🟢 нэмэлт/дараа болж болно

---

## 🛠 Гүйцэтгэлийн төлөв (2026-06-25)

Кодын суурь бүтээгдэж, **typecheck / lint / `pnpm build` / pricing unit test (13/13)** бүгд цэвэр.
Supabase / QPay / Mobicom-ийн бодит түлхүүр (батлах/нэвтрэх шаардлагатай) ороогүй тул
тэдгээрээс хамаарах хэсгүүд **demo (seed дата) горимоор** ажиллана — холбогдсон даруйд бодит болно.

- ✅ **Phase 0** — Next.js+TS(strict), Tailwind4 токен(navy), shadcn-маягийн UI, бүтэц, Supabase client + Storage, env, layout/header/footer, dark mode.
- ✅ **Phase 1** — DB migration-ууд (`supabase/migrations/0001–0010`), **pricing цөм `lib/pricing/calc.ts` + unit test 🔴**, inventory reserve/commit/release RPC, place_order, RLS, pg_cron, seed script.
- ✅ **Phase 2** — Нүүр, каталог (шүүлт/эрэмбэ/pagination), барааны дэлгэрэнгүй (**ml→үнэ авто шинэчлэл 🔴**), related.
- ✅ **Phase 3** — Сагс (zustand+persist), checkout (zod+RHF), захиалга үүсгэх API (place_order RPC / demo), QPay invoice+webhook stub, амжилттай хуудас.
- ◻️ **Phase 4** — Auth UI (login/register/OAuth), middleware admin gate, профайл/захиалга/wishlist бэлэн. *Утасны OTP (Mobicom), нууц үг сэргээх дараа.*
- ✅ **Phase 5** — Admin shell, dashboard, бараа удирдах + **амьд үнэ тооцоолуур 🔴**, inventory+restock, захиалга, тохиргоо (коэффициент).
- ◻️ **Phase 6** — Купон/loyalty/CMS/тайлан схем бэлэн (UI дараа).
- ◻️ **Phase 7** — Бидний тухай, холбоо барих, FAQ, блог, Analytics(GA4/Meta), sitemap/robots бэлэн. *Домэйн холболт, бодит analytics id дараа.*

> Бодит ашиглалтад: `.env.local` дүүргэх → `supabase db push` → `pnpm db:types` → `pnpm db:seed` → `pnpm dev`.

---

## Phase 0 — Суурь тавих (Foundation)
Зорилго: ажиллах орчин, deploy, DB холболт бэлэн болгох.

- [ ] Next.js (App Router) + TypeScript (strict) project үүсгэх
- [ ] Tailwind CSS + shadcn/ui тохируулах
- [ ] ESLint + Prettier + commit hook (lint/format)
- [ ] Folder бүтэц гаргах (`src/app/(shop|account|admin)`, `features`, `lib`, `db`)
- [ ] Supabase project үүсгэх (DB + Auth), Supabase key-үүдийг холбох
- [ ] Supabase CLI тохируулах (local dev, migration workflow)
- [ ] Supabase client helper (server / browser) бэлдэх
- [ ] `supabase gen types` script тохируулах (TS type generation)
- [ ] `pg_cron` extension идэвхжүүлэх (scheduled job-д)
- [ ] Supabase Storage public bucket + зураг upload helper (`lib/storage`)
- [ ] `next.config` — Supabase Storage host-ыг `images.remotePatterns`-д нэмэх
- [ ] `.env.example` бэлдэх
- [ ] Vercel-д deploy, preview ажиллаж байгааг батлах
- [ ] Үндсэн layout, header, footer, design token (өнгө, фонт)

---

## Phase 1 — Дата модель ба үнэ тооцох цөм 🔴
Зорилго: барааны өгөгдөл, ml шатлалын үнэ, inventory-ийн суурь.

- [ ] DB schema: `products` (нэр, брэнд, нот×3, хүйс, төрөл, гарал, он, тайлбар, идэвх)
- [ ] DB schema: `product_images` (олон зураг, эрэмбэ)
- [ ] DB schema: `product_variants` (ml багц, авто үнэ, override үнэ, идэвх)
- [ ] DB schema: `inventory` (эх савны ml үлдэгдэл, доод хязгаар, restock log)
- [ ] DB schema: `tags` / hashtag (шинэ / эрэлттэй / хямдрал)
- [ ] DB schema: `settings` (шатлалын коэффициент, тоймлолт г.м.)
- [ ] **Pricing цөм** `lib/pricing/calc.ts` — бүтэн савны үнэ+ml → 5/10/20ml авто үнэ 🔴
- [ ] Pricing-д **unit test** (шатлал, тоймлолт, override) 🔴
- [ ] Inventory service: **reserve / commit / release** (on_hand, reserved, available), доод хязгаар (transaction + row lock / RPC)
- [ ] Seed script — туршилтын бараа

---

## Phase 2 — Public дэлгүүр (харах талбар)
Зорилго: зочин бараа үзэх, хайх, шүүх боломж. (Req §1, §2, §3)

**Нүүр хуудас**
- [ ] Hero баннер (онцлох урамшуулал / бараа)
- [ ] Шинээр буусан (new arrivals)
- [ ] Эрэлттэй / best sellers
- [ ] Брэндээр / үнэрийн төрлөөр / хүйсээр хэсэг
- [ ] Sample / discovery set, хямдрал хэсэг
- [ ] Итгэл төрүүлэх блок, brand intro
- [ ] Сурталчилгааны popup (хаагддаг, давтамж тохируулдаг) 🟢
- [ ] Newsletter бүртгэл, Instagram feed 🟢

**Каталог**
- [ ] Grid / list харагдац
- [ ] Шүүлтүүр: брэнд, хүйс, үнэрийн төрөл, үнийн муж, ml, hashtag
- [ ] Эрэмбэлэх: үнэ ↑↓, шинэ, эрэлттэй, нэр
- [ ] Хайлт + үр дүн
- [ ] Pagination / infinite scroll
- [ ] Барааны card (зураг, нэр, брэнд, эхлэх үнэ, wishlist товч)
- [ ] Хоосон үр дүнгийн харагдац + санал

**Барааны дэлгэрэнгүй**
- [ ] Зургийн галерей (zoom / олон өнцөг)
- [ ] **ml сонголт (5/10/20) → үнэ авто шинэчлэгдэнэ** 🔴
- [ ] Нот (top/heart/base), тайлбар, төрөл, хүйс
- [ ] Үлдэгдэл / боломжтой эсэх (ml-ээр)
- [ ] Тоо ширхэг, sample авах сонголт
- [ ] Related / төстэй бараа

---

## Phase 3 — Сагс, Checkout, Захиалга 🔴
Зорилго: бараа худалдаж авах бүрэн урсгал. (Req §4, §5, §6)

**Сагс**
- [ ] Сагс (zustand + local persist, нэвтэрсэн бол server sync)
- [ ] Барааны жагсаалт (зураг, нэр, ml, тоо)
- [ ] ml / тоо засах, устгах
- [ ] Дэд дүн, хүргэлт, нийт дүн
- [ ] Купон / промо код оруулах
- [ ] Хоосон сагсны харагдац

**Checkout**
- [ ] Холбоо барих + хүргэлтийн хаяг (зочин / нэвтэрсэн)
- [ ] Хүргэлтийн арга / бүс сонгох
- [ ] Order summary, нэмэлт тэмдэглэл
- [ ] Төлбөрийн арга сонгох (QPay / банк шилжүүлэг)
- [ ] **QPay** invoice үүсгэх + webhook баталгаажуулалт 🔴
- [ ] Loyalty оноо ашиглах / хуримтлуулах
- [ ] Захиалга үүсгэх (transaction) + inventory ml **reserve** (available шалгана)
- [ ] Төлбөр амжилттай → **commit**, цуцлах/timeout → **release** (pg_cron)
- [ ] Баталгаажуулах товч

**Захиалга амжилттай**
- [ ] Захиалгын дугаар, тойм
- [ ] Төлбөрийн заавар (шилжүүлгийн үед)
- [ ] "Захиалга харах" холбоос

---

## Phase 4 — Auth ба хэрэглэгчийн талбар
Зорилго: бүртгэл, нэвтрэлт, профайл, захиалгын түүх. (Req §7–10)

- [ ] Supabase Auth тохируулах (session, server/client helper)
- [ ] Имэйл + нууц үгээр нэвтрэх, бүртгүүлэх
- [ ] Имэйл OTP (Supabase) 🟡
- [ ] **Утасны OTP — Mobicom SMS, өөрийн урсгал** (route handler, код hash, rate-limit) 🟡
- [ ] Сошиал нэвтрэлт (Google / Facebook — Supabase provider) 🟡
- [ ] Нууц үг сэргээх / солих
- [ ] Профайл (avatar, нэр, имэйл, утас)
- [ ] Олон хүргэлтийн хаяг хадгалах
- [ ] Купон / loyalty оноо харах
- [ ] Миний захиалга (түүх, төлөв, дэлгэрэнгүй, reorder, цуцлах хүсэлт)
- [ ] Wishlist (нэмэх/устгах, сагсанд нэмэх, хоосон харагдац)

---

## Phase 5 — Админ панел: үндсэн удирдлага 🔴
Зорилго: бараа, үлдэгдэл, захиалга удирдах. (Req A1–A5)

- [ ] Role + middleware (admin gate), эрх шалгалт route handler бүрт
- [ ] Dashboard: борлуулалт (өдөр/7хон/сар), захиалгын тоо төлөвөөр
- [ ] Dashboard: үлдэгдэл багассан сэрэмжлүүлэг, top sellers, recent activity
- [ ] **Бараа удирдах**: жагсаалт, нэмэх/засах/устгах 🔴
- [ ] Бүтэн савны үнэ+ml оруулахад 5/10/20ml **авто бодогдоно** 🔴
- [ ] Авто үнийг гар аргаар **override** хийх
- [ ] ml багц идэвхжүүлэх/идэвхгүй болгох, таг, идэвх
- [ ] **Inventory**: эх савны ml хяналт (on_hand/reserved/available), restock, доод хязгаар, авто "Дууссан" (pg_cron) 🔴
- [ ] **Захиалга удирдах**: жагсаалт, дэлгэрэнгүй, төлөв шинэчлэх, төлбөрийн төлөв
- [ ] Нэхэмжлэх / баримт хэвлэх, цуцлах / буцаалт
- [ ] **Хэрэглэгч удирдах**: жагсаалт, дэлгэрэнгүй, loyalty, эрх, хориглох

---

## Phase 6 — Промо, Loyalty, CMS, Тайлан, Тохиргоо
Зорилго: маркетинг, контент, тайлан, тохиргоо. (Req A6–A10)

- [ ] Купон үүсгэх (хувь/тогтсон, хугацаа, хязгаар), идэвхтэй/дууссан жагсаалт
- [ ] Барааны / нийт захиалгын хямдрал
- [ ] Loyalty дүрэм (хуримтлал, хөрвүүлэх ханш), хэрэглэгчийн оноо удирдах
- [ ] CMS: Hero баннер, popup, FAQ, статик хуудас засах
- [ ] Тайлан: борлуулалт (хугацаагаар), эрэлттэй бараа/брэнд, үлдэгдэл (ml)
- [ ] Тайлан Excel / PDF татах 🟢
- [ ] Тохиргоо: дэлгүүрийн мэдээлэл, хүргэлтийн бүс/төлбөр, QPay, **шатлалын коэффициент**
- [ ] Тохиргоо: админ нэмэх, эрхийн түвшин (super_admin / operator / courier)

---

## Phase 7 — Контент, Analytics, Launch
Зорилго: статик хуудас, блог, SEO, хэмжилт, ашиглалтад гаргах. (Req §11–14)

- [ ] Бидний тухай (түүх, баг, үнэт зүйл)
- [ ] Холбоо барих (форм, утас/имэйл/хаяг, сошиал)
- [ ] FAQ (ангиллаар, accordion, хайлт 🟢)
- [ ] Блог: жагсаалт, дэлгэрэнгүй, ангилал/таг, холбоотой нийтлэл
- [ ] CMS-ээс блог нийтлэл удирдах
- [ ] **Analytics**: GA4 + Meta Pixel суулгах, e-commerce event 🟡
- [ ] SEO: metadata, sitemap, OG зураг, robots
- [ ] Домэйн `vonscent.mn` холбох
- [ ] Performance (image, caching), responsive QA, accessibility шалгалт
- [ ] Production checklist: env, error handling, нөөцлөлт, launch

---

## Зөвлөмж — гүйцэтгэлийн дараалал

1. **Phase 0–1** хамгийн эхэнд (суурь + pricing цөм бол бүх зүйлийн үндэс).
2. **Phase 4-ийн Auth суурь** (Supabase Auth + role + admin gate) эрт хэрэгтэй —
   Phase 5 (админ) нь нэвтрэлт, эрхийн шалгалтаас хамаардаг. Тиймээс Auth-ийн
   **үндсэн нэвтрэлт + role**-ийг Phase 4-өөс урагшлуулж, Phase 5-аас өмнө хийнэ
   (профайл, wishlist, loyalty зэрэг хэрэглэгчийн дэлгэрэнгүйг дараа үлдээж болно).
3. **Phase 2–3** нь үзэх → захиалах гол урсгал.
4. **Phase 5** (admin) нь бараа оруулах боломжийг өгдөг тул Phase 3-тай зэрэг хийж болно
   (гэхдээ admin gate-д Auth суурь хэрэгтэй — дээрх №2).
5. **Phase 6, 7** ба хэрэглэгчийн дэлгэрэнгүй талбарууд дараа давтан сайжруулна.

**MVP launch = Phase 0 + 1 + 2 + 3 + (Auth суурь) + 5.**
Худалдан авагч: үзэх → захиалах. Админ: бараа/inventory/захиалга удирдах.
