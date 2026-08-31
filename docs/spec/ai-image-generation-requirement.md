# AI зураг үүсгэлт — Бүрэн шаардлага

> Админ шинэ бараа нэмэхэд барааны зургийг **AI-аар автоматаар үүсгэх** функц.
> Эх сурвалж: клиентийн анхан шатны шаардлага + урсгал (доор §14-т эх хэлбэрээр).
> Одоогийн кодын суурь дээр буулгав: `product-form.tsx`, `/api/admin/products`,
> `product_images` (0003), `lib/storage/storage.ts`, `/admin/products` table.

**Тэмдэглэгээ:** `[ ]` хийгээгүй · `[x]` хийгдсэн · 🔵 DB migration шаардана · 🟢 DB өөрчлөлт шаардахгүй · ❓ тодруулах

> ### ⚠️ 2026-08 өөрчлөлт — popup байхгүй болов
>
> Доорх §9, §14.5 дэх **popup** урсгал хүчингүй. Зургийн бүх үйлдэл нэмэх/засах
> хуудасны хамгийн дээд талын **«Зураг» блок** (`product-image-studio.tsx`)-д
> нэгдсэн: галерей, лавлах зураг солих, засвар бичих, дахин үүсгэх, AI
> хувилбарыг галерейд нэмэх. Жагсаалтын мөрөнд зураг эсвэл нэр дээр дарахад
> засах хуудас нээгдэнэ (popup биш).
>
> Үүнтэй холбоотой:
> - `imageMode` талбар алга — оронд нь `referenceUrl` + `generateImage`.
>   Лавлах зураг нь галерейн эхний зураг биш, **тусдаа талбар**
>   (`products.reference_image_url`) бөгөөд хоёулаа зэрэг байж болно.
> - `POST /api/admin/products/[id]/reference-image` (солих) ба `DELETE` (хасах)
>   нэмэгдэв.
> - **Нэг галерей** (0049). AI-аар үүсгэсэн зураг дуусмагцаа `product_images`-д
>   мөр болж бичигдэнэ — өмнөх шиг «батлахад хуулагдах» зүйл байхгүй.
>   `product_images.is_visible` нь админы сонголт: аль зураг **сайтад
>   харагдахыг** зурган тайл дээрээс дарж сонгоно. Оруулсан зураг сонгогдсон,
>   AI-аар үүссэн зураг сонгогдоогүй байдлаар нэмэгдэнэ.
> - Storefront бүх уншилт `is_visible`-ээр шүүнэ (`features/products/api.ts`,
>   `features/reviews/api.ts`).
> - `approve-image`, `use-generation` (хуучин `revert-image`), `generations`
>   route-ууд **устгав** — сонголт нь галерейн тайл дээр байх тул хэрэггүй.
>   `image-status` нь зөвхөн ажлын төлөв/алдаа буцаана.
> - `generate-image` (дахин оролдох) route ашиглагдахгүй байсан тул **устгав** —
>   амжилтгүй болсон үед `regenerate-image` ажиллана.
> - Бараа нийтлэгдэх эсэхийг зөвхөн маягтын «Идэвхтэй» checkbox шийднэ.

> **AI provider:** OpenAI **gpt-image-1** (Images API). Env: `OPENAI_API_KEY`
> (сервер талд, `NEXT_PUBLIC_` угтваргүй). Түлхүүр байхгүй үед функц идэвхгүй
> (demo — бараа ердийн журмаар хадгалагдана, зураг үүсэхгүй).

---

## 1. Зорилго ба хамрах хүрээ

Админ бараа нэмэх/засах үед: **лавлах (reference) зураг + бөглөсөн мэдээлэл + үндсэн
prompt**-оос барааны eCommerce-д тохирсон бүтээгдэхүүний зургийг AI үүсгэнэ.
Үүсгэлт нь **фон дээр (асинхрон)** явагдаж, барааны жагсаалтын хүснэгтэд төлөв
(үүсэж буй / амжилтгүй / бэлэн) харагдана. Мөр дэх зураг дээр дарж **томоор харах,
prompt засах, дахин үүсгэх** боломжтой.

---

## 2. Оролт (inputs)

**Барааны форм 2 горимтой** (§14.3): **① Бэлэн зураг оруулах** (одоогийн зан —
зургийг шууд upload) эсвэл **② AI-аар үүсгэх**. Горимыг форм дээр toggle-оор сонгоно.
AI-аар үүсгэх горимд лавлах зураг **заавал**.

Зураг үүсгэхэд ашиглах эх мэдээлэл:

1. **Лавлах зураг** (`reference`) — админ форм дээр «Зураг» (`ProductImages`) хэсэгт
   үнэртний зураг оруулна. Энэ нь gpt-image-1-ийн image-to-image (edits) оролт
   болно. **AI үүсгэх горимд ЗААВАЛ** — байхгүй бол «Дахин үүсгэх»/«Үүсгэх» идэвхгүй.
2. **Барааны талбарууд** (context) — форм дээр бөглөсөн мэдээллийг prompt-д нэмнэ:
   `name`, `brand`, `gender`, `concentration`, `notesTop/Heart/Base`,
   `scentFamilies`, `seasons`, `originCountry`, `releaseYear`,
   `shortDescription`. (Эдгээр нь `productInputSchema`-д аль хэдийн бий.)
3. **Үндсэн prompt** (`basePrompt`) — админаас тохируулдаг загвар prompt
   (`settings.imageGen.basePrompt`). Барааны фото-стайлыг тодорхойлно (жишээ:
   «Professional e-commerce product photo of a perfume bottle, centered on a
   clean soft-gradient studio background, high detail, sharp focus, no text»).

---

## 3. Prompt угсралт

Prompt-ыг **англи хэлээр** угсарна (gpt-image-1-д илүү тохиромжтой — §14.6). Үндсэн
загвар англиар; барааны талбаруудын утгыг (нэр, брэнд, нот г.м.) байгаагаар нь
дамжуулна. Сервер талд эцсийн prompt-ыг угсарна (клиентээс ирсэн түүхий утгад бүү итгэ):

```
<basePrompt>

Perfume: <brand> — <name>
Type: <concentration> · <gender>
Notes: top <notesTop>; heart <notesHeart>; base <notesBase>
Family/Season: <scentFamilies>, <seasons>
Origin/Year: <originCountry>, <releaseYear>
Style hints: <shortDescription>
```

- Талбар хоосон бол мөрийг алгасна.
- Эцсийн угсарсан prompt-ыг **`product_image_generations.prompt`**-д хадгална
  (дараа засах/дахин үүсгэхэд ашиглана).
- Prompt-ыг сервер талд угсрах helper: `lib/ai/build-image-prompt.ts`.

---

## 4. AI provider — OpenAI gpt-image-1

- **Лавлах зурагтай** (edits): `POST https://api.openai.com/v1/images/edits`
  (multipart) — `model=gpt-image-1`, `image[]=<reference>`, `prompt`, `size`,
  `quality`, `n=1`. → `data[0].b64_json`.
- **Лавлах зураггүй** (generations): `POST /v1/images/generations` —
  `model=gpt-image-1`, `prompt`, `size`, `quality`. → `data[0].b64_json`.
- **Хэмжээ:** барааны карт нь босоо (`aspect-4/5`) тул `size=1024x1536` санал болгоно
  (эсвэл тохиргоо). **Чанар:** `quality` = `medium` default (тохиргоо).
- b64 үр дүнг PNG/WebP болгон `sharp`-аар оптимайз хийж (аль хэдийн орсон), Supabase
  Storage-д `uploadImage()`-аар байршуулна (`products/<slug>/<uuid>.png`).
- Сервер талын helper: `lib/ai/generate-image.ts` (fetch эсвэл `openai` npm).
  `OPENAI_API_KEY`-г `lib/env.ts`-д нэмнэ (`openaiKey`, `isImageGenConfigured`).

---

## 5. Дата модель (🔵 migration `0030_image_generation.sql`)

Үүсгэлтийн төлөв, prompt, алдаа, түүхийг хадгалах ажлын хүснэгт:

```sql
do $$ begin
  create type image_gen_status_t as enum ('pending','generating','done','failed');
exception when duplicate_object then null; end $$;

create table product_image_generations (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references products(id) on delete cascade,
  status        image_gen_status_t not null default 'pending',
  prompt        text not null default '',
  reference_url text,                 -- админы оруулсан лавлах зураг
  result_url    text,                 -- үүсгэсэн зургийн public URL
  error         text,                 -- fail болсон шалтгаан
  attempts      int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on product_image_generations (product_id, created_at desc);

create trigger pig_updated_at before update on product_image_generations
  for each row execute function set_updated_at();
```

- Барааны «одоогийн» AI зураг = хамгийн сүүлийн `done` бичлэгийн `result_url`.
  Батлагдсаны дараа `result_url`-ыг `product_images` (sort_order 0)-д бичнэ (§5b).
- **Түүх / буцаах** (§14.5): бараа бүр олон `done` бичлэгтэй байж болно (`created_at
  desc`). Popup-д хуучин хувилбаруудыг харж, аль нэгийг «сэргээх» → тухайн
  `result_url`-ыг идэвхтэй болгоно (`product_images` sort_order 0 солино).
- **RLS:** зөвхөн staff (0009-ийн `is_staff()`) унших/бичих. Storefront хэрэглэгч
  энэ хүснэгтийг харахгүй.
- `settings`-д `('imageGen', {...})` мөр нэмнэ (§12).

---

## 5b. Нийтлэх / батлах дүрэм (§14.4)

- **AI-аар үүсгэсэн бараа** → шууд **нийтлэхгүй**. Create үед `products.is_active =
  false` (жагсаалтад «Нуусан/идэвхгүй»). Админ popup-д зургийг хараад **батлаж**
  (идэвхжүүлж) storefront-д гаргана. Батлах = `is_active=true` болгож, тухайн
  `result_url`-ыг `product_images`-д тавих.
- **Бэлэн зураг оруулсан** (① горим) → одоогийн зан: шууд идэвхтэй, шууд нийтлэгдэнэ.
- Тэгэхээр `is_active`-ийн анхны утга **горимоос** хамаарна: AI → `false`, upload → `true`.

---

## 6. Асинхрон боловсруулалт (background)

Үүсгэлт 10–60 сек үргэлжилдэг тул **хадгалахыг блоклохгүй**:

1. **Create** (`/api/admin/products` POST) — бараа + variant + inventory-г үүсгэнэ.
   **AI горим** бол `products.is_active=false` (батлагдтал нуугдана — §5b) ба
   `product_image_generations` мөрийг `status='pending'`, англи prompt-той нэмээд
   **generate-ийг эхлүүлнэ** (доор). **Бэлэн зураг горим** бол одоогийн зан
   (`is_active=true`, зургийг шууд `product_images`-д).
2. **Generate** (`POST /api/admin/products/[id]/generate-image`) — тухайн барааны
   хамгийн сүүлийн `pending` job-ыг `generating` болгож, OpenAI дуудаж, storage-д
   байршуулж, `done`/`failed` болгоно. Идемпотент (давхар дуудахад аль хэдийн
   generating/done бол алгасна).
3. **Эхлүүлэх арга** (§14.1 — баталсан): create дараа **`after()` (Next.js) /
   `waitUntil`**-аар generate-ийг сервер талд фоноор дуудна — клиент `/admin/products`
   руу navigate хийсэн ч үргэлжилнэ. (Нөөц: удаан/тасарсан job-ыг pg_cron-оор
   дахин түүж болно.)
4. **Төлөв polling** — жагсаалтын хүснэгт клиент талаас job төлөвийг тодорхой
   давтамжтай (жишээ 3–5 сек) шалгаж, `generating` байгаа мөрүүд шинэчлэгдэнэ
   (`GET /api/admin/products/image-status?ids=…` эсвэл Supabase realtime).

---

## 7. API endpoints

| Method | Path | Зорилго | Эрх |
|---|---|---|---|
| POST | `/api/admin/products` (одоо байгаа) | Бараа үүсгэх + generation job enqueue | staff |
| POST | `/api/admin/products/[id]/generate-image` | Job боловсруулах (OpenAI → storage → done/failed) | staff |
| POST | `/api/admin/products/[id]/regenerate-image` | Засварласан prompt-оор шинэ job үүсгэж боловсруулах | staff |
| POST | `/api/admin/products/[id]/approve-image` | AI зургийг батлах: `product_images`-д тавьж `is_active=true` (§5b) | staff |
| POST | `/api/admin/products/[id]/revert-image` | Өмнөх `done` хувилбар руу сэргээх (`generationId`) (§14.5) | staff |
| GET | `/api/admin/products/image-status?ids=…` | Олон барааны одоогийн зураг + төлөв (polling) | staff |

- Бүгд `getStaffUser()`-аар хамгаалагдана. `OPENAI_API_KEY` **зөвхөн серверт**.
- Demo (Supabase/OpenAI тохируулаагүй) үед: create нь `demo:true` буцаана, job
  үүсгэхгүй.

---

## 8. Админ жагсаалтын хүснэгт (UI) — `/admin/products`

Одоогийн `page.tsx` хүснэгтэд **«Зураг» багана** нэмнэ (эхэнд). Мөр бүрийн зургийн
нүд нь job төлвийг харуулна:

| Төлөв | Харагдац |
|---|---|
| `generating` / `pending` | **Loader** (эргэлддэг), «Үүсгэж байна…» |
| `failed` | **Алдааны icon** (улаан), hover-т алдааны текст, дахин оролдох боломж |
| `done` | **Үүсгэсэн зураг** (thumbnail) |
| зураггүй (AI ашиглаагүй) | Placeholder (одоогийн зан) |

- Хүснэгт нь **client component**-т шилжинэ (эсвэл зургийн нүд нь client island)
  — polling хийж `generating` мөрүүдийг шинэчлэхийн тулд.
- Зургийн нүд дээр дарахад **popup** (§9) нээгдэнэ.

---

## 9. Popup (зураг харах / prompt засах / дахин үүсгэх)

Мөрийн зураг дээр дарахад Dialog нээгдэнэ:

- **Томруулсан зураг** — үүсгэсэн зургийг том хэмжээгээр (`done` үед). `generating`
  бол loader, `failed` бол алдааны мэдэгдэл.
- **Prompt текст талбар** (`<textarea>`) — угсарсан/сүүлд ашигласан prompt
  засварлаж болно.
- **«Дахин үүсгэх»** товч — засварласан prompt-оор `regenerate-image`-ийг дуудаж,
  шинэ job эхлүүлнэ; popup доторх төлөв loader → зураг болж шинэчлэгдэнэ.
- **«Батлаж нийтлэх»** товч (§5b) — AI зургийг зөвшөөрч `product_images`-д тавьж,
  барааг `is_active=true` болгоно (идэвхгүй → нийтлэгдэнэ).
- **Түүх** (§14.5) — тухайн барааны өмнөх `done` хувилбарууд thumbnail-аар; аль
  нэгийг **«Сэргээх»** → идэвхтэй зургийг тэр рүү солино.
- (Сонголт) **Лавлах зураг солих** — шинэ reference upload хийж дахин үүсгэх.

---

## 10. Storage

- Үүсгэсэн зураг: `sharp`-аар оптимайз → `uploadImage("products/<slug>/<uuid>.png", …)`
  (одоогийн `lib/storage/storage.ts`). `result_url` = public URL.
- `done` үед `product_images`-д (sort_order 0) upsert — storefront карт/галерейд
  шууд харагдана.
- Лавлах зургийг мөн storage-д (staging) хадгалж `reference_url`-д тавина (дахин
  үүсгэхэд ашиглах).

---

## 11. Тохиргоо (`settings.imageGen`) 🟢

| Түлхүүр | Утга | Default |
|---|---|---|
| `enabled` | AI зураг үүсгэлт идэвхтэй эсэх | `true` |
| `basePrompt` | Үндсэн загвар prompt | (стайл текст) |
| `size` | Зургийн хэмжээ | `1024x1536` |
| `quality` | `low`/`medium`/`high` | `medium` |
| `autoOnCreate` | Бараа үүсгэхэд автоматаар эхлүүлэх эсэх | `true` |
| `maxAttempts` | Автомат дахин оролдлого | `1` |

Админ тохиргоо (`/admin/settings`)-д «AI зураг» хэсэг нэмж, `basePrompt`-ыг засна.

---

## 12. Алдаа боловсруулалт ба зардал

- OpenAI алдаа (rate limit, invalid, timeout) → job `failed`, `error` бичнэ, UI-д
  улаан icon + мессеж. Дахин оролдох товч.
- **Timeout:** generate route-д боломжийн timeout (жишээ 60с). Хэтэрвэл `failed`.
- **Зардлын хамгаалалт:** зөвхөн staff; нэг бараанд зэрэг зөвхөн 1 job (davhardal
  хориглох); хэт олон дахин үүсгэлтэд анхааруулга/лог. Хэмжээ/чанар тохиргооноос.
- Түлхүүр/квот дууссан үед бараа хадгалагдах ёстой (зураг заавал биш).

---

## 13. Аюулгүй байдал

- `OPENAI_API_KEY` — зөвхөн сервер (`env.ts`, `NEXT_PUBLIC_` биш).
- Бүх route `getStaffUser()`-аар хамгаална; `product_image_generations` RLS staff-only.
- Клиентээс ирсэн prompt-ыг сервер талд дахин баталгаажуулна (уртын хязгаар,
  зөвшөөрөгдөх контент). OpenAI-гийн moderation-д баригдвал `failed`.

---

## 14. Клиентийн анхан шатны шаардлага (эх хэлбэр)

**Үндсэн шаардлага:**
- Reference болгож үнэртний зураг оруулна.
- Бусад бөглөсөн мэдээллийг бас reference болгож авна.
- Үндсэн prompt байна.

**Үндсэн урсгал:**
- Бараа хадгалах дээр дарахад product table хэсэг рүү шилжинэ.
- Table row бүр дээр барааны зураг харагдана.
- Зураг үүсэж байвал loader; fail бол мэдэгдэх зураг; done бол үүсгэсэн зураг —
  зураг байрлах хэсэгт ямар статустай байгааг мэдэж болно.
- Row дээрх зураг дээр дарахад popup: зургийг томоор харах, засаж болох текст
  талбар, «дахин үүсгэх» товч.

**AI provider:** OpenAI gpt-image-1 (ChatGPT image) API key — env-д дараа нэмнэ.

---

## 15. Хэрэгжүүлэлтийн фаз

1. **Env + helper** — `OPENAI_API_KEY`, `lib/ai/build-image-prompt.ts`,
   `lib/ai/generate-image.ts` (OpenAI gpt-image-1 дуудлага + sharp + upload). 🟢
2. **DB** — `0030_image_generation.sql` (job хүснэгт, enum, RLS, `settings.imageGen`). 🔵
3. **Форм + create** — формд горим toggle (①/②); AI горимд `is_active=false` +
   job enqueue; `generate-image` route (`after()`-аар эхлүүлэх). 🟢
4. **Табл UI** — «Зураг» багана, төлөв (loader/fail/done), polling. 🟢
5. **Popup** — томруулсан зураг + prompt засвар + дахин үүсгэх (`regenerate`) +
   **батлаж нийтлэх** (`approve`) + **түүх/сэргээх** (`revert`). 🟢
6. **Settings** — «AI зураг» хэсэг (basePrompt, size, quality). 🟢
7. **Тест** — prompt угсралт unit test; generate mock; алдаа/timeout; идемпотент.

---

## 16. Хүлээн авах шалгуур

- [ ] Форм дээр «Бэлэн зураг» / «AI үүсгэх» горим сонгоно; AI горимд лавлах зураг заавал.
- [ ] AI горимоор хадгалахад бараа **идэвхгүй** статустай ороод job үүсэж loader гарна.
- [ ] Үүсгэлт дуусахад мөрөнд зураг гарна; админ **батлаж** идэвхжүүлмэгц storefront-д гарна.
- [ ] Амжилтгүй болвол улаан icon + шалтгаан, дахин оролдох боломжтой.
- [ ] Зураг дээр дарж томоор харах, prompt засаж «дахин үүсгэх»-д шинэ зураг гарна.
- [ ] Хуучин `done` хувилбаруудыг харж, аль нэгийг **сэргээх** боломжтой.
- [ ] `OPENAI_API_KEY` байхгүй үед бараа ердийн журмаар хадгалагдана (зураггүй).
- [ ] Түлхүүр серверээс задрахгүй; route-ууд staff-only.
- [ ] `tsc` ✓ · `eslint` ✓ · `vitest` (prompt/helper тест) ✓ · `next build` ✓.

---

## 17. Клиентийн шийдвэрүүд (баталгаажсан)

1. **Эхлүүлэх арга:** `after()` / `waitUntil` (санал хэвээр). → §6.3.
2. **Хэмжээ/чанар:** `1024x1536` + `medium` зөв. → §4, §11.
3. **Форм 2 горимтой:** ① бэлэн зураг оруулах, ② AI үүсгэх. AI горимд лавлах зураг
   **заавал**. → §2.
4. **Нийтлэх:** AI зургийг **шууд нийтлэхгүй** — бараа жагсаалтад **идэвхгүй**
   статустай ороод админ **батлана**. Бэлэн зураг ашигласан бол шууд нийтэлж болно.
   → §5b, §9 («Батлаж нийтлэх»).
5. **Түүх:** хуучин үүсгэсэн хувилбаруудыг хадгалж, **буцаах (сэргээх)** боломжтой.
   → §5, §9, §7 (`revert-image`).
6. **Prompt хэл:** **англиар**. → §3.

