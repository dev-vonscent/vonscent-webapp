# CLAUDE.md — vonscent.mn

Үнэртэн (perfume decant) худалдааны сайт: бүтэн савнаас 2/5/10/20ml багцаар салгаж зарна.
UI текст **Монголоор**, код/нэршил англиар. pnpm ашиглана.

## Стек

Next.js 16 App Router · TypeScript strict · Tailwind CSS 4 · shadcn-маягийн UI (`src/components/ui` — шууд засахгүй, wrapper хий) · Supabase (Postgres/Auth/Storage, supabase-js — ORM байхгүй) · TanStack Query · Zustand (сагс) · Zod · QPay · Resend · Sentry

## Командууд

```bash
pnpm dev / build / typecheck / lint / test        # test = vitest
pnpm test:e2e                                     # Playwright
pnpm db:migrate                                   # migration (.env.local уншина)
pnpm db:types                                     # зөвхөн local Supabase дээр ажиллана
```

PR-аас өмнө: `pnpm typecheck` + `pnpm lint` + `pnpm test` цэвэр байх ёстой.

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
- Cron: Supabase pg_cron (оноо нээх, reserve timeout, төлөв авто шилжилт).

## Styling

- Tailwind utility, theme token — өнгө/зай hardcode хийхгүй. **Gradient хэрэглэхгүй** (design.md).
- Mobile-first responsive, dark mode-д бэлэн (next-themes).
- Themed scrollbar нь `html` дээр өгөгдмөл, бүх гүйдэг элементэд удамшина — элемент
  бүрт класс нэмэхгүй. Нуух шаардлагатай ховор тохиолдолд л `no-scrollbar` (design.md §6.1).

## Git

- `main` = production, PR-аар л орно. Feature: `feat/<name>`, fix: `fix/<name>`. Conventional Commits.

## Баримт (хэрэгтэй үедээ л унш)

- `docs/spec/development.md` — архитектур, кодын дүрмийн бүрэн эх сурвалж
- `docs/requirement_final.md` — бизнес шаардлага; `docs/spec/` — бусад spec
- `docs/planning/todo.md` — гүйцэтгэлийн төлөв, клиентээс тодруулах асуултууд
- `docs/README.md` — баримтын индекс, импорт/хүргэлтийн заавар
