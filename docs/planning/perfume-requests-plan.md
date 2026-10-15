# Шинэ үнэртний санал (perfume requests)

> Төлөв: **хэрэгжсэн** (салбар `feat/perfume-requests`), туг хаалттай.
> Огноо: 2026-10-14, хамрах хүрээ багассан 2026-10-15.
> Feature flag: `perfume_requests`
> Холбоотой: `docs/spec/development.md`, `docs/requirement_final.md` (91-р мөр — хоосон хайлтын харагдац)

## 1. Зорилго

Манайд байхгүй үнэртнийг нэвтэрсэн хэрэглэгч санал болгоно. Админ хэн юу
хүссэнийг тоогоор нь харж худалдан авалтаа шийднэ.

## 2. Шийдвэрүүд

| # | Асуулт | Шийдвэр |
| --- | --- | --- |
| 1 | Нийтийн санал хураалт уу? | **Үгүй.** Саналын тоо зөвхөн админд. |
| 2 | Зочин санал өгөх үү? | **Үгүй.** Нэвтэрсэн хэрэглэгч л (нэвтрэлт = утсаа баталгаажуулсан). |
| 3 | Оноо өгөх үү? | **Үгүй.** |
| 4 | Хэрэглэгчид хариу өгөх үү? | **Үгүй** (2026-10-15). Хэрэглэгч зөвхөн санал илгээнэ — «Миний саналууд» хуудас, имэйл байхгүй. |
| 5 | Админд мэдэгдэл? | **Үгүй** (2026-10-15). Telegram, sidebar-ын тоо байхгүй — админ хуудсаа нээж харна. |
| 6 | Админ төлөв удирдах уу? | **Үгүй** (2026-10-15). Зөвхөн жагсаалт: хэн, хэдэн хүн, тайлбар; давхардлыг нэгтгэх. |
| 7 | Админ хуудсыг тугаар хаах уу? | **Тийм.** |

## 3. Хэрэгжүүлэлт

```
supabase/migrations/0137_perfume_requests.sql
  perfume_request_key()       # брэнд+нэр → search_normalize, зай/тэмдэгтгүй
  perfume_requests, perfume_request_votes (+ vote_count trigger, staff-only RLS)
  submit_perfume_request()    # туг хаалттай → null; service_role л
  merge_perfume_requests()    # админ: давхардлыг нэгтгэх
src/lib/validators/perfume-request.ts        # Zod (форм + route)
src/features/perfume-requests/
  lib.ts                      # хайлтын үгийг брэнд/нэр болгож задлах
  server.ts                   # хэрэглэгч/админ route-ын gate
  components/perfume-request-form.tsx     # /request форм + каталог тулгалт
  components/perfume-requests-admin.tsx   # админы хүснэгт + дэлгэрэнгүй
src/components/shared/text-autocomplete.tsx  # брэндийн талбар (datalist биш)
src/app/(shop)/request/page.tsx
src/app/(admin)/admin/requests/page.tsx (+ loading.tsx)
src/app/api/perfume-requests/route.ts             # POST (илгээх)
src/app/api/admin/perfume-requests/[id]/route.ts  # GET (санал өгсөн хүмүүс)
src/app/api/admin/perfume-requests/[id]/merge/route.ts
scripts/test-perfume-requests.ts                  # pnpm db:test-perfume-requests-dev
```

- **Форм:** брэнд (`brands`-аас autocomplete, чөлөөт бичиж болно), нэр,
  төрөл (`concentrations` 0085-ийн идэвхтэй жагсаалт), тайлбар (≤ 300).
  Илгээхээс өмнө каталогоос хайж, ижил төстэй бараа байвал «Энэ үү?» гэж асууна.
- **Давхардал:** нэг үнэртэн = нэг мөр (`match_key`); ижил хүн дахин илгээвэл
  тоо нэмэгдэхгүй.
- **Нэвтрэх цэгүүд:** каталогийн хоосон хайлт, глобал хайлтын «олдсонгүй»
  (`?q=`-ээр форм урьдчилан бөглөгдөнө), footer (Тусламж), гар утасны цэс.
- **Админ:** Каталог → «Үнэртний санал». Хүссэн тоогоор эрэмбэлсэн, хайлттай;
  мөр дээр дарахад санал өгсөн хүмүүс (нэр, утас, тайлбар) ба нэгтгэх.

## 4. Хамгаалалт ба шалгалт

- **Feature flag:** хуудас (`notFound`), route (404), client холбоосууд
  (`useFeatureFlag`), RPC (`feature_enabled` → `null`). Хүснэгтэд бичих policy
  байхгүй, RPC зөвхөн `service_role`-д — туг хаалттай үед мөр үүсэх зам байхгүй.
- **Auth:** хэрэглэгч — `getUser()` → 401; админ — `getStaffUser()` → 403.
- **Rate limit:** `perfumeRequest` — хэрэглэгч бүрт өдөрт 10.
- **Тест:** vitest (`perfume-request.test.ts`, `lib.test.ts`); SQL integration
  `pnpm db:test-perfume-requests-dev` (rollback дотор): туг хаалттай, «+1»,
  кирилл↔латин, буруу оролт, cascade, нэгтгэх, эрх.

## 5. Судалгааны товч (бусад сайт)

| Сайт | Хэлбэр | Сургамж |
| --- | --- | --- |
| [DecantX](https://www.decantx.com/pages/request-a-fragrance) | Header/footer-т форм: нэр, имэйл, чөлөөт текст | Хамгийн энгийн; илгээсний дараа хариугүй — «хар нүх» мэдрэмж |
| [Scento](https://help.scento.com/en/articles/13010081-can-i-request-a-specific-fragrance) | Имэйлээр: брэнд, нэр, концентраци, шалтгаан | Олон хүн хүссэн нь түрүүлнэ; нэмэгдэхэд мэдэгдэнэ; **татгалзах шалтгаанаа нийтэлсэн** |
| Decant Store | Дууссан бараанд «Join Waitlist» (имэйл) | Бараа ирэхэд мэдэгдэл |
| Surrender to Chance, Scent Split | Зөвхөн wishlist / contact | Тусгай форм байхгүй |
| Badger & Blade Decant Club | Нэр дэвшүүлэх → санал хураалт → хуваалт | Phase 2-ын «бүлгийн хуваалт»-ын жишээ |
| Shopify app (Hark, ProductLift) | Autocomplete + давхардал нэгтгэх | Чөлөөт текст биш, бүтэцтэй талбар |

Гол сургамж:
- Чөлөөт текстээр асуувал нэг үнэртэн олон янзаар бичигдэж эрэлтийг тоолж
  чадахгүй → **брэнд + нэр бүтэцтэй, normalize хийсэн түлхүүрээр нэгтгэнэ**.
- Хариугүй форм итгэл алддаг гэдэг эрсдэлтэй. Клиент хариугүй хувилбарыг
  сонгосон (2026-10-15); хэрэгтэй бол төлөв + имэйлийг дараа нэмж болно.
- Татгалзах шалтгааныг урьдчилан тодорхой бичнэ (хүлээлт удирдах).

## 6. Release

1. `pnpm db:migrate-dev` → `pnpm db:test-perfume-requests-dev` → dev дээр туг нээж туршина.
2. `pnpm db:migrate-prod` (туг prod дээр хаалттай) → main руу merge.
3. Release өдөр: Админ → Feature flag → `perfume_requests` нээнэ.
4. Тогтворжсоны дараа тугийг кодоос + сангаас устгана.

## 7. Phase 2 (энэ хамрах хүрээнд биш)

- **Бүлгийн хуваалт**: «N хүн захиалбал хуваалт нээгдэнэ». Босго хүрэхээс
  өмнө мөнгө авахгүй; хугацаа + буцаалтын логик хэрэгтэй.
- Админ санал өгсөн хэрэглэгчдэд «түрүүлж худалдан авах» эрх нээх.
