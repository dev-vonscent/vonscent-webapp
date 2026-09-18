# vonscent.mn

Үнэртэн (perfume **decant**) худалдааны вэбсайт — бүтэн савнаас 2/5/10/20ml багцаар салгаж зарна.

Дэлгэрэнгүй техникийн баримтыг [`docs/`](./docs/README.md) фолдероос үзнэ үү —
`spec/` (шаардлага, дизайн), `planning/` (roadmap, todo), `import/` (дата импорт),
`delivery/` (хүргэлтийн бүс).

## Стек

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS 4 · shadcn-маягийн UI ·
Supabase (Postgres/Auth/Storage) · TanStack Query · Zustand · Zod · QPay · Resend · pnpm

## Эхлүүлэх

```bash
pnpm install
cp .env.example .env.dev    # dev сангийн түлхүүрүүдийг бөглөнө
ln -s .env.dev .env.local   # Next.js `.env.local`-ийг л уншина (доор үз)
pnpm dev                    # http://localhost:3000
```

> Supabase холбогдоогүй үед апп **seed дата (demo)**-аар бүрэн ажиллана.
> Холболтын дараа жинхэнэ дата руу шилжинэ.

## Скриптүүд

| Команд           | Үйлдэл                            |
| ---------------- | --------------------------------- |
| `pnpm dev`       | Хөгжүүлэлтийн сервер              |
| `pnpm build`     | Production build                  |
| `pnpm typecheck` | `tsc --noEmit`                    |
| `pnpm lint`      | ESLint                            |
| `pnpm test`      | Vitest (pricing цөмийн unit test) |
| `pnpm db:types`  | Supabase-аас TS төрөл үүсгэх      |
| `pnpm db:seed`   | Туршилтын бараа DB-д суулгах      |

## Орчны хувьсагч ба Vercel scope

Хувьсагчийн бүрэн жагсаалт, мөр бүрийн тайлбар [`.env.example`](./.env.example)-д.
Локалд:

```bash
cp .env.example .env.dev     # dev (preview) сан
cp .env.example .env.prod    # production сан

# Next.js нь `.env.dev`-ийг ОГТ уншдаггүй — зөвхөн `.env.local`,
# `.env.development`, `.env`-ийг хайдаг. Тиймээс symlink-ээр холбоно:
ln -s .env.dev .env.local
```

### Production ба Preview нь ӨӨР Supabase project

Хоёр орчин нэг сан руу заавал preview дээрх тест **жинхэнэ захиалга, жинхэнэ
хэрэглэгчийн дата** дээр ажиллана. Vercel дээр дараах байдлаар тохируулна
(Project → Settings → Environment Variables, хувьсагч бүрт scope сонгоно):

| Scope           | Утга                                    |
| --------------- | --------------------------------------- |
| **Production**  | `main` салбарын deploy                  |
| **Preview**     | PR / бусад салбарын deploy              |
| **Development** | `vercel dev` (энэ репод ашиглагддаггүй) |

### Хувьсагчийн scope-ийн хүснэгт

**Production ба Preview-д ӨӨР утгатай байх ёстой** — эдгээрийг хоёр scope-д
тус тусад нь, өөр утгаар нэмнэ:

| Хувьсагч                        | Яагаад өөр байх ёстой вэ                                               |
| ------------------------------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Өөр project ref                                                        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project бүр өөрийн түлхүүртэй                                          |
| `SUPABASE_SERVICE_ROLE_KEY`     | Мөн адил. ⛔ server-only                                               |
| `NEXT_PUBLIC_SITE_URL`          | Prod: `https://vonscent.mn` · Preview: preview домэйн                  |
| `AUTH_PASSCODE_PEPPER`          | Ижил байвал нэг орчны passcode hash нөгөөд хүчинтэй болно              |
| `QPAY_MOCK`                     | Prod: `false` · **Preview: `true`** (жинхэнэ мөнгө татахаас сэргийлнэ) |
| `VERIFY_MN_API_KEY`             | SMS квот, лог хоёр орчинд хольж болохгүй                               |

**Зөвхөн Production-д** (Preview-д хоосон орхино — тэгвэл тухайн боломж
автоматаар унтарч, гаднах сервис рүү санамсаргүй хүсэлт явахгүй):

| Хувьсагч                                              | Preview-д хоосон орхивол                       |
| ----------------------------------------------------- | ---------------------------------------------- |
| `RESEND_API_KEY`, `EMAIL_FROM`, `STORE_INBOX_EMAIL`   | Тест захиалга жинхэнэ хүн рүү и-мэйл илгээхгүй |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`        | Ажилтны чат тест мэдэгдлээр дүүрэхгүй          |
| `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_META_PIXEL_ID`      | Тест трафик аналитикийг бохирдуулахгүй         |
| `OPENAI_API_KEY`                                      | Санамсаргүй зарцуулалт гарахгүй                |
| `QPAY_USERNAME`, `QPAY_PASSWORD`, `QPAY_INVOICE_CODE` | QPay автоматаар mock болно                     |

**Хоёр scope-д ижил утгатай:** `NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET`,
`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`.

**Vercel дээр огт тавихгүй:** `DATABASE_URL` (зөвхөн локал migration/backup
script уншина — апп ажиллахад хэрэггүй), `SUPABASE_STORAGE_BUCKET`,
`IMAGE_QUALITY`.

> `DATABASE_URL`-ийн нууц үгэнд `%`, `@`, `/` байвал **percent-encode** хийнэ
> (`%`→`%25`). Эс бөгөөс URL нь дүрмийн хувьд буруу болно.

---

## Database

SQL migration-ууд [`supabase/migrations/`](./supabase/migrations)-д, дугаарлагдсан
дарааллаар. **Supabase CLI-ийн migration системийг ашигладаггүй** —
[`scripts/migrate.ts`](./scripts/migrate.ts) нь `pg`-ээр шууд холбогдож,
хэрэгжсэн файлуудыг `_app_migrations` хүснэгтэд нэрээр нь бүртгэдэг.
Тиймээс `supabase db push` / `supabase db pull` **ажиллуулахгүй** — тэдгээр нь
өөр бүртгэл (`supabase_migrations.schema_migrations`) хөтөлдөг тул хоёр систем
зөрчилдөнө.

```bash
pnpm db:migrate-dev   # .env.dev  → dev (preview) сан
pnpm db:migrate-prod  # .env.prod → production сан
pnpm db:seed-sql   # supabase/seed.sql (preview/local туршилтын дата)
pnpm db:seed       # каталогийн seed дата TS-ээр (scripts/seed.ts)
pnpm db:backup     # public схемийг файл болгож хуулна
pnpm db:diff       # хоёр сангийн schema-г харьцуулна (DB_A / DB_B)
pnpm db:snapshot   # алсын schema-г файл болгоно (DB_URL / OUT)
pnpm db:types      # TS төрөл (зөвхөн local Supabase дээр)
```

Өөр орчин руу хэрэгжүүлэхдээ env файлаа солино:

```bash
pnpm db:migrate-dev    # = node --env-file=.env.dev … scripts/migrate.ts
```

Migration нь идемпотент (`if not exists` / `on conflict do nothing`), файл бүр
өөрийн transaction дотор ажиллана — дахин ажиллуулахад аюулгүй.

### Preview сан руу туршилтын дата

```bash
pnpm db:seed-sql       # .env.dev руу л ажиллана (prod-д guard зогсооно)
```

[`supabase/seed.sql`](./supabase/seed.sql) нь бүхэлдээ **хиймэл** дата: 4 брэнд,
8 бараа (хэмжээ/үнэ/үлдэгдэл бүрэн), 3 багц, 5 купон, FAQ, блог, 4 туршилтын
хэрэглэгч (role бүрээр), 2 захиалга, оноо, үнэлгээ. Бодит хүний нэр/и-мэйл/утас
ороогүй — утас нь `9900000X`, и-мэйл нь phone auth-ийн синтетик домэйн.

Идемпотент: дахин ажиллуулахад мөр давхардахгүй. Хамгаалалттай — энэ файлын
үүсгээгүй захиалга санд байвал өөрөө зогсоно, тиймээс production дээр
ажиллахгүй. [`scripts/seed-sql.ts`](./scripts/seed-sql.ts) нь `psql -f`-ийн
оронд ашиглагдана: Supabase-ийн шууд хост IPv6-only тул IPv4 pooler руу
шилжих шаардлагатай (migration-тай ижил зам).

> Утас+passcode-оор нэвтрэхийн тулд seed-ийн дараа нэмэлт алхам хэрэгтэй —
> `supabase/seed.sql`-ийн §12.1-ийг үз.

---

## Migration workflow — prod ба preview зөрөхөөс сэргийлэх

Энэ репод нэг удаа schema зөрсөн түүх бий: `0054_role_in_jwt.sql` нь салбар
нийлэх үед **репооос алга болсон** атлаа prod дээр хэрэгжчихсэн байсан —
шинэ сан дээр тэр trigger огт үүсэхгүй байв. `0061_role_claim.sql` түүнийг
эргүүлэн бичиж зассан. Доорх дүрмүүд яг үүнээс сэргийлнэ.

**1. Migration нь нэг л чиглэлд урсана.**
`preview → production`. Prod дээр гараар (Supabase SQL Editor-оор) schema
өөрчлөхийг **бүрэн хориглоно** — тэр өөрчлөлт репод байхгүй тул дараагийн
шинэ сан дээр давтагдахгүй, яг дээрх алдаа дахин гарна.

**2. Нэг PR = schema + түүнийг ашиглах код.**
Аль нэг нь дутуу орвол deploy хоёр хэсэгт хуваагдаж, хооронд нь эвдэрсэн
төлөв үүснэ (CLAUDE.md-д аль хэдийн заасан).

**3. Migration файлыг ХЭЗЭЭ Ч устгахгүй, засахгүй.**
Хэрэгжсэн файл бол түүх. Буруу байсан бол **шинэ** migration бичиж засна
(`0056_drop_blog_cover_video.sql` яг ингэж хийгдсэн — зөв жишээ). Устгавал
prod-д ажилласан, шинэ санд ажиллахгүй зөрүү үүснэ.

**4. Дугаарын давхардлыг PR-т барина.**
`scripts/migrate.ts` давхардсан угтварыг олж зогсоодог. Хоёр салбар нэг
дугаар авсан бол дарааллыг хадгалахаар `a`/`b` үсэг залгаад `RENAMED`-д
бүртгэнэ.

**5. PR бүр preview дээр эхлээд хэрэгжинэ.**

```bash
pnpm db:migrate-dev
pnpm typecheck && pnpm lint && pnpm test
```

**6. Merge хийхийн өмнө зөрүүг шалгана.**

```bash
DB_A="<prod>" DB_B="<preview>" A_LABEL=prod B_LABEL=preview \
  node --import tsx scripts/schema-diff.ts
```

[`scripts/schema-diff.ts`](./scripts/schema-diff.ts) нь зөвхөн `SELECT` —
хүснэгт/багана, constraint, index, RLS policy, функц, trigger, view, enum,
storage bucket, pg_cron job, `_app_migrations` бүгдийг харьцуулна. Хүлээгдэж
буй цорын ганц зөрүү нь **энэ PR-ийн нэмж буй зүйл** байх ёстой.

**7. Merge хийсний дараа prod руу хэрэгжүүлээд дахин шалгана.**

```bash
pnpm db:migrate-prod                               # .env.prod → production
DB_A="<prod>" DB_B="<preview>" node --import tsx scripts/schema-diff.ts
```

Одоо зөрүү **тэг** байх ёстой.

**8. Аль ч санд `drop` / `truncate` / `reset` гараар ажиллуулахгүй.**
Устгах шаардлагатай бол migration дотор, `if exists`-тэй, тайлбартайгаар.

> **Санал:** §6-г CI-д оруулбал хүний сахилга батаас хамаарахгүй болно.
> `.github/workflows/ci.yml`-д prod/preview-ийн `DATABASE_URL`-ийг secret
> болгож өгөөд `schema-diff.ts`-ийг PR бүр дээр ажиллуулж, хүлээгдээгүй
> зөрүү гарвал unatna. Энэ нь одоохондоо **хийгдээгүй** — хийх эсэхийг
> шийдэх шаардлагатай.

## Гол функц — ml багцын үнэ (гар үнэ)

Хэмжээ бүрийн (2/5/10/20ml) үнийг **админ өөрөө бодож гараар оруулна** —
`product_variants.price`-д шууд хадгалагдана (`0027_manual_pricing.sql`).
Коэффициент, автомат шатлал байхгүй. Бүтэн савны үнэ/багтаамж нь зөвхөн
үлдэгдэл ба борлуулалт/ашгийн тайланд ашиглагдана. Unit test: `pnpm test`.
