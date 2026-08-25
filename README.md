# vonscent.mn

Үнэртэн (perfume **decant**) худалдааны вэбсайт — бүтэн савнаас 2/5/10/20ml багцаар салгаж зарна.

Дэлгэрэнгүй техникийн баримтыг [`docs/`](./docs/README.md) фолдероос үзнэ үү —
`spec/` (шаардлага, дизайн), `planning/` (roadmap, todo), `import/` (дата импорт),
`delivery/` (хүргэлтийн бүс).

## Стек

Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS 4 · shadcn-маягийн UI ·
Supabase (Postgres/Auth/Storage) · TanStack Query · Zustand · Zod · QPay · Cloudflare R2 · Resend · pnpm

## Эхлүүлэх

```bash
pnpm install
cp .env.example .env.local   # түлхүүрүүдийг бөглөнө
pnpm dev                     # http://localhost:3000
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

## Database

SQL migration-ууд [`supabase/migrations/`](./supabase/migrations)-д. Supabase CLI-аар:

```bash
supabase start          # local
supabase db push        # migration хэрэгжүүлэх
pnpm db:types           # төрөл дахин үүсгэх
pnpm db:seed            # seed дата
```

## Гол функц — ml багцын үнэ (гар үнэ)

Хэмжээ бүрийн (2/5/10/20ml) үнийг **админ өөрөө бодож гараар оруулна** —
`product_variants.price`-д шууд хадгалагдана (`0027_manual_pricing.sql`).
Коэффициент, автомат шатлал байхгүй. Бүтэн савны үнэ/багтаамж нь зөвхөн
үлдэгдэл ба борлуулалт/ашгийн тайланд ашиглагдана. Unit test: `pnpm test`.
