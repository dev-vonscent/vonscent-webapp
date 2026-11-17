# CLAUDE.md — vonscent.mn

Үнэртэн (perfume decant) худалдааны сайт: бүтэн савнаас 2/5/10/20ml багцаар салгаж зарна.
UI текст **Монголоор**, код/нэршил англиар. pnpm ашиглана.

## Стек

Next.js 16 App Router · TypeScript strict · Tailwind CSS 4 · shadcn-маягийн UI (`src/components/ui` — шууд засахгүй, wrapper хий) · Supabase (Postgres/Auth/Storage, supabase-js — ORM байхгүй) · TanStack Query · Zustand (сагс) · Zod · QPay · Resend · Sentry

## Командууд

```bash
pnpm dev / build / typecheck / lint / test        # test = vitest
pnpm test:e2e                                     # Playwright
pnpm db:migrate-dev                               # migration → dev сан (.env.dev)
pnpm db:migrate-prod                              # migration → prod сан (.env.prod)
pnpm db:types                                     # зөвхөн local Supabase дээр ажиллана
```

**Хоёр сан тусдаа:** `.env.dev` (dev/preview) ба `.env.prod` (production) —
өөр өөр Supabase project. Локал ажилд **үргэлж dev** сан: Next.js нь
`.env.dev`-ийг уншдаггүй тул `.env.local` нь түүн рүү symlink
(`ln -s .env.dev .env.local`). Ингэснээр `pnpm dev` болон локал
`next build` хоёулаа dev сан руу заана, prod хэзээ ч санамсаргүй хөндөгдөхгүй.

Migration нь **dev → prod** гэсэн нэг чиглэлд урсана
(`pnpm db:migrate-dev` → шалгах → `pnpm db:migrate-prod`); prod дээр гараар
schema засахыг хориглоно. Дэлгэрэнгүй: README «Migration workflow».

**Preview:** Vercel-ийн Supabase env зөвхөн `dev` branch-д тохируулагдсан тул бусад
branch-ийн preview DEMO горимд (seed өгөгдөл) ажиллана. Бодит (dev сан) өгөгдлөөр
тестлэх бол локал (`pnpm build && pnpm start`) эсвэл `dev`-ийн preview.

PR-аас өмнө: `pnpm typecheck` + `pnpm lint` + `pnpm test` + `pnpm build` цэвэр байх ёстой;
UI-д нөлөөлөх бол `pnpm test:e2e`. Unit тест эх файлынхаа хажууд (`*.test.ts(x)`,
ганцыг нь: `pnpm test <зам>`), e2e нь `e2e/*.spec.ts`. e2e тугийн утгаас болж хачин
унавал эхлээд `.next/cache`-ийг устгаад дахин build хий (өмнөх build-ийн туг кэшлэгддэг).

## Архитектур (дэлгэрэнгүй: docs/spec/development.md)

- `src/features/<domain>/` — components / hooks / api.ts гэж домэйнаар бүлэглэнэ.
- UI-д бизнес логик бичихгүй; өгөгдөл `features/*/api.ts` буюу service давхаргаас.
- Client → TanStack Query → `app/api` route handler → supabase. `SUPABASE_SERVICE_ROLE_KEY` зөвхөн server талд.
- Бүх гадны input Zod-оор (client + server хоёуланд); эрх шалгалтыг route handler бүр дотор давт.
- Мөнгөн дүн **integer ₮** — float хэрэглэхгүй. Magic утгууд `src/lib/constants.ts`-д.
- Schema өөрчлөлт бүр `supabase/migrations/` SQL-ээр; migration + ашиглах код нэг PR-д.
- Олон бичилттэй үйлдэл (захиалга, inventory) Postgres RPC + transaction/row lock дотор.

## Гол домэйн дүрмүүд

- **Үнэ гараар:** хэмжээ бүрийн үнийг админ өөрөө бичнэ — `product_variants.price` (0027_manual_pricing). Коэффициент/авто тооцоо **байхгүй** (README-гийн "автомат шатлал" гэсэн хэсэг хуучирсан).
- Хэмжээ хаалттай жагсаалт: `ML_SIZES` (constants) + DB check. **2ml нь sample биш** — 5/10/20ml-тэй адил энгийн хэмжээний сонголт; багц (bundle) угсрахад ч дан 2ml-ээр угсарч болно. (Сар бүрийн 1ml бэлгийн sample нь тусдаа ойлголт.)
- Inventory: эх савны ml дээр **reserve / commit / release** загвар, oversell хориотой.
- Roles: guest / customer / courier / operator / super_admin — `(admin)` бүлэг middleware + handler дотор давхар шалгалттай.
- Утасны баталгаажуулалт verify.mn MO-SMS (Supabase phone auth биш).
- Cron: DB-ийн ажил (оноо нээх, reserve timeout, төлөв авто шилжилт) → Supabase pg_cron;
  кэш цэвэрлэх, гадны API → Vercel cron (`vercel.json`, доорх «Vercel-ийн зардал»).

## Шинэ feature → prod (feature flag)

Шинэ feature prod руу **унтраалттай** орж, release өдөр админаас нээгдэнэ.
Бүх ажлыг dev дээр хуримтлуулж нэг дор merge хийхгүй. Туг нь **санд**
(`feature_flags`, 0133) байдаг тул dev/prod тус тусдаа утгатай: dev дээр
клиент туршина, prod хаалттай хэвээр. Кодонд `*_HIDDEN` const шинээр нэмэхгүй.

- **Бүртгэл:** `FEATURE_FLAGS` (constants)-д түлхүүр + label/description,
  feature-ийн migration-д `insert into feature_flags (key) values ('x') on conflict do nothing;`.
- **Гурван давхаргад шалгана** — UI-г нуух нь хангалтгүй:
  - Хуудас/route: `isFeatureEnabled("x")` (`src/lib/feature-flags.ts`) → `notFound()` / 404
  - Client component: `useFeatureFlag("x")` (`src/components/feature-flags.tsx`)
  - Trigger / RPC / pg_cron: `if not feature_enabled('x') then ... end if;`
  Хаалттай үед prod дээр өгөгдөл (оноо, эрх, бүртгэл) хуримтлагдах ёсгүй
  (0130_spin_wheel_default_off-ийн сургамж).
- **Migration = expand only:** шинэ table, nullable багана, шинэ RPC — хуучин
  кодтой ажиллах ёстой. Дараалал: `db:migrate-prod` → дараа нь main руу merge.
  Багана устгах / нэр солих / NOT NULL болгохыг feature нээгдсний дараа тусдаа PR-аар хийнэ.
- Өгөгдлийн импорт (олон бүртгэл г.м.) migration биш, `scripts/` доорх script.
- Нээх/хаах: Админ → Feature flag (зөвхөн super_admin). Нээгдэж тогтворжсоны
  дараа тугийг кодоос + сангаас хамт устга.
- PR тайлбарт: тугийн нэр, migration жагсаалт, хаалттай үед юу ч
  хуримтлагдахгүйг хэрхэн шалгасан.

## Vercel-ийн зардал (ISR, cron, CDN): 2026-11-ийн сургамж

Төлбөр $27-оос $60 болж өссөнийг #279–#282-оор засав (ISR-ийн бичилт −76%). Шинэ код бичихдээ:

- **ISR хуудасны render тогтмол байх.** Сервер дээр (`"use client"` компонентын SSR-ийг оролцуулаад)
  `Math.random`, `new Date()`/`Date.now()`-ээс хамаарсан текст, санамсаргүй ID бүү гарга. Эс бөгөөс
  дахин үүсгэлт бүрт хуудас бүтнээрээ Vercel-д дахин бичигдэнэ (ISR Writes).
  Холих → `dailyRandom(salt)` (`src/lib/seeded-random.ts`), харьцаангуй хугацаа → `RelativeTime`
  (`src/components/shared/relative-time.tsx`, client дээр бодно).
- **`revalidate`-ийг богиносгохгүй.** Shop хуудас 3600. Өгөгдөл өөрчлөгдөхөд on-demand цэвэрлэ
  (`src/lib/cache.ts`): админы бичилт → `revalidatePublic()`, захиалга/нөөц →
  `revalidateStock({ productSlugs, collectionSlugs, extraSlugs })`, төлбөр → `revalidateLeaderboard()`,
  hero → `revalidateHero()`. Хамгийн жижиг tag/path-ийг сонго. Захиалгын урсгалд
  `revalidatePath("/", "layout")` бүү дууд.
- **Cache tag** (`src/lib/cache-tags.ts`): `catalog` = админы өөрчлөлт (савны түгжээгээр бүх барааны
  хуудсанд наалддаг тул захиалгаар бүү цэвэрлэ), `stock` = үлдэгдэл, `leaderboard`, `hero`.
  Шинэ `unstable_cache` бүрт tag өг. Layout-д уншигддаг кэшийн `revalidate` нь бүх shop хуудасны
  ISR-ийн дээд хязгаар болдог.
- **Цагаар солигдох агуулга** (хямдрал, арга хэмжээ, hero, улирал) УБ-ын 00:00-д эхэлж 23:59:59-д
  дуусдаг. Үүнийг `/api/cron/midnight-revalidate` (00:01, 00:04) барина. Минут тутмын cron бүү нэм,
  шинэ хилийг энэ cron-д нэм. Vercel-ийн cron UTC-аар ажилладаг (УБ = UTC+8).
- **Байхгүй хуудас 404 буцаах.** `notFound()`-ийг `loading.tsx`-ээс дээш (`layout.tsx`) шалга.
  Эс бөгөөс 200 статустайгаар ISR-д кэшлэгдэнэ.
- **CDN request** (Flat Rate 1M/сар-аас давбал +$20): polling, cache-гүй route, хэрэггүй prefetch-ээс
  зайлсхий. Sentry-ийн `tunnelRoute` болон `next.config.ts`-ийн trace meta шүүлтүүрийг бүү буцаа.
- **Preview build:** `vercel.json`-ийн `ignoreCommand` (`scripts/vercel-ignore-build.sh`)-ийн дагуу
  PR-гүй branch build хийгдэхгүй (push → PR нээх → дахин push).

## Styling

- Tailwind utility, theme token — өнгө/зай hardcode хийхгүй. **Gradient хэрэглэхгүй** (design.md).
- Mobile-first responsive, dark mode-д бэлэн (next-themes).
- Themed scrollbar нь `html` дээр өгөгдмөл, бүх гүйдэг элементэд удамшина — элемент
  бүрт класс нэмэхгүй. Нуух шаардлагатай ховор тохиолдолд л `no-scrollbar` (design.md §6.1).
- Сонгогдсон chip/tab-д (URL солиж серверийн render өдөөдөг бол) `transition-colors` бүү
  хэрэглэ; сонгогдсон төлөвт `bg-cta text-cta-foreground` (design.md §7.1).

## Git

- `main` = production, `dev` = интеграц (клиент dev-ийн preview дээр туршина). Хоёулаа PR-аар л орно.
- Branch: `feat/`, `fix/`, `perf/`, `chore/`, `docs/` + `<name>`. Conventional Commits.
- Feature/fix PR → **Squash and merge**. main ↔ dev нэгтгэл (`chore/sync-main-to-dev-*`) болон
  dev → main release → **Create a merge commit** (squash хийвэл түүхийн холбоо алдагдаж
  дараагийн нэгтгэлд conflict давтагдана).
- main руу яаралтай засвар: `origin/main`-аас салгаж PR → main, дараа нь main-ийг dev руу нэгтгэ.

## Баримт (хэрэгтэй үедээ л унш)

- `docs/spec/development.md` — архитектур, кодын дүрмийн бүрэн эх сурвалж
- `docs/requirement_final.md` — бизнес шаардлага; `docs/spec/` — бусад spec
- `docs/planning/todo.md` — гүйцэтгэлийн төлөв, клиентээс тодруулах асуултууд
- `docs/README.md` — баримтын индекс, импорт/хүргэлтийн заавар
