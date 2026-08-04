# Development — vonscent.mn

Үнэртэн (perfume decant) худалдааны вэбсайт. Бүтэн савнаас 5/10/20ml багцаар салгаж зарна.
Энэ баримт нь техникийн стек, архитектур, кодын дүрмийг тодорхойлно.

---

## 1. Tech Stack

| Давхарга | Сонголт | Тайлбар |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | SSR/SSG, route handlers (API) |
| UI | **shadcn/ui + Tailwind CSS** | Component library, design tokens |
| Database | **Supabase (Postgres)** | Доорх §2-т сонгосон шалтгаан |
| DB хандалт | **Supabase client (supabase-js)** | Query, type generation (`supabase gen types`) |
| Migration | **Supabase migrations (SQL) + Supabase CLI** | Schema хувилбарлах |
| Auth | **Supabase Auth** + имэйл/нууц үг + Google/Facebook | Имэйл OTP, social Supabase-аас. Утасны OTP тусдаа (доор) |
| Утасны OTP | **Mobicom SMS service** (өөрийн OTP урсгал) | Supabase phone auth биш — route handler + Mobicom API |
| Storage | **Supabase Storage** | Барааны зураг, blog зураг (public bucket `product-images`) |
| Validation | **Zod + react-hook-form** | Form + API input validation |
| Data fetching | **TanStack Query** | Server state, `useMutation`, cache |
| State (client) | **Zustand** | Сагс (cart), UI state |
| Dark mode | **next-themes** | CSS variable theming |
| Package mgr | **pnpm** | Хурдан, диск хэмнэлттэй |
| Payment | **QPay** | Монголын төлбөрийн систем |
| Email | **Resend** (free tier) | Newsletter, захиалгын баримт (transactional). Auth имэйл нь Supabase-ээс (custom SMTP = Resend болгож болно) |
| Cron / scheduled | **Supabase pg_cron** | Авто "Дууссан" төлөв, доод хязгаар, тайлан |
| Analytics | **Google Analytics 4 + Meta Pixel** | Техникийн шаардлагаас |
| Deploy | **Vercel** (free/hobby) | Next.js native hosting |

> Бүх сонголт free plan дээр ажиллана. Production scale болоход Supabase, Vercel paid руу хялбар шилждэг (Storage нь Supabase дотор).

---

## 2. Database / Backend сонголт

**Шийдвэр: Supabase (Postgres) + Auth + Storage багц, `supabase-js` client-ээр query.**

Supabase нь зөвхөн DB биш — **Postgres + Auth + Storage + Realtime**-ийг нэг дороос өгдөг.
Энэ нь Auth.js-ийг өөрөө угсрах ажлыг хэмнэж, OTP / social login-ийг бэлнээр өгнө.

| Хэрэглээ | Хэрэгсэл |
|---|---|
| Relational DB | Supabase Postgres (transaction, foreign key, index) |
| DB хандалт | Supabase client (`supabase-js`) — query, insert, update |
| Schema / migration | Supabase migrations (SQL) + Supabase CLI |
| Type-safety | `supabase gen types typescript` → DB-ээс TS төрөл үүсгэнэ |
| Нэвтрэлт | Supabase Auth (имэйл + нууц үг, имэйл OTP, Google/Facebook) |
| Утасны OTP | Mobicom SMS — өөрийн OTP урсгал (route handler, доорх §9.1) |
| Барааны зураг | Supabase Storage (public bucket) |

**Plan:** Free-ээр эхэлж, бодит трафик гарахад **Pro (~$25/сар)** руу шилжинэ.
Pro нь 8 GB DB, 100 GB storage, 100K MAU, өдрийн backup, pause-гүй ажиллагаатай —
үнэртний дэлгүүрийн дата хөнгөн тул олон хэрэглэгчтэй болсон ч удаан хүрэлцэнэ
(зардал голчлон **compute** add-on-оос хамаарна, storage-аас биш).

**DB хандалт:** ORM (Drizzle г.м.) ашиглахгүй — Supabase-ийн **`supabase-js` client**-ээр
шууд query хийнэ. Schema-г **Supabase migrations (SQL)**-аар хувилбарлаж, `supabase gen types`-ээр
TypeScript төрөл үүсгэн type-safety хангана.

> Анхаар: эх `requirement.md`-д "Supabase ашиглахгүй" гэж байсныг **Supabase ашиглахаар өөрчилсөн**.

---

## 3. Архитектур ба Folder бүтэц (Next.js App Router)

```
src/
  app/                      # routes (App Router)
    (shop)/                 # Public — нүүр, каталог, бараа, сагс, checkout
    (account)/              # Нэвтэрсэн — профайл, захиалга, wishlist
    (admin)/                # Админ панел (role-gated)
    api/                    # Route handlers (QPay webhook, OTP, серверийн API)
  components/
    ui/                     # shadcn компонентууд (генерат — шууд засахгүй)
    shared/                 # дахин ашиглагдах wrapper компонент
  features/                 # домэйнаар бүлэглэнэ
    products/  catalog/  cart/  checkout/  orders/  auth/  admin/ ...
      components/           # тухайн домэйны компонент
      hooks/                # тухайн домэйны hook (TanStack Query г.м.)
      api.ts                # тухайн домэйны өгөгдлийн дуудлага (supabase / route handler)
  lib/
    api-client.ts           # fetch wrapper (base URL, auth header, алдаа боловсруулалт)
    supabase/               # Supabase client (server / browser)
    pricing/                # ml шатлалын тооцооны цөм (доорх §5)
    storage/                # Supabase Storage helper
    validators/             # Zod schemas
    constants.ts            # magic утга / тогтмолыг төвлөрүүлнэ
  db/
    types.ts                # `supabase gen types` гаралт (DB → TS төрөл)
supabase/                   # ⚠ project root-д (Supabase CLI конвенц)
  migrations/               # SQL migrations
  config.toml               # local dev тохиргоо
```

**Дата урсгалын дүрэм:**
- **UI-д бизнес логик бичихгүй** — өгөгдөл `features/*/api.ts` болон service давхаргаас ирнэ.
- **Server** (Server Component, route handler) → `supabase` client рүү шууд ханддаг.
  `SUPABASE_SERVICE_ROLE_KEY` зөвхөн энд, client-д хэзээ ч гарахгүй.
- **Client** → TanStack Query → `lib/api-client.ts` → `app/api` route handler → supabase.
- DB query client-ээс шууд эмзэг өгөгдөл рүү хандахгүй (route handler-аар дамжина).

**Өгөгдлийн дүрэм:**
- Бүх гадны input-ыг Zod-оор баталгаажуулна (форм, API request/response).
- Мөнгөн дүнг **integer (₮-ийн бүхэл нэгж)**-ээр хадгална — float ашиглахгүй.
- ml үлдэгдэл, ml хэмжээг тодорхой нэгжтэйгээр (integer/decimal) хадгална.

---

## 4. Эрхийн түвшин (Roles)

| Role | Эрх |
|---|---|
| `guest` | Үзэх, сагсанд нэмэх (local), зочноор захиалах |
| `customer` | Захиалга, профайл, wishlist, loyalty оноо |
| `courier` | Захиалгын төлөв шинэчлэх (хүргэлт) |
| `operator` | Бараа, захиалга, контент удирдах |
| `super_admin` | Бүх эрх + тохиргоо, эрх олгох |

Route-level middleware-ээр `(admin)` бүлгийг хамгаална. Route handler бүр дотор эрх дахин шалгана (defense in depth).

---

## 5. ml багцын үнэ (гар үнэ)

Үнийг **админ өөрөө бичнэ**. Хэмжээ бүрд (5/10/20ml) `product_variants.price`
талбарт ₮ дүн шууд хадгалагдана — коэффициент, автомат тооцоо, override гэж
байхгүй (`0027_manual_pricing.sql`).

- Хэмжээ **зөвхөн 5/10/20ml** — `ML_SIZES` (`src/lib/constants.ts`) болон DB-ийн
  `product_variants_ml_check` хоёулаа хаалттай жагсаалт болгож барина.
- Захиалгын RPC-үүд `variant_price(v)` дамжуулж төлбөр тооцох тул нэгж үнэ нэг
  л эх сурвалжтай.
- `products.bottle_price` / `bottle_ml` нь **үнэд нөлөөлөхгүй**. Эдгээр нь
  үлдэгдэл (эх савны ml) болон борлуулалт/ашгийн тайланд ашиглагдана — §6, §7.6.

---

## 6. Inventory логик (эх савны ml)

Үлдэгдлийг гурван хэмжигдэхүүнээр хөтөлнө: **on_hand** (бодит байгаа ml),
**reserved** (захиалгаар түр нөөцөлсөн ml), **available = on_hand − reserved**.

- Бараа бүр **эх савны ml үлдэгдэлтэй** (ж: 100ml → on_hand).
- **Reserve (нөөцлөх):** захиалга **өгөх үед** сонгосон ml-ийг `reserved`-д нэмнэ.
  Зөвхөн `available ≥ хэрэгцээт ml` бол захиалга үүснэ (oversell-аас сэргийлнэ).
- **Commit:** захиалга **биелэх/хүргэгдэх** үед `reserved` ба `on_hand` хоёроос ml хасна.
- **Release (суллах):** захиалга цуцлагдах / төлбөр амжилтгүй болоход `reserved`-ийг буцаана.
- **Хугацаа:** төлбөр хүлээж байгаа захиалгын reserve-д timeout тавьж (ж: 30 мин),
  хугацаа дуусвал автоматаар release (pg_cron-оор) — нөөц гацахаас сэргийлнэ.
- Restock бүртгэл нь `on_hand`-ийг нэмнэ (audit log-той).
- `available` доод хязгаараас доош орвол админд сэрэмжлүүлэг; `available = 0` бол "Дууссан" төлөв автоматаар.
- Бүх хасалт/нөөцлөлт нь **transaction + row lock** дотор (`SELECT ... FOR UPDATE`),
  нарийн логикийг Postgres **RPC (function)** болгож хийнэ (race condition-оос сэргийлнэ).

---

## 7. Code Rules

**7.1 Ерөнхий зарчим**
- **TypeScript strict mode** заавал. `any` хэрэглэхгүй (зайлшгүй бол `unknown` + zod).
- **API-first** — UI-д бизнес логик битгий бич. Өгөгдөл API/service давхаргаас ирнэ.
- **zod нэг эх сурвалж** — форм, API request/response бүгд zod-оор validate.
- Файл/фолдер нэрлэлт: `kebab-case`, React компонент: `PascalCase`, function/variable: `camelCase`.
- Нэг компонент = нэг үүрэг. 200+ мөр болвол хуваа.
- ESLint + Prettier — commit бүр цэвэр байх.

**7.2 Styling (Tailwind + shadcn)**
- **Tailwind utility ашигла.** Custom CSS зөвхөн зайлшгүй үед.
- Өнгө/зай/радиусыг **Tailwind theme token**-оор (hardcode хийхгүй). Брэнд өнгийг `tailwind.config`-д тодорхойл (primary navy `#0E1B3B`, дэлгэрэнгүй `design.md`).
- **Gradient ашиглахгүй** — зөвхөн цул өнгө (design.md).
- shadcn компонентыг шууд засахгүй — `components/ui`-д үлдээж, дээр нь wrapper хий.
- **Responsive заавал** mobile-first (`sm: md: lg:`). Бүх дэлгэцэд шалга.
- **Dark mode-д бэлэн** (CSS variable + `next-themes`).

**7.3 Data fetching**
- **Read (жагсаалт, дэлгэрэнгүй):** Server Component (supabase шууд) эсвэл TanStack Query.
- **Mutation (хүсэлт, бүртгэл):** TanStack Query `useMutation` → `lib/api-client.ts`.
- **Бүх client API дуудлага `lib/api-client.ts`-ээр** (fetch wrapper: base URL, auth header, алдаа боловсруулалт).
- `app/api` route handler нь supabase рүү ханддаг — эмзэг үйлдэл бүгд server талд.
- Image бүр `next/image`-ээр, lazy load (Supabase Storage host-ыг `next.config` `remotePatterns`-д бүртгэ).

**7.4 Database (Supabase)**
- Schema өөрчлөлт бүр **Supabase migration (SQL)**-аар, Supabase CLI-аар. Production DB-г dashboard-оор гар аргаар өөрчлөхгүй.
- Schema өөрчлөгдсөн бүрт `supabase gen types`-ээр TS төрлийг дахин үүсгэ.
- Олон бичилттэй үйлдэл (захиалга, inventory) **transaction** дотор — нарийн логикийг Postgres **RPC (function)** болгож `supabase.rpc()`-ээр дууд.
- Index-ийг хайлт/шүүлтийн талбарт (brand, gender, tags, price).
- Client-ээс хандах table-д **RLS policy** тавь.

**7.5 Аюулгүй байдал**
- Бүх input zod-оор. Server талд дахин шалга (client validation найдварлахгүй).
- Эрх шалгалт route handler бүр дотор. Зөвхөн middleware-д найдахгүй.
- Нууц (service role key, QPay credential) зөвхөн env-д, client bundle-д орохгүй (`NEXT_PUBLIC_` биш).
- QPay webhook гарын үсэг/баталгаажуулалтыг шалга.

**7.6 Git**
- Branch: `main` (production), `dev` (integration), feature: `feat/<name>`, fix: `fix/<name>`.
- `main`-д шууд push хийхгүй — PR-аар.
- Commit: **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`). Жижиг, утга бүхий commit.
- Migration ба түүнийг ашиглах код нэг PR-д.

**7.7 Чанар**
- PR-аас өмнө `pnpm lint` + `pnpm typecheck` цэвэр байх.
- Нэрлэлт ойлгомжтой англиар (UI текст Монголоор).
- Magic number/string-ийг `lib/constants.ts`-д.
- `// TODO:`-д шалтгаан бич.
- Pricing цөм (`lib/pricing`) ба inventory логикт **unit test заавал**.
- Critical flow (checkout, төлбөр) дээр гар аргаар тест хийж баталгаажуул.

**7.8 Хүртээмж ба гүйцэтгэл**
- Семантик HTML, `alt`, фокус харагдац, keyboard navigation.
- Зураг lazy load, шаардлагатай хэсгийг л client bundle-д.

**7.9 Орчны хувьсагч**
- Нууцыг кодод битгий бич. `.env.local` ашигла, `.env.example`-д түлхүүр нэрсийг тэмдэглэ (шинэ env нэмэгдэх бүрт шинэчил).
- Client-д ил гарах хувьсагч зөвхөн `NEXT_PUBLIC_` угтвартай (дэлгэрэнгүй §8).

---

## 8. Орчны хувьсагч (env)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # зөвхөн server, нууц
DATABASE_URL=                # Supabase Postgres connection (зөвхөн CLI migration-д)
# Social login-ийг Supabase dashboard дотор Google/Facebook provider-ээр тохируулна

# Storage (Supabase Storage — public bucket)
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=product-images

# Payment / Email / SMS
QPAY_USERNAME= / QPAY_PASSWORD= / QPAY_INVOICE_CODE=
RESEND_API_KEY=
MOBICOM_SMS_API_KEY= / MOBICOM_SMS_SENDER=   # утасны OTP (өөрийн урсгал)

# Analytics
NEXT_PUBLIC_GA_ID=           # GA4
NEXT_PUBLIC_META_PIXEL_ID=
```

---

## 9. Шийдвэрүүд ба анхаарах зүйл

### 9.1 Нэвтрэлт (шийдсэн)
Хоёр давхаргаар:
- **Supabase Auth** — имэйл + нууц үг, **имэйл OTP**, **Google / Facebook** social login.
- **Утасны OTP — Mobicom SMS service** дээр **өөрийн OTP урсгалаар**
  (Supabase phone auth Монголын gateway дэмждэггүй тул ашиглахгүй):
  1. Хэрэглэгч утсаа оруулна → route handler санамсаргүй код үүсгэж Mobicom API-аар илгээнэ.
  2. Код + дуусах хугацааг (ж: 5 мин) hash хэлбэрээр DB-д хадгална (rate-limit, оролдлогын хязгаартай).
  3. Код таарвал баталгаажуулж, Supabase session/identity-тэй холбоно.

### 9.2 Inventory нөөцлөлт (шийдсэн)
§6-д **reserve / commit / release** загвараар хэрэгжүүлнэ (oversell-аас сэргийлнэ).
Төлбөр хүлээх reserve-д timeout тавьж, хугацаа дуусвал pg_cron-оор автоматаар release.

### 9.3 Cron (шийдсэн)
**Supabase pg_cron** ашиглана — reserve timeout release, "Дууссан" авто төлөв,
доод хязгаарын сэрэмжлүүлэг, тайлангийн агрегаци. (Vercel hobby cron-ийн хязгаараас зайлсхийнэ.)

### 9.4 Төлбөрийн арга (шийдсэн)
QPay **ба банк шилжүүлэг** хоёул — checkout дээр сонгоно (roadmap Phase 3).

### 9.5 Дараа анхаарах (одоо биш)
- **Resend free tier** (≈100 имэйл/өдөр, 3000/сар) — newsletter жагсаалт томрох үед
  paid руу шилжих эсвэл өөр ESP сонгоно.
