# Хугацаат хямдрал (арга хэмжээ) + админаас удирддаг Hero

> Төлөв: **v2 — хэрэгжүүлсэн** (PR1–3, §19), клиентээр батлуулах (§16)
> Огноо: 2026-11-13
> Feature flag: `sale_events` (арга хэмжээ, каталог, үнэ), `hero_admin` (hero засвар + AI зураг) — бие даасан, тус тусдаа нээгдэнэ
> Салбар: `feat/sale-events`, `feat/hero-admin` (dev-ээс)
> Эх сурвалж: клиентийн хүсэлт (hero-гийн «Өвлийн үнэртэн» товч цаг үеэрээ өөр ангилал руу очих, 11/23–11/30 Black Friday),
> 2026-11-13-ны хэлэлцүүлэг (AI hero зураг + батлах, текстийг админ бичих, дурын баярын хямдрал)
> Клиентийн заавар: «Тайлан11.11.pptx» слайд 2 — багц ба хямдралын дүрэм (§5.3, §16-Q3 **шийдэгдсэн**)
> Нэр томьёо: энд **«арга хэмжээ» (sale event)** гэдэг нь нэртэй, хугацаатай хямдрал/сонголт.
> Одоо байгаа **«Кампанит ажил»** (`campaigns`, 0135) бол бүртгэлийн купон — өөр зүйл, хольж болохгүй (§3.1).

---

## 0. Товч

Админ «Black Friday», «Цагаан сар», «Наадам», «Эрэгтэйчүүдийн баяр» гэх мэт
**арга хэмжээ** үүсгэнэ: нэр, slug, эхлэх/дуусах хугацаа, бараанууд, хэмжээ
бүрийн хямдралын хувь, badge-ийн бичиг. Хугацаа эхлэхэд үнэ буурч, каталогт
«Black Friday» шүүлтүүр гарч, нүүрний hero тэр рүү заана. Хугацаа дуусахад
бүгд **өөрөө** буцна — үнэ, chip, badge, hero. Юуг ч гараар цэвэрлэх
шаардлагагүй, хуучин хямдрал дарагдаж устахгүй.

Hero-гийн текст, товч, холбоосыг админ бичнэ. Hero зургийг одоо гараар
хийдэг шиг `gpt-image-2`-оор үүсгэж, админ хувилбаруудаас нүдээр шалгаж **нэгийг сонгоно** (барааны
зургийн одоогийн «үүсгэх → түүх → Ашиглах» урсгалтай ижил).

Шийдвэрийн гол цэг: хямдралын үнийг `product_variants.sale_price` дээр **бичихгүй**,
тусдаа хүснэгтээс **тооцоолно** (§3.2). Ингэснээр SQL-ийн `variant_price()`
нэг функц өөрчлөгдөхөд захиалга, каталог, хайлт, таг бүгд зэрэг зөв болно.
TS тал үнийг **дахин бодохгүй** — мөн л `variant_price`-ийг DB-ээс уншина (§5.2).

---

## 1. Клиентийн шаардлага

| # | Шаардлага | Хэрэгжүүлэлт |
|---|-----------|---------------|
| K1 | Hero-гийн дизайн тодорхой хугацаанд солигдоно | `heroes` хүснэгт, хуваарь, §7 |
| K2 | Hero-гийн товч өөр өөр ангилал руу очно (жишээ: Black Friday-д хямдарсан ус) | Товчны холбоосыг жагсаалтаас сонгоно: арга хэмжээ / улирал / каталогийн шүүлт / дотоод URL, §7.3 |
| K3 | Хямдрал хэсэгт бараа сонгож хямдруулаад «ямар жагсаалтад» оруулахаа сонгоно | Арга хэмжээний форм = бараа сонгох + хувь + жагсаалт нэг дор, §9.1 |
| K4 | Түр ангилал | Жинхэнэ ангилал **биш**, каталогийн шүүлтүүр (`?event=slug`) + богино хаяг `/sale/[slug]`, §6 |
| K5 | Hero зургийг AI-аар үүсгээд нүдээр батална | `hero_image_generations`, §8 |
| K6 | Hero-гийн текст, товчны бичгийг админ бичнэ | `heroes`-ийн текст талбарууд + урьдчилж харах, §7.4 |
| K7 | Black Friday, Цагаан сар, Наадам, Цэргийн баяр, Аавуудын баяр г.м. дурын хямдрал | Арга хэмжээ = ерөнхий нэгж, «өмнөхөөс хуулах», §9.3 |
| K8 | Дуусахад каталогийн шүүлтүүрийн товч алга болно | Chip зөвхөн идэвхтэй үед, дууссан холбоос → «дууссан» төлөв, §6.3 |

---

## 2. Одоогийн байдал (кодоос баталсан)

| Хэсэг | Байгаа зүйл | Файл |
|-------|-------------|------|
| Hero хуваарь | `HOME_CAMPAIGNS` — `startsOn/endsOn` (УБ огноо), текст, 2 товч, зураг. Кодод hardcode, солиход PR → deploy | `src/features/marketing/home-content.ts`, `components/home/campaign-hero.tsx`, `prompts/hero.md` |
| Hero LCP | `resolveStaticHero()` Suspense-гүй, preload-той (LCP) | `src/app/(shop)/page.tsx` |
| Popup дедуп | ~~Hero-гийн `primary.href`-тэй ижил popup слайдыг хасна~~ — 2026-11-д болиулсан: hero ба popup хоёр CTA-аар зэрэг гарна | `page.tsx` → `PromoSlot` |
| Хугацаат хямдрал | `sale_price` + `sale_starts_at/ends_at` хэмжээ бүрт, `apply_bulk_sale(product_ids, pcts, starts, ends)` | `0166_sale_period.sql`, `/admin/sales`, `sale-manager.tsx`, `/api/admin/sales` |
| Үнийн цорын ганц цэг (SQL) | `variant_price(v)` → `variant_sale_active(v)` | 0166; `place_order`, `catalog_search`, хайлт, багц бүгд үүнийг дууддаг |
| Үнийн толь (TS) | `isSaleActive`, `effectivePrice` | `src/features/products/sale.ts`; хэрэглэгч: `products/api.ts:153` (барааны хуудас), `admin/api.ts:675`, `sale-manager.tsx` |
| «Хямдрал» таг | Автомат, `refresh_sale_tag()` pg_cron минут тутам | 0103, 0166 |
| Каталог | `catalog_search(..., p_tags, p_featured, ...)` RPC, `unstable_cache` 60с + `CACHE_TAG_CATALOG`; санах ойн нөөц зам | 0115, `products/api.ts:505`, `features/catalog/parse.ts` |
| Badge | `product.tags.includes("sale")` → «Хямдрал» | `product-card.tsx:57` |
| Кэш | Хуудсууд `revalidate = 60`, админ бичилт `revalidatePublic()` | `src/lib/cache.ts` |
| AI зураг | `gpt-image-2` edits, job хүснэгт + `after()` + 4с polling, «Ашиглах» дарахад л хадгална, `maxDuration = 300` | `src/lib/ai/generate-image.ts`, `0098_collection_image_generations.sql`, `collection-image-generator.tsx` |
| Зураг боловсруулах | `sharp`, `processImage`, `uploadImage` (Supabase Storage) | `src/lib/storage/*` |
| Hero reference | `public/desktop.webp` (2.8:1 эх), `public/mobile.png` (4:3 эх) | `prompts/hero-desktop.md`, `hero-mobile.md` |
| Feature flag | `feature_flags` (0133), `FEATURE_FLAGS` (constants), 3 давхаргын шалгалт | `CLAUDE.md` |
| Сүүлийн migration | `0180_gift_cards_reminders_reports.sql` → шинэ нь **0181+** (merge-ийн үед дугаарыг дахин шалга) | |

### 2.1 Одоогийн загварын сул талууд (яагаад шинэ нэгж хэрэгтэй вэ)

1. **`apply_bulk_sale` хуучин хямдралыг дарна.** Black Friday-г урьдчилан
   (эхлэх огноо ирээдүйд) тавибал тэр бараан дээрх одоо явж буй хямдрал
   `sale_price`-тай хамт шууд солигдоно → 11/23 хүртэл бараа үндсэн үнэтэй
   болно, 11/30-ны дараа хуучин хямдрал **буцаж ирэхгүй**.
2. **Нэг хэмжээ нэг л хямдралтай.** Хоёр арга хэмжээ, эсвэл байнгын хямдрал + арга хэмжээ зэрэг байж болохгүй.
3. **«Хямдрал» нэг л жагсаалт.** `?tags=sale` нь бүх хямдралыг холино — «Black Friday» гэсэн тусдаа жагсаалт, badge байхгүй.
4. **Hero кодод.** Текст/холбоо/зураг солих бүрт хөгжүүлэгч + deploy.
5. **Hero огноогоор (date), хямдрал цагаар (timestamptz).** Хоёр тусдаа эх сурвалж — нэг мөчид асна гэсэн баталгаа байхгүй.
6. **Үнэ хоёр газар бодогддог (аудитаар илэрсэн).** SQL: `variant_price()` (каталог, хайлт, `place_order`).
   TS: `mapProduct()` (`products/api.ts:116`) — барааны хуудас, нүүрний rail, **багцын гишүүний үнэ**.
   Багцын үнийг сервер TS-ээр бодож (`priceCollectionLines`: `checkout/api.ts`, `/api/collections/quote`)
   `place_order` тэр `unit_price`-ийг хүлээн авдаг (0149:632). Тиймээс TS талын үнэ **мөнгөний зам** —
   SQL-ээс зөрвөл багц буруу үнээр зарагдана.
7. **Хямдрал багцад дамждаг.** `memberPrices()` нь гишүүний **хямдарсан** үнийг нийлүүлээд дээр нь багцын
   хувийг хасдаг (backlog B5) — бэлэн ба угсарсан багц хоёуланд. Клиентийн шинэ дүрмээр (Тайлан11.11.pptx
   слайд 2) бэлэн багцад энэ нь **буруу**, угсарсан багцад зөв (§5.3).

---

## 3. Шийдвэрүүд

### 3.1 Нэршил

- DB: `sale_events`, `sale_event_products`, `sale_event_discounts`, `heroes`, `hero_image_generations`.
- URL: `/sale/[slug]`, каталог `?event=slug`.
- Админ: «Хямдрал» хуудас дотор **«Арга хэмжээ»** таб (шинэ) + «Бараагаар» таб (одоогийнх).
  Hero: «Контент → Нүүрний hero».
- `campaigns` / «Кампанит ажил» нэрийг **ашиглахгүй** — тэр нь бүртгэлийн купон (0135), `campaigns` туг өөр.

### 3.2 Үнийн загвар — 3 хувилбар

| | A. Одоогийн `apply_bulk_sale`-ыг ашиглах | B. **Тусдаа хүснэгтээс тооцох (сонгосон)** | C. Cron-оор `sale_price`-д бичиж, дуусахад сэргээх |
|---|---|---|---|
| Хуучин хямдрал | Дарагдаж устана | Хөндөгдөхгүй | Snapshot хадгалж сэргээнэ |
| Давхар хямдрал | Боломжгүй | `least()` — хамгийн хямд нь | Боломжгүй |
| Өөрчлөх газар | Байхгүй | `variant_price`, `variant_sale_active` (SQL нэг цэг); TS нь түүнийг computed column-оор уншина (§5.2) | Cron, snapshot, засварын түгжээ |
| Эрсдэл | Өгөгдөл алдах | `variant_price` удаашрах (хэмжинэ, §5.1) | Cron алдвал буруу үнэ хоногоор үлдэнэ; дундуур засвар дарагдана |
| Цаг | — | Тооцоолол тул яг мөчид (кэш ≤2 мин) | Cron ≤1 мин + кэш |

**B-г сонгосон.** Үнэ нь хадгалсан утга биш, `now()`-оос хамаарсан тооцоолол тул
«сэргээх» гэх ойлголт огт байхгүй (Shopify хэрэглэгчдийн хамгийн их
гомдоллодог асуудал — сэргээлт алдагдах — энд гарах боломжгүй).

### 3.3 Хувиар хадгална, үнээр биш

Арга хэмжээ нь **хэмжээ бүрийн хувь** хадгална (`2ml → 10%`, `5ml → 15%` — одоогийн
bulk UI-тай ижил). Үнийг уншиж байх үед бодно:
`round(price * (100 - pct) / 100 / 100) * 100`, `least(price, …)` — 0166-ийн дүрэм.
Арга хэмжээний дундуур админ үндсэн үнийг өөрчилбөл хямдрал зөв дагана.

### 3.4 Давхцал

- Ижил бараа давхцсан хугацаатай хоёр **идэвхтэй** арга хэмжээнд орохыг хориглоно
  (trigger + advisory lock — 0135-ийн `campaigns_no_overlap`-ийн загвар).
  Админд «Энэ 4 бараа "Black Friday"-д (11/23–11/30) аль хэдийн байна» гэж нэрээр нь харуулна.
- Байнгын/гар хямдрал (`sale_price`) + арга хэмжээ зэрэг байвал **хамгийн хямд үнэ**
  — клиент баталсан (§16-Q1). Хувь нь **үндсэн үнээс**, хоёр хямдрал хоорондоо нэмэгдэхгүй. Хэрэглэгчийн үнэ арга хэмжээний үеэр хэзээ ч өсөхгүй.

### 3.5 Ангилал биш, шүүлтүүр

Baymard: хямдралыг жинхэнэ ангилал болговол хэрэглэгч түүнийг бүх каталог гэж
андуурч тусгаарлагдана. Иймд арга хэмжээ = **каталог дээрх арилгаж болдог
шүүлтүүр**, нүүр/цэс/hero-оос шууд хүрнэ (§6).

### 3.6 Hero нь арга хэмжээнээс тусдаа

Улирлын hero (одоогийн «Өвлийн тансаг үнэртнүүд») хямдралгүй. Тиймээс `heroes`
бие даасан хүснэгт; арга хэмжээтэй **холбож** болно (`sale_event_id`) — тэгвэл
hero-гийн хугацаа арга хэмжээнийхээс уншигдаж, арга хэмжээ цуцлагдвал hero ч
автоматаар унтарна (§7.2).

---

## 4. Өгөгдлийн загвар (migration 0181+, expand only)

### 4.1 `sale_events`

| Багана | Төрөл | Тайлбар |
|--------|-------|---------|
| `id` | uuid pk | |
| `slug` | text unique | `^[a-z0-9-]{2,60}$`, `/sale/[slug]`, `?event=` |
| `name` | text 1–60 | Каталогийн chip, админ («Black Friday») |
| `badge_label` | text 1–24 null | Картан дээр («Black Friday −20%»-ийн «Black Friday»). null → «Хямдрал» |
| `headline` | text ≤80 null | Каталогийн дээрх зурвасын гарчиг |
| `description` | text ≤200 null | Зурвасын тайлбар |
| `starts_at`, `ends_at` | timestamptz not null | УБ өдрийн хил (`dayStartIso`/`dayEndIso`), `ends_at > starts_at` |
| `is_active` | boolean default false | Ноорог / нийтэлсэн. Нийтлээгүй бол хугацаа ирсэн ч юу ч өөрчлөгдөхгүй |
| `show_countdown` | boolean default true | «Дуусахад 2 өдөр» |
| `created_by`, `created_at`, `updated_at` | | `set_updated_at` trigger |

Төлөв (тооцоолол, багана биш): `draft` (is_active=false) · `scheduled` · `live` · `ended`.

### 4.2 `sale_event_products`

`(event_id, product_id)` pk, `sort_order int`. Каталогийн шүүлтүүр, badge-ийн гишүүнчлэл.
Хямдралгүй «сонголт» арга хэмжээ (жишээ: «Аавуудад бэлэг») = гишүүнтэй, хувьгүй.

### 4.3 `sale_event_discounts`

`(event_id, product_id, ml)` pk, `pct smallint check (pct between 1 and 90)`, `ml` нь `ML_SIZES`-ийн check-тэй ижил;
`(event_id, product_id)` → `sale_event_products` fk (on delete cascade).
**Бараа × хэмжээ бүрт өөр хувь** (клиент, 2026-11-13): нэг арга хэмжээнд зарим ус −20%, зарим нь −30%, хэмжээ бүрт өөр байж болно.
Одоогийн «Хямдрал» хуудасны зантай ижил — тэнд ч бараагаа сонгоод хэмжээ бүрт хувь өгч, өөр бүлэгт дахин өөр хувь өгдөг (`apply_bulk_sale`).
Мөргүй хэмжээ = тэр хэмжээнд хямдралгүй.

### 4.4 Давхцал — `sale_event_products_no_overlap()` trigger

`sale_event_products` insert, `sale_events` update (`starts_at`, `ends_at`, `is_active`)
дээр: тэр бараа өөр идэвхтэй, хугацаа давхцсан арга хэмжээнд байвал
`raise exception 'EVENT_OVERLAP'` + бараануудын жагсаалт `detail`-д.
`pg_advisory_xact_lock(hashtext('sale_events'))` — хоёр админ зэрэг хадгалах.

### 4.5 `heroes`

| Багана | Тайлбар |
|--------|---------|
| `id`, `name` (дотоод) | |
| `sale_event_id` uuid null → `sale_events` on delete set null | Холбоотой бол хугацааг тэндээс авна |
| `starts_at`, `ends_at` timestamptz null | Холбоогүй үед заавал |
| `priority` int default 0 | Хоёр hero зэрэг идэвхтэй бол их нь |
| `is_active` boolean default false | |
| `eyebrow` ≤40, `title` ≤48, `description` ≤140, `mobile_description` ≤70 | Тэмдэгтийн хязгаар DB check + Zod |
| `primary_label` ≤22, `primary_target` jsonb | `{type:'event',slug}` · `{type:'season',value}` · `{type:'catalog',query}` · `{type:'path',href}` |
| `secondary_label` ≤22 null, `secondary_target` jsonb null | |
| `desktop_image` jsonb | `{base, widths:[1600,2400,3200], height1600}` — storage URL-ууд |
| `mobile_image` jsonb | `{src, width, height}` |
| `image_alt` text, `dark` boolean | `dark` = бараан хана → цагаан текст |

`path` нь зөвхөн `/`-ээр эхэлсэн дотоод хаяг (гадагш redirect, phishing-ээс сэргийлнэ).

### 4.6 `hero_image_generations`

`collection_image_generations` (0098)-ийн ихэр: `id, hero_id null, target ('desktop'|'mobile'),
theme_key, theme_extra, prompt, reference_urls text[], status image_gen_status_t,
result_url, error, attempts, created_by, created_at, updated_at`. RLS: зөвхөн staff.

### 4.7 RLS ба эрх

- `sale_events`, `sale_event_products`, `sale_event_discounts`, `heroes`, `hero_image_generations`:
  RLS **зөвхөн staff** (`is_staff()`), нийтэд шууд уншигдахгүй. Бичих нь service-role.
  *(v1-д «is_active мөрийг нийтэд нээх» гэж байсан нь алдаа: нийтэлсэн боловч эхлээгүй
  арга хэмжээний хувь, hero-гийн текст PostgREST-ээр урьдчилж уншигдах байсан.)*
- Дэлгүүр зөвхөн **security definer** функцээр уншина — тэд зөвхөн хэрэгтэй талбарыг, зөвхөн зөв үед буцаана:
  - `event_pct(product_variants)` — үнэ (§5.1).
  - `live_sale_events()` → `slug, name, badge_label, headline, description, ends_at, show_countdown, product_ids uuid[]` (зөвхөн live).
  - `sale_event_public(p_slug)` → `slug, name, state ('scheduled'|'live'|'ended'), starts_at, ends_at` — хувь, барааны жагсаалт **байхгүй** (тизер, «дууссан» төлөв).
  - `sale_event_product_ids(p_slug)` → live үед гишүүд (`catalog_search`-ийн шүүлтэд; тэр нь `language sql`, invoker тул шууд хүснэгт уншиж чадахгүй).
  - `live_hero()` → одоо гарах ёстой нэг hero.
- Бүгдэд `set search_path = public`, `revoke all … from public` → `grant execute … to anon, authenticated, service_role`.

### 4.8 Feature flag

```sql
insert into feature_flags (key) values ('sale_events'), ('hero_admin') on conflict do nothing;
```

---

## 5. Үнэ ба таг

### 5.1 SQL

```text
event_pct(v product_variants) returns smallint   -- stable, SECURITY DEFINER (RLS staff-only, §4.7)
  = max(d.pct) from sale_event_products p
      join sale_events e on e.id = p.event_id
      join sale_event_discounts d on d.event_id = e.id and d.product_id = p.product_id and d.ml = v.ml
    where p.product_id = v.product_id
      and e.is_active and e.starts_at <= now() and now() < e.ends_at
      and feature_enabled('sale_events')

event_price(v) = case when pct is null then null
                      else least(v.price, round(v.price*(100-pct)/100/100)*100) end

variant_sale_active(v) = (одоогийн гар хямдрал идэвхтэй)  OR  event_price(v) < v.price
variant_price(v)       = least(v.price,
                               гар хямдрал идэвхтэй бол sale_price,
                               event_price(v))
```

- `variant_price` / `variant_sale_active`-ийн **гарын үсэг өөрчлөгдөхгүй**, зөвхөн бие —
  захиалгын бүх RPC (`place_order`, extras, builder 0168), `catalog_items` view, хайлт,
  `sale_product_ids()` (таг) засваргүйгээр дагана.
- Туг хаалттай үед `event_pct` null → prod-д ямар ч нөлөөгүй.
- `ends_at` нь **exclusive** хил (`dayEndIso` = дараа өдрийн 00:00 — `isoEndToDay`-ийн тайлбар) → `now() < ends_at`.
- Индекс: `sale_event_products (product_id)`, `sale_events (starts_at, ends_at) where is_active`.
- **Гүйцэтгэл:** `catalog_search` нь `catalog_items` view (0125, materialized биш)-ээр дамжиж **бүх**
  хэмжээнд `variant_price` дууддаг; security definer функц inline болдоггүй. Migration-ий өмнө/дараа
  dev дээр `explain analyze` (бүх каталог, 12 мөрийн хуудас, хайлт). Удаашрал >20% бол:
  `event_pct`-ийн оронд `catalog_items` дотор live арга хэмжээний жижиг CTE-тэй нэг join.
- **Таг шууд шинэчлэгдэх:** `sale_events`, `sale_event_products`, `sale_event_discounts` дээр
  statement trigger → `refresh_sale_tag()` (0166-ийн `product_variants_refresh_sale_tag`-ийн загвар).
  Эхлэх/дуусах мөчийг pg_cron минут тутам аль хэдийн барьдаг.

### 5.2 TS тал үнийг бодохгүй — DB-ээс уншина (v1-ийн «TS толь»-ийг сольсон)

v1 төлөвлөгөө TS-д арга хэмжээний map уншиж `isSaleActive`-д хувийг давтан бодохоор байсан.
Аудитаар `mapProduct()` нь **мөнгөний зам** (багц, §2.1-6) болох нь илэрсэн тул давхар тооцоолол эрсдэлтэй.

**Шийдэл: PostgREST computed column.** `variant_price(product_variants)` нь мөрийн төрөл авдаг
функц тул select-д багана мэт бичиж болно:

```text
product_variants ( id, ml, price, sale_price, sale_starts_at, sale_ends_at, is_active,
                   variant_price )          ← шинэ: SQL-ийн бодсон бодит үнэ
```

| Газар | Өөрчлөлт |
|-------|----------|
| `products/api.ts` `SELECT` (:110) + `DbVariant` | `variant_price` нэмнэ |
| `mapProduct` (:153–160) | `price = v.variant_price ?? effectivePrice(v)`; `basePrice = v.price`. Нөөц (`??`) нь demo/seed горим ба хуучин тестийн fixture-д |
| `admin/api.ts` (:604, :675) | Мөн адил; админд эх сурвалжийг («Black Friday −20%») харуулахад `live_sale_events()`-ийн map |
| `features/products/sale.ts` | **Өөрчлөхгүй** — зөвхөн гар хямдралын толь хэвээр (админы `sale-manager`-ийн төлөв, нөөц зам) |
| `collections/api.ts`, builder (0168) | Өөрчлөлтгүй — `mapProduct` / `variant_price`-аар дамжина |

- **PR1-ийн эхний алхам (30 мин):** dev сан дээр embedded select-д `variant_price` ажиллаж байгааг
  нэг query-гээр батал (anon эрхээр — `catalog_items` нь security_invoker тул anon аль хэдийн execute эрхтэй).
  Ажиллахгүй бол нөөц: `variants_for_products` (0064) RPC-д үнийг нэмж `mapProduct`-д дамжуулах.
- `src/db/types.ts` computed column-ыг `Row`-д гаргахгүй (`pnpm db:types` зөвхөн local) — `DbVariant` гар төрөлд нэмнэ.
- Badge, chip, зурвас зэрэг **харагдац** нь `live_sale_events()` (`unstable_cache` 60с, `CACHE_TAG_CATALOG`)-ээс — мөнгөнд нөлөөгүй.

**Тест:** үнэ нэг эх сурвалжтай болсон тул SQL/TS parity тест хэрэггүй; оронд нь
`mapProduct` `variant_price`-ийг дагаж байгааг ба багцын quote ↔ `place_order` дүн таарахыг шалгана (§13).

### 5.3 Захиалга, багц, купон, оноо

- Дан ус: `place_order` `variant_price`-аар үнэлнэ. Сагсанд хуучин үнэ үлдсэн бол сервер **чимээгүй
  солихгүй** — `TOTAL_CHANGED` (0149:672) буцааж, checkout шинэ дүнг харуулна (одоогийн зан).
  Арга хэмжээ дуусах мөчид checkout дээр байсан хэрэглэгч яг үүнийг харна → гар туршилтад орсон (§13.3).
- **Багц — клиентийн дүрэм (Тайлан11.11.pptx, слайд 2):**

  | Багц | Дүрэм | Одоогийн код | Хийх |
  |------|-------|--------------|------|
  | **Бэлэн багц** | «Өөрөө нэг бүтээгдэхүүн, үнэ тогтмол». Гишүүний **үндсэн** үнийн нийлбэр − багцын хувь. Барааны хямдрал (гар, арга хэмжээ) **нөлөөлөхгүй**. Зөвхөн гишүүний үндсэн үнэ эсвэл багцын хувь өөрчлөгдөхөд л өөрчлөгдөнө | `memberPrices()` (`collections/api.ts:160`) гишүүний **хямдарсан** үнийг нийлүүлдэг → дүрэмтэй **зөрж байна** | Бэлэн багцад `basePrice`-аар бодох |
  | **Хэрэглэгчийн угсарсан багц** (бэлэн багцтай яг ижил ус байсан ч) | Хямдарсан үнийн нийлбэрээс **дахин** багцын хувь хасна (давхарлана) | Ийм ажилладаг (builder 0168, `variant_price`) | Өөрчлөхгүй |

  «Үнэ нь ялгаатай харагдсан ч хамаагүй» — Black Friday-д ижил найрлагатай угсарсан багц бэлэн багцаас хямд гарч болно, энэ нь зөвшөөрөгдсөн.

  > **⚠ 2026-11-17 — угсарсан багцын мөр ЦУЦЛАГДСАН (task 8.2, клиентийн шийдвэр; B5 «давхарлах» дүрэм хүчингүй).**
  > Хэрэглэгчийн угсарсан багц ч бэлэн багцын адил гишүүдийн **үндсэн** үнийн нийлбэрээс багцын хувийг хасна;
  > угсрагч зөвхөн үндсэн үнийг харуулна, барааны хямдрал багцад дамжихгүй. Код: `memberUnitPrice()`
  > (`src/features/collections/pricing.ts`), `priceCollectionLines` (fix/pricing-checkout).
- **Хийх засвар (PR1-д, арга хэмжээнээс хамааралгүй — гар хямдралд ч одоо буруу):**
  `memberPrices()`-д `priceOf: 'effective' | 'base'` сонголт; бэлэн багц (`type = 'base'`) → `base`.
  Серверийн тал (`priceCollectionLines`: `checkout/api.ts`, `/api/collections/quote`) ижил дүрмээр — эс бөгөөс
  харагдах үнэ ба `place_order`-д очих `unit_price` зөрнө. `place_order` (0149:632–635) багцын мөрөнд
  `v_list = greatest(variant_price, unit_price)` гэж авдаг: бэлэн багцын `unit_price` хямдарсан үнээс **их** болох
  тохиолдлыг (base−5% > sale) dev дээр шалгана — `v_gross`/тайлангийн «хямдрал»-ын дүнд сөрөг нөлөөгүй байх ёстой.
  Тогтмол үнэтэй (`fixedPrices`) хэмжээнд нөлөөгүй. Тайлангийн шинэчлэлийн ажилтай (pptx) давхцах тул нэг газар хийнэ.
- Купон, V point-ийн дүрэм **өөрчлөгдөхгүй**: купон хямдарсан үнэ дээр хэрэглэгдэнэ (клиент баталсан, §16-Q2).
- Бэлэг (1ml), азын хүрдний шагнал, нэмэлт бараа (`extra_variants`) — арга хэмжээнд **хамаарахгүй** (өөр үнийн зам).
- Тайлан: `order_items`-ийн үндсэн үнэ (0097) хадгалагддаг тул хямдралын дүн одоогийн тайланд орно.
  «Black Friday-ийн борлуулалт» тусдаа тайлан → §17.

---

## 6. Дэлгүүр

### 6.1 Каталогийн шүүлтүүр `?event=slug`

- `parse.ts`: `event` (нэг slug, `^[a-z0-9-]+$`). Багц (`kind=bundle`) үед хоосолно. `use-filter-query.tsx`-ийн түлхүүрийн жагсаалтад нэмнэ.
- `catalog_search`-д `p_event text default null` → `c.id in (select sale_event_product_ids(p_event))`.
  **Анхаар:** шинэ параметртэй `create or replace` нь Postgres-д **шинэ overload** үүсгэж,
  нэрлэсэн параметрээр дуудахад «function is not unique» болно. Нэг migration дотор
  хуучин гарын үсгийг `drop function` хийж шинийг үүсгэ (default-тай тул хуучин код ажилласаар), grant-уудыг дахин өг.
- `getCatalog`-ийн санах ойн нөөц зам ч `event`-ийг шүүнэ (`live_sale_events()`-ийн `product_ids`).
- Шүүлтүүрийн «Таг» бүлэгт **live** арга хэмжээ бүр chip (`Онцлох`, `Шинэ`, …-тай зэрэгцэн).
  Сонгогдсон үед идэвхтэй шүүлтүүрийн мөрөнд «Black Friday ×» — нэг дарж бүх каталог руу.
  Chip-д `transition-colors` **хэрэглэхгүй**, сонгогдсон нь `bg-cta` (CLAUDE.md-ийн дүрэм).
- Каталогийн дээд талд зурвас: `headline`, `description`, «Дуусахад 3 өдөр 4 цаг» (`show_countdown`).
  Тоолуур client талд (`ends_at`-аас), hydration зөрөхгүйн тулд mount-ийн дараа гарна.
- Canonical: одоогийн дүрэм хэвээр — шүүлттэй каталог бүр `/catalog` руу (`catalogCanonical`). Тусгай SEO логик нэмэхгүй.

### 6.2 Богино хаяг `/sale/[slug]` (хялбарчилсан)

Тусдаа хуудас **биш**, зөвхөн `/catalog?event=slug` руу redirect (сошиал пост, сторид өгөх цэвэр хаяг).
Бүх төлөвийг каталог өөрөө `sale_event_public(slug)`-аар харуулна — нэг газар, нэг UI:

| Төлөв | `/catalog?event=slug` дээр |
|-------|----------------------------|
| `live` | Шүүгдсэн жагсаалт + зурвас + тоолуур |
| `scheduled` | Зурвас «11/23-нд эхэлнэ» (хувь, жагсаалт **байхгүй**), доор нь бүх каталог |
| `ended` / олдохгүй | Зурвас «Энэ урамшуулал дууссан» + одоо live арга хэмжээнүүдийн холбоос, доор нь бүх каталог. 404 биш |

*(v1-д `/sale/[slug]` нь тусдаа тизер хуудастай, canonical-ийг тийш заасан байсан — canonical нь
redirect хийдэг хаяг руу заах тул буруу, мөн `catalogCanonical`-ийн дүрэмтэй зөрчилдөж байв. SEO-гийн
«жил бүр нэг хаяг» давуу тал нь slug-ийг (`black-friday`) жил бүр **дахин ашиглахад** хадгалагдана.)*

Slug дахин ашиглах: дууссан арга хэмжээний slug-ийг шинэд өгөхийн тулд unique нь
`(slug) where ends_at > now()` биш (now() индекст болохгүй) — «Хуулах» үед хуучны slug-ийг `black-friday-2026` болгож архивлана.

### 6.3 Дууссаны дараа юу болох вэ (K8)

| Зүйл | Хэзээ, яаж |
|------|-----------|
| Үнэ | `now() >= ends_at` мөчөөс SQL тооцоолол үндсэн үнэ буцаана. Хуудасны кэш ≤60–120с |
| Каталогийн chip | `live_sale_events()` кэш ≤60с → алга |
| `?event=black-friday`, `/sale/black-friday` хуучин холбоос | Хоосон жагсаалт биш, «Энэ урамшуулал дууссан» зурвас + бүх каталог (§6.2) |
| Badge | `refresh_sale_tag` ≤1 мин + кэш |
| Hero | Дараагийн hero эсвэл кодын fallback (§7.2) |
| Төлбөр | DB-ээр бодогдох тул яг тэр секундээс зөв |

### 6.4 Badge ба нүүр хуудас

- `product-card.tsx:57`: бараа live арга хэмжээнд байвал `badge_label` (жишээ «Black Friday»),
  эс бөгөөс одоогийн «Хямдрал». `live_sale_events()`-ийн `product_ids`-аас — `catalog_search`-ийн буцаах
  баганыг өөрчлөхгүй. Нүүрний rail, хайлтын карт ижил компонент тул автоматаар.
- Нүүрний «Хямдралтай үнэртнүүд» хэсэг (`home_sections` kind=`tag`, tag=`sale`) арга хэмжээний
  барааг **өөрөө** авна (таг автомат). Тусдаа «Black Friday» rail хэрэгтэй бол → §17.
- Footer-ийн «Хямдрал» (`/catalog?tags=sale`) хэвээр.

---

## 7. Hero

### 7.1 Нүүр хуудасны дараалал

```
hero_admin нээлттэй →  DB-ийн идэвхтэй hero (priority desc, starts_at desc)
                     →  HOME_CAMPAIGNS (кодын, одоогийнх)  →  EVERGREEN_HERO
hero_admin хаалттай →  одоогийнх шиг (HOME_CAMPAIGNS → EVERGREEN_HERO)
```

Кодын `HOME_CAMPAIGNS`, `EVERGREEN_HERO` нь **нөөц** болж үлдэнэ — DB хоосон/алдаатай үед,
мөн demo горимд (`isSupabaseConfigured` false — CI-ийн e2e) hero хэзээ ч хоосрохгүй.
DB-ээс `live_hero()` RPC-ээр (§4.7) уншина; идэвхтэй эсэхийг (§7.2) SQL шийднэ.

### 7.2 Идэвхтэй эсэх

- Холбоотой hero: `sale_events.is_active` ба хугацаа нь live үед л.
- Холбоогүй: өөрийн `starts_at/ends_at`.
- Зураггүй (desktop эсвэл mobile дутуу) hero идэвхтэй болж чадахгүй (DB check + UI).
- Холбоос нь `event` бөгөөд тэр арга хэмжээ live биш бол hero алгасагдана (эвдэрсэн товчтой hero гарахгүй).
- `PromoSlot`-ийн дедуп `liveCampaigns()`-ийн оронд шийдэгдсэн hero-гийн холбоосыг ашиглана.

### 7.3 Товчны холбоос сонгогч

`primary_target` / `secondary_target`:

| Төрөл | Үр дүн | Жишээ |
|-------|--------|-------|
| Арга хэмжээ | `/sale/[slug]` | Black Friday |
| Улирал | `/catalog?kind=perfume&season=winter` | Өвлийн үнэртэн |
| Каталогийн шүүлт | `/catalog?<query>` | `tags=new`, `gender=male` |
| Дотоод хуудас | `/collections/build`, `/gift-cards` | |

Хадгалахдаа холбоосыг серверт шалгана (арга хэмжээ байгаа эсэх, `path` дотоод эсэх).

### 7.4 Текст ба урьдчилж харах (K6)

- Талбарууд: жижиг гарчиг, гарчиг, тайлбар, утасны богино тайлбар, 2 товчны бичиг.
- Тэмдэгт тоологч, хязгаар (§4.5). Гарчиг desktop-д 2 мөрөөс хэтэрвэл анхааруулга.
- **Урьдчилж харах:** жинхэнэ `CampaignHero` компонентыг 3 өргөнд (390 / 768 / 1440)
  зэрэгцүүлж — админ яг дэлгүүрт гарах байдлаар харна. `dark` toggle.
- `dark`-ийн санал: зургийн зүүн 0–55% бүсийн дундаж гэрэлтэлтээр (`note-image.ts`-ийн `borderLuma` загвар).

### 7.5 LCP

Одоо hero нь Suspense-гүй, статик тул LCP хурдан. DB-ийн hero нь `unstable_cache`-тай
(tag `CACHE_TAG_CATALOG`, 60с) нэг жижиг query → `HomePage`-ийг async болгож Suspense-гүй
render хийнэ, preload хэвээр. Lighthouse/Web Vitals-ыг өмнө/дараа нь харьцуул (`docs/planning/hero-3d-performance.md`).

### 7.6 Зургийн хэмжээ (одоогийн дүрэм хэвээр)

- Desktop: эх 3584×1280 (2.8:1) → 1600/2400/3200 webp q80, өөрийн srcSet (Next optimizer алгасна).
- Mobile: эх 2048×1536 (4:3) → 1600 webp q85, Next optimizer.
- Файлын нэр давтагдашгүй (`hero/<heroId>/<genId>-<w>.webp`) — CDN/Safari кэш (prompts/hero.md §4).

---

## 8. AI hero зураг (K5)

### 8.1 Урсгал

```
① Сэдэв сонгох:  [Black Friday] [Цагаан сар] [Наадам] [Шинэ жил] [Эрэгтэйчүүдийн баяр]
                  [Эмэгтэйчүүдийн баяр] [Хавар] [Зун] [Намар] [Өвөл] [Өөрөө бичих]
   + нэмэлт тайлбар (заавал биш)
② «Desktop үүсгэх» → 1 job (≈1–2 мин) — дахин дарж 2–4 хувилбар
③ Хувилбар бүр safe-zone давхаргатай (зүүн 55% тасархай шугам) + 3 өргөний урьдчилж харах
④ «Энэийг сонгох» → «Mobile үүсгэх» (сонгосон desktop-ыг reference болгоно)
⑤ «Энэ зургийг ашиглах» → sharp: хэмжээнүүд → storage → hero-гийн зураг солигдоно (hero хадгалагдахад л дэлгүүрт)
   ↳ «Өөрийн зураг оруулах» — дизайнерын PNG/WebP, харьцаа ±2%, desktop ≥2400px өргөн
```

### 8.2 Prompt

- Суурь: `prompts/hero-desktop.md` / `hero-mobile.md`-ийн **бүсийн дүрэм, барааны тайлбар хувиршгүй**
  (`HERO_DESKTOP_BASE`, `HERO_MOBILE_BASE` const — `src/lib/ai/hero-prompt.ts`).
- Сэдэв бүрт урьдчилж бичсэн англи хэсэг (`HERO_THEMES`): гэрэл, өнгө, 55–95%-д нэмэх чимэглэл, **хориглох** зүйлс.
  Жишээ: Цагаан сар — цэнхэр хадаг, мөнгөн аяга, ул боов **биш**, цагаан/мөнгөлөг; Наадам — хийморийн туг… (дизайнтай тохирох эсэхийг dev дээр туршиж тогтооно).
- «Өөрөө бичих» → админы текст prompt-д `Theme details:` гэж нэмэгдэнэ. Монгол текстийг загвар
  ойлгодог ч тогтвортой биш — dev дээр туршиж, шаардлагатай бол OpenAI текст загвараар англи руу хөрвүүлэх (v2).
- Model `gpt-image-2.6-sunburst` (hero-д л — 2026-11-13 клиент сонгосон; барааны зураг `gpt-image-2` хэвээр), edits, quality high, PNG. `input_fidelity` илгээхгүй — gpt-image-2 татгалздаг.
  Reference: `public/desktop.webp` (+ барааны цэвэр зургууд, prompts/hero.md §2), mobile-д `public/mobile.png` + сонгосон desktop.
- Reference файлууд serverless функцэд хүрэхүйц байх: storage-д нэг удаа байршуулж (`hero/reference/`) URL-аар уншина.
- **`src/lib/ai/generate-image.ts`-д хийх өөрчлөлт (аудитаар):** одоогийн `generateProductImage` нь
  (а) `ImageSize` хаалттай 5 утга — `3584x1280`, `2048x1536` байхгүй; (б) үр дүнг шууд `webp q82` болгодог —
  hero-д lossless мастер хэрэгтэй; (в) `input_fidelity` **илгээдэггүй** (prompts/hero.md-д шаарддаг).
  → шинэ `generateHeroImage()` (нийтлэг `callOpenAi`-г ашиглана): custom хэмжээ, `input_fidelity=high`, PNG буцаана.
- **Storage:** `processImage`-ийн preset-үүд `maxEdge ≤ 1600` (`marketing` → `photo`) тул hero **дамжихгүй** —
  өөрийн sharp алхам: мастер PNG → `hero/<id>/<gen>-{1600,2400,3200}.webp` (q80) + mobile 1600 (q85). `uploadImage` хэвээр (1 жилийн cache, давтагдашгүй зам).

### 8.3 Хязгаар, зардал

- `maxDuration = 300`, `after()` — одоогийн загвар. 3584×1280 high нь хугацаа их — dev дээр хэмжиж, хэтэрвэл 2688×960 (prompts/hero.md-д заасан).
- Нэг hero-д зэрэг 2 job, өдөрт 30 job (constants) — санамсаргүй зардал.
- Зардлыг OpenAI dashboard-аас dev туршилтаар хэмжиж клиентэд мэдэгдэнэ.

### 8.4 Эрсдэл

- Шошгоны жижиг бичиг гажих — батлах алхам заавал, «Өөрийн зураг оруулах» нөөц.
- Соёлын нарийн зүйлсийг буруу зурах (Цагаан сар, Наадам) — сэдвийн prompt-ыг dev дээр 3–5 удаа туршиж тохируулна.

---

## 9. Админ UX

> **Солигдсон (2026-11-13):** энэ хэсгийн drawer маягтуудыг `docs/campaigns/studio-ux.md`
> («Арга хэмжээний студи» — нэг бүтэн хуудас, 5 алхам, текстийг харагдац дээр нь засах) сольж байна.
> Доорх нь одоо кодонд байгаа хуучин хувилбарын тайлбар.

### 9.1 «Арга хэмжээ» хуудас — `/admin/sale-events` (K3)

Sidebar-т «Хямдрал»-ын доор тусдаа цэс (`flag: "sale_events"`). *(v1-д `/admin/sales` доторх таб байсан —
тэр хуудас `sale_page` тугийн ард тул хоёр туг уялдаатай болох байв; тусдаа route нь бие даан нээгдэнэ.)*
Барааны сонгогч компонентыг `sale-manager.tsx`-ээс салгаж хоёуланд ашиглана.

Жагсаалт: нэр · төлөв chip (Ноорог / Товлосон / Явж байна / Дууссан) · хугацаа · бараа тоо · хувиуд · hero-тэй эсэх.

Үүсгэх/засах форм (drawer, 3 алхам):

1. **Үндсэн:** нэр → slug автоматаар (засаж болно), хугацаа (УБ өдөр, хуанли), badge-ийн бичиг, каталогийн гарчиг/тайлбар, тоолуур.
2. **Бараа + хувь:** одоогийн `sale-manager`-ийн урсгалтай ижил — бараагаа сонгоод (хайлт, хүйс, брэнд, «бүгдийг сонгох») хэмжээ бүрт хувь өгч «Хэрэглэх»; өөр бүлэг сонгоод өөр хувь өгч давтана. Хүснэгтэд бараа бүрийн хэмжээ тус бүрийн хувь, шинэ үнэ харагдана («Layton 5ml: 45,000 → 36,000 (−20%)»), мөр дээр шууд засаж болно.
   жишээ үнэ («Layton 5ml: 45,000 → 36,000»). Давхцал байвал хадгалахаас өмнө улаанаар.
3. **Hero (заавал биш):** «Энэ арга хэмжээнд hero нэмэх» → §9.2-ийн форм, хугацаа арга хэмжээнийхээр.

«Нийтлэх» (is_active) ба «Ноорог хадгалах» тусдаа. Явж буй арга хэмжээг засахад «Одоо дэлгүүрт шууд нөлөөлнө» баталгаажуулалт.
«Зогсоох» = `ends_at = now()` (түүх үлдэнэ), устгах нь зөвхөн ноорог.

### 9.2 «Контент → Нүүрний hero»

- Жагсаалт + **хуанли** (ирэх 90 хоног): аль өдөр ямар hero гарах, хоосон өдөр «Кодын hero» гэж саарал.
- Форм: текст, товч, холбоос сонгогч, зураг (AI / upload), `dark`, priority, урьдчилж харах.

### 9.3 «Өмнөхөөс хуулах» (K7)

Арга хэмжээ ба hero хоёуланд: бараа, хувь, текст, зургийг хуулж **ноорог** үүсгэнэ; огноо хоосон.
Цагаан сарын огноо жил бүр өөр тул ялангуяа хэрэгтэй.

### 9.4 «Бараагаар» таб (одоогийнх)

Хэвээр (`/admin/sales`). Тайлбарт «Нэрлэсэн, хугацаатай хямдралд "Арга хэмжээ"-г ашиглана уу — энэ нь одоо байгаа хямдралыг дарахгүй» гэж нэмнэ.
Барааны мөрөнд арга хэмжээнд байгаа бол нэрийг нь харуулна («Black Friday −20%, 11/23–11/30»).

---

## 10. Кэш ба цаг

- Бүх хугацаа `timestamptz`; админ УБ өдөр сонгоно (`dayStartIso`, `dayEndIso` — 0166-тай ижил).
  Hero ба үнэ **нэг** `sale_events.starts_at/ends_at`-аас уншина → зөрөхгүй.
- Эхлэх/дуусах мөчид бичилт байхгүй тул `revalidatePublic()` дуудагдахгүй — ISR 60с + `unstable_cache` 60с →
  cron-гүй бол дэлгүүрт **≤2 минутын** хоцрогдол гарах байсан (доорх cron үүнийг ≤1 мин болгоно). Төлбөр DB-ээр бодогдох тул үргэлж зөв.
- **Яг 00:00 – 23:59 (клиентийн шаардлага, §16-Q6) → cron заавал, PR1-д:** Vercel cron (`vercel.json`, одоо `*/5` ажилладаг) **минут тутам** `/api/cron/sale-events` — сүүлийн шалгалтаас хойш эхэлсэн/дууссан арга хэмжээ эсвэл hero байвал `revalidatePublic()`. Ингэснээр харагдац ≤1 минутад (cron-ийн нарийвчлал) солигдоно; **төлбөр нь DB-ээр секундын нарийвчлалтай** — 23:59:59-д хямдарсан, 00:00:00-д үндсэн үнэ. Каталогийн зурвасын тоолуур 0 болоход client `router.refresh()` дуудна (хуудсаа нээлттэй орхисон хэрэглэгчид).

---

## 11. Feature flag ба гаргалт

| Давхарга | `sale_events` | `hero_admin` |
|----------|---------------|--------------|
| Хуудас/route | `/admin/sale-events`, `/api/admin/sale-events/*` → 404; `/sale/[slug]` → `/catalog` | `/admin/heroes`, `/api/admin/heroes/*` → 404 |
| Client | Каталогийн chip, зурвас, badge | — |
| SQL | `event_pct()`, `live_sale_events()` дотор `feature_enabled('sale_events')`; бичих RPC-ууд `FEATURE_DISABLED` | `live_hero()` дотор `feature_enabled('hero_admin')` |

Хаалттай үед prod-д юу ч хуримтлагдахгүй: хүснэгтүүд хоосон, үнэ хөндөгдөхгүй.
Дараалал: `db:migrate-dev` → dev туршилт → `db:migrate-prod` → main руу merge → админаас туг нээх.

---

## 12. Аюулгүй байдал

- Route handler бүр: туг (404) → staff (403) → Zod → service-role (одоогийн `/api/admin/sales`-ийн `guard()` загвар).
- Арга хэмжээ, hero-гийн хүснэгтүүд staff-only RLS; дэлгүүр зөвхөн security definer RPC-ээр (§4.7) — ноорог ба **товлосон** арга хэмжээний хувь урьдчилж задрахгүй.
- `path` холбоос зөвхөн дотоод. Upload: MIME + харьцаа + хэмжээ шалгана, `sharp`-аар дахин encode.
- AI job: staff л, өдрийн хязгаар.

---

## 13. Тест

### 13.1 DB script — `scripts/test-sale-events.ts` (`db:test-sale-events-dev`, `test-campaigns`-ийн загвар)

1. Эхлэхээс өмнө / явж байхад / дууссаны дараа `variant_price` = үндсэн / хямдарсан / үндсэн.
2. Гар хямдрал 10% + арга хэмжээ 20% → 20%; гар 30% + арга хэмжээ 20% → 30%; арга хэмжээ дууссаны дараа гар хямдрал **хэвээр**.
3. Туг унтраалттай → арга хэмжээ үл тоомсорлогдоно. `is_active=false` → нөлөөгүй.
4. Давхцал → `EVENT_OVERLAP`; давхцахгүй хоёр арга хэмжээ → OK.
5. 100₮ дугуйрал, `least(price, …)`.
6. `place_order`: арга хэмжээний үнээр; хуучин дүнтэй ирвэл `TOTAL_CHANGED`; дууссаны дараа үндсэн үнээр.
7. **Багц:** арга хэмжээний үед бэлэн багцын үнэ **өөрчлөгдөхгүй** (үндсэн үнээс), угсарсан багц хямдарсан үнээс + багцын хувь; хоёуланд quote (TS) ↔ `place_order`-ийн дүн таарна (§5.3).
8. Таг: нийтлэхэд шууд (trigger), эхлэх/дуусахад cron-оор.
9. `catalog_search(p_event)` — гишүүд л; хуучин нэрлэсэн дуудлага (p_event-гүй) ажиллана (overload байхгүй).
10. **Эрх (anon client):** `sale_events`/`sale_event_discounts`/`heroes` шууд select → 0 мөр;
    `sale_event_public` хувь буцаахгүй; `live_sale_events` товлосон арга хэмжээг буцаахгүй.
11. anon-оор `product_variants(…, variant_price)` embedded select ажиллана.

### 13.2 Vitest

- `mapProduct`: `variant_price` байвал түүнийг, байхгүй бол `effectivePrice` (хуучин fixture-үүд өөрчлөлтгүй ногоон).
- `parse.ts` — `event`, багцад хоосорно. `catalogCanonical` — `event`-тэй үед `/catalog`.
- Hero resolver — DB hero → кодын → evergreen; demo горим.
- Zod: тэмдэгтийн хязгаар, `path` дотоод, slug.
- Prompt builder — сэдэв бүрт бүсийн дүрэм агуулагдана.

### 13.3 Гар туршилт (dev)

- **Black Friday-ийн хуурай гүйлт:** одооноос 10 минутын дараа эхэлж 10 минут үргэлжлэх арга хэмжээ + hero.
  ≤2 минутад: hero солигдох, chip, зурвас, badge, үнэ, сагс → checkout → QPay sandbox; дуусахад бүгд буцах.
- **Хил дээрх checkout:** дуусахаас өмнө сагслаад, дууссаны дараа «Захиалах» → `TOTAL_CHANGED` мэдэгдэл ойлгомжтой эсэх.
- Арга хэмжээтэй бараа орсон багц (бэлэн + өөрөө угсарсан) — үнэ, quote, захиалга.
- `explain analyze catalog_search` өмнө/дараа (§5.1).
- Mobile 390px, tablet 768px, laptop 1366×768, 1440, dark theme. Нүүрний LCP өмнө/дараа.
- AI: 5 сэдэв × 2 хувилбар, safe-zone, шошго; 3584×1280 high-ийн үргэлжлэх хугацаа (`maxDuration 300`-д багтах эсэх).

`pnpm typecheck` + `pnpm lint` + `pnpm test` цэвэр (PR бүрт); e2e demo горимд ногоон.

---

## 14. PR хуваалт ба хуваарь (Black Friday 11/23 00:00)

| PR | Агуулга | Migration | Огноо |
|----|---------|-----------|-------|
| 1 `feat/sale-events` | Хүснэгт, давхцал, RPC-ууд, `variant_price`, `catalog_search(p_event)`, `variant_price` computed column, `/admin/sale-events`, каталогийн chip/зурвас/төлөв, badge, `/sale/[slug]` redirect, DB script | 0181_sale_events | 11/14–11/17 |
| 2 `feat/hero-admin` | `heroes`, resolver, админ форм + урьдчилж харах, upload | 0182_heroes | 11/18–11/19 |
| 3 `feat/hero-ai` | `hero_image_generations`, prompt, AI урсгал | 0183_hero_image_generations | 11/19–11/20 |

- 11/14 (эхний алхам): computed column-ыг dev дээр батлах (§5.2), үнийн дүрмийн асуултууд (§16-Q1–Q3) бүгд шийдэгдсэн.
- 11/18: dev дээр хуурай гүйлт (§13.3), клиент dev-д туршина.
- 11/20: клиент Black Friday-ийн бараа, хувь, текстийг **prod-д** ноорог болгон оруулна (туг нээсний дараа), hero батална.
- 11/21: `db:migrate-prod` → merge → туг нээх → «Нийтлэх». Эхлэх хүртэл дэлгүүрт өөрчлөлтгүй.
- 11/23 00:00–00:05: шалгах. 11/30 23:59-ийн дараа: цэвэрлэгдсэнийг шалгах.

**Нөөц төлөвлөгөө:** 11/21 гэхэд PR1 бэлэн болохгүй бол — одоогийн «Хямдрал → Бараагаар» (хугацаатай) +
`HOME_CAMPAIGNS`-д мөр нэмж `/catalog?tags=sale`. Анхаар: §2.1-1 — тэр бараан дээрх өөр хямдрал дарагдана.

---

## 15. Эрсдэл

| Эрсдэл | Магадлал | Хариу |
|--------|----------|-------|
| SQL/TS үнэ зөрөх (багцын мөнгөний зам) | Бага (v2) | TS үнийг бодохгүй, `variant_price`-ийг уншина (§5.2); багцын quote ↔ place_order тест |
| Computed column embedded select-д ажиллахгүй байх | Бага | PR1-ийн эхэнд батлах; нөөц: RPC-ээр үнэ дамжуулах |
| Бэлэн багцын үнэ хямдралд автах (одоогийн код) | Өндөр (одоо ийм) | §5.3-ын засвар PR1-д; харагдац ба сервер хоёуланд, тесттэй |
| `catalog_search` удаашрах | Бага–дунд | `explain analyze`, шаардлагатай бол join хувилбар |
| `catalog_search` overload | Дунд | Нэг migration-д drop + create, хуучин дуудлагыг тест |
| Харагдац эхлэх/дуусах мөчид хоцрох | Дунд | Минут тутмын cron (§10) → ≤1 мин; төлбөр секундын нарийвчлалтай; тоолуур 0 болоход refresh |
| AI зураг тогтворгүй | Дунд | Батлах, upload нөөц, сэдвийн prompt туршилт |
| Hero LCP муудах | Бага | Кэштэй query, preload хэвээр, Web Vitals харьцуулалт |
| Хугацаа давчуу | Дунд | PR хуваалт, нөөц төлөвлөгөө, hero-г кодоор түр |

---

## 16. Клиентээс тодруулах асуулт

1. ~~Давхцал~~ — **шийдэгдсэн** (клиент, 2026-11-13 чат): арга хэмжээ **үндсэн үнээс** бодогдоно, зэрэг явж байвал **их хямдрал нь** харагдана, арга хэмжээ дуусахад урт хугацаатай хуучин хямдрал үргэлжилнэ, хоёулаа дуусахад үндсэн үнэ. Жишээ: Libre Intense 5% (11/30 хүртэл) + Black Friday 20% (11/28 хүртэл) → 11/28 хүртэл −20% (үндсэн үнээс, 5% дээр нэмэгдэхгүй), 11/29–30 −5%, дараа нь үндсэн үнэ. §3.4, §5.1-ийн `least()` загвар яг ийм.
2. ~~Купон~~ — **шийдэгдсэн** (клиент, 2026-11-13): хямдарсан үнэ дээр купон **хэрэглэгдэнэ** — одоогийн зан хэвээр, код өөрчлөхгүй.
3. ~~Багц~~ — **шийдэгдсэн** (Тайлан11.11.pptx слайд 2): бэлэн багц үндсэн үнээс, хямдрал нөлөөлөхгүй; хэрэглэгчийн угсарсан багцад давхарлана (§5.3).
4. ~~V point~~ — **шийдэгдсэн**: төлсөн дүнгээс 1–5% (одоогийн дүрэм, 0149:1190 — барааны дүн − купон); хямдарсан эсэх ялгаагүй, код өөрчлөхгүй. *(Тайлан11.11.pptx-ийн V point-ийн шинэ дараалал нь тусдаа ажил.)*
5. ~~Hero зураг~~ — **шийдэгдсэн**: админ өөрөө generate хийлгэж, хувилбаруудаас нэгийг сонгоно (тусдаа «батлах» хүн/алхам байхгүй). «Өөрийн зураг оруулах» нөөц хэвээр.
6. ~~Цаг~~ — **шийдэгдсэн**: яг 00:00 – 23:59 (УБ) байх ёстой → cron заавал (§10). Black Friday-ийн **өдрүүд** (11/23–11/30 уу, 11/28 уу)-ийг админ өөрөө оруулна.
7. ~~Текст~~ — асуулт биш: badge, гарчиг, hero-гийн текстийг клиент админаас өөрөө бичнэ.
8. ~~Хувь~~ — **шийдэгдсэн**: бараа × хэмжээ бүрт өөр хувь (§4.3).
9. ~~Тизер~~ — тусдаа feature хэрэггүй: «удахгүй» зарлал хүсвэл админ арга хэмжээтэй холбоогүй, өөрийн хугацаатай hero үүсгэнэ (§7.2). Эхлээгүй арга хэмжээний холбоос каталогт «11/23-нд эхэлнэ» гэсэн зурвас л харуулна, хувь нуугдана (§6.2).

---

## 17. Дараагийн санаа (v2)

- Арга хэмжээний тайлан: борлуулалт, захиалгын тоо, дундаж сагс (`order_items`-д `sale_event_id` nullable).
- Эхлэхэд хүслийн жагсаалттай хэрэглэгчдэд мэдэгдэл (`notifications`).
- Бараа тус бүрийн хувь, тогтмол үнэ.
- Popup-ыг арга хэмжээтэй холбох (hero-той ижил хуваарь).
- `home_sections`-д kind=`event` — нүүрт «Black Friday» тусдаа rail (одоо kind нь `manual`/`tag`).
- Нэмэлт бараа (`extras`) арга хэмжээнд оруулах.
- Hero-д бараа сонгож AI-аар тэр бараатай зураг үүсгэх.
- `HOME_CAMPAIGNS`-ийн улирлын hero-нуудыг DB руу шилжүүлж кодын массивыг зөвхөн evergreen болгох.

---

## 18. Аудитын өөрчлөлт (v1 → v2, 2026-11-13)

Кодтой дахин тулгаж шалгасан: `mapProduct`, `memberPrices`, `place_order` (0149), `catalog_items` (0125),
`catalog_search` (0115), `feature_enabled` (0133), `catalogCanonical`, `generate-image.ts`, `process-image.ts`, sidebar-ийн тугууд.

| # | v1-д | Асуудал | v2-т |
|---|------|---------|------|
| 1 | TS-д арга хэмжээний хувийг давтан бодох («толь») | `mapProduct` нь багцын **мөнгөний зам** — зөрвөл буруу үнээр зарна | TS бодохгүй, `variant_price` computed column уншина (§5.2) |
| 2 | «Багц хамаарахгүй» | Буруу — гишүүний хямдарсан үнэ багцад дамжиж давхарладаг | Зөв тайлбар + клиентийн асуулт (§5.3, §16-Q3) |
| 3 | RLS: `is_active` мөр нийтэд | Товлосон арга хэмжээний хувь, hero текст урьдчилж задарна | Staff-only + security definer RPC (§4.7) |
| 4 | `/sale/[slug]` тусдаа хуудас + canonical | Canonical redirect рүү заана, `catalogCanonical`-тай зөрчилтэй | Зөвхөн redirect; төлөвүүд каталог дээр (§6.2) |
| 5 | Админ: `/admin/sales` доторх таб | `sale_page` тугтай уялдана | Тусдаа `/admin/sale-events` (§9.1) |
| 6 | AI: одоогийн `generateProductImage`-г ашиглана гэж үзсэн | Хэмжээ хаалттай, webp болгодог, `input_fidelity` байхгүй; `processImage` 1600px-ээр хязгаарладаг | `generateHeroImage()` + өөрийн sharp алхам (§8.2) |
| 7 | «Сервер үнийг дахин бодно» | Чимээгүй биш — `TOTAL_CHANGED` буцаана | Зөв тайлбар + хил дээрх туршилт (§5.3, §13.3) |
| 8 | Таг зөвхөн cron-оор | Нийтлэхэд 1 мин хүртэл хоцорно | Арга хэмжээний хүснэгтүүд дээр trigger (§5.1) |
| 10 | Багцын давхарлалт — клиентийн асуулт | Тайлан11.11.pptx слайд 2-т хариу байсан | Бэлэн багц үндсэн үнээс, угсарсан багц давхарлана; кодын засвар нэмсэн (§5.3) |
| 11 | Давхцлын дүрэм — клиентийн асуулт | Клиент чатаар баталсан | Их хямдрал нь, үндсэн үнээс; дуусахад үлдсэн нь үргэлжилнэ (§16-Q1) |
| 12 | Арга хэмжээнд хэмжээ бүрт нэг хувь, бүх бараанд; cron заавал биш | Клиент: бараа × хэмжээгээр өөр хувь; яг 00:00–23:59 | `sale_event_discounts (event, product, ml)` (§4.3); минут тутмын cron PR1-д (§10) |
| 9 | — | Орхигдсон: demo/e2e горим, `ends_at` exclusive, slug дахин ашиглах, бэлэг/хүрд/extras хамаарахгүй, chip-ийн `transition-colors` дүрэм | Нэмсэн |

---

## Эх сурвалж

- Baymard — Sales filter-based category: https://baymard.com/blog/sales-filter-based-category
- Koozai — Black Friday хуудсыг жилийн турш байлгах: https://www.koozai.com/blog/search-marketing/should-you-keep-your-black-friday-pages-live-all-year/amp/
- Shopify Community — Давтагдах хямдралын хуваарь, сэргээлтийн асуудал: https://community.shopify.com/t/how-do-you-handle-scheduled-collection-updates-for-recurring-sales/571464

---

## 19. Хэрэгжилтийн тэмдэглэл (2026-11-13)

| PR | Салбар | Migration | DB тест |
|----|--------|-----------|---------|
| 1 | `feat/sale-events` | 0181_sale_events | `pnpm db:test-sale-events-dev` |
| 2 | `feat/hero-admin` (1 дээр) | 0182_heroes | `pnpm db:test-heroes-dev` |
| 3 | `feat/hero-ai` (2 дээр) | 0183_hero_image_generations | `pnpm db:test-heroes-dev` §8 |
| review | `feat/hero-ai` | 0184_campaign_review_fixes | хоёулаа (sale-events §12, heroes §9) |

Төлөвлөгөөнөөс зөрсөн / нэмэгдсэн:

- **Гүйцэтгэл (§5.1):** `variant_price` → definer функц мөр бүрт нь catalog_search-ийг dev дээр
  94 → 567ms болгосон (үүрлэсэн `feature_enabled`). Тугийг `feature_flags`-тэй join-оор шалгаж,
  `catalog_items` live хувийг нэг удаа (`live_event_discounts()`, materialized CTE) уншдаг болгосны
  дараа 97ms (≈+3%). Томьёо нэг газар: `event_discount_price()`; view ↔ `variant_price` тэнцүүг DB тест шалгана.
- `event_pct()` → `variant_event_price()` (үнийг шууд буцаана).
- Давхцлын trigger нь **deferred constraint trigger**; `save_sale_event` нь гишүүд + хувийг нэг транзакцид
  сольж, функц дотроо `set constraints … immediate`.
- Slug архивлалт `save_sale_event` дотор: дууссан арга хэмжээний slug-ийг шинэд өгөхөд хуучныг `slug-YYYY`.
- `/sale/[slug]` нь хуудас биш **route handler** (жинхэнэ 307) — async shop layout-ийн дараах `redirect()` 200 + meta refresh өгдөг.
- Бэлэн багцын засвар (§5.3) **тугаас хамааралгүй** — main руу орохтой зэрэг prod-д үйлчилнэ.
- Hero-той холбоотой ноорог арга хэмжээг устгахад hero ноорог болж, хугацаа нь хуулагдана (FK set null + period check).
- Hero-гийн урьдчилж харах: `/admin/hero-preview` (тусдаа `(admin-bare)` route group, iframe, postMessage).
- AI: суурь reference-ийг lambda-д файлаар (`outputFileTracingIncludes`) оруулж storage-д нэг удаа хуулна;
  `generating`-д 6 мин-ээс удсан ажил `failed`; «хурдан» хэмжээ (2688×960 / 1536×1152).
- AI: DB-ээс **ихдээ 3 үнэртэн** сонгож hero-д оруулна (§17-ийн санааг урагшлуулсан). Лавлах зураг:
  `reference_image_url` → харагдах эхний зураг; image 1…N = бараа, N+1 = scene (desktop: одоогийн hero,
  mobile: сонгосон desktop). Сонгосон дараалал = зүүн / төв / баруун. `hero_image_generations.product_ids`.

**Өгөгдлийн загвар (§4):**

- §4.8: тугууд тус тусын migration-д — `sale_events` 0181-д, `hero_admin` 0182-д.
- §4.6 `hero_image_generations`-д нэмэгдсэн багана: `group_id` (hero хадгалагдаагүй байхад ч үүсгэх —
  маягтын client uuid / hero id), `size`, `product_ids`. Туг хаалттай үед `insert` хориотой (trigger).
- `heroes`-ийн бичилт RPC биш, route-ийн service-role шууд insert/update; гурав дахь давхарга нь
  `heroes_feature_guard` trigger (туг хаалттай бол `FEATURE_DISABLED`).
- `hero_target_valid()` — товчны холбоосын DB check (`path` нь `/`-ээр эхэлсэн, `//`, `\`, хоосон зайгүй,
  ≤300). Postgres regex-ийн давталт ≤255 тул уртыг `length()`-ээр тусад нь.
- Арга хэмжээний `stop_sale_event`: явж буйг `ends_at = now()`; **эхлээгүйг ноорог руу** буцаана
  (§9.1-д зөвхөн `ends_at = now()` гэж байсан — эхлээгүй үед `ends_at > starts_at` зөрчигдөнө).

**Админ UX (§9):**

- §9.1: 3 алхамт wizard биш, **нэг drawer** (Үндсэн → Бараа ба хувь). «Ноорог хадгалах» / «Нийтлэх».
- §9.2: «хуанли» биш — **ирэх 90 хоногийн жагсаалт** (огнооны муж → аль hero, хоосон бол «Кодын hero»).
- Hero маягт: гарчиг desktop-д 2 мөрөөс хэтэрвэл анхааруулга (iframe-ээс мөрийн тоо буцаана).
- Hero зураг upload: Vercel-ийн 4.5MB хязгаарын улмаас хөтөч desktop-ыг 3200px, утсыг 1600px JPEG
  болгож илгээнэ; сервер харьцаа/өргөнийг дахин шалгаад sharp. Утасны хамгийн бага өргөн 1600 биш
  **1536** (AI-ийн «хурдан» 1536×1152 орохын тулд).
- `next.config.ts` `outputFileTracingIncludes`-д `/api/admin/heroes` (libvips) — үгүй бол Vercel дээр
  upload 500 болох байсан.
- Cron (`/api/cron/sale-events`) нь hero-гийн өөрийн хугацааны хилийг ч барина.

**AI (§8) — dev дээр туршсаны дараа (2026-11-13):**

- Model **`gpt-image-2.6-sunburst`** (клиент playground-оос сонгосон, `HERO_IMAGE_MODEL`). Барааны /
  багцын зураг `gpt-image-2` хэвээр.
- `input_fidelity` **илгээхгүй** — gpt-image-2 «does not support the 'input_fidelity' parameter» гэж татгалзсан.
- AI самбарт нэмэгдсэн: амжилтгүй / хэрэггүй хувилбарыг устгах (PNG мастер хамт), томоор харах цонх
  (текстийн бүсийн тасархай шугам асаах/унтраах, эх хэмжээгээр нээх). Бүсийг будахгүй — зөвхөн шугам
  (будалт зургийн өнгийг өөрчилж харагдуулсан).

**Review-ийн засвар (`docs/campaigns/fixes.md`, 0184):**

- §9.1 «Зогсоох»: дууссан / зогсоосон арга хэмжээг **засахгүй** — `save_sale_event` → `EVENT_ENDED` (409),
  картын «Засах» товч алга, зөвхөн «Хуулах». (Өмнө нь зогсоосныг хадгалахад шөнө дунд хүртэл дахин LIVE болдог байв.)
- §7.2 товчны дүрэм: LIVE биш арга хэмжээ рүү заасан hero-г админд «Хүлээгдэж байна» + шалтгаантай харуулна;
  хуваарь (`heroAt`) `live_hero()`-тэй ижил дүрмээр; маягтад хугацааны анхааруулга, арга хэмжээний төлөв.
- §7.3 холбоос: event товч → `/catalog?event=slug` (307-гүй); popup-ийн давхардлыг `normalizePromoHref`-ээр, хоёр товчоор.
- Дэлгүүр `live_heroes()` (ихдээ 5)-ийг кэшлэнэ — эхнийх дуусахад дараагийн DB hero шууд гарна.
- Shop layout-ийн badge map: хэмжээд засаагүй (fixes.md F4).

Хийгдээгүй (дараагийн PR):

- Барааны сонгогчийг `sale-manager.tsx`-ээс салгаж хоёр газар ашиглах (§9.1) — одоо тусдаа сонгогч.
- «Бараагаар» хуудсанд барааны мөрөнд арга хэмжээний нэр (§9.4) — зөвхөн тайлбар нэмсэн.
- Админы багцын маягтын урьдчилж харах хямдарсан үнээр харуулсаар (зөвхөн харагдац).
- §9.1-3 «Энэ арга хэмжээнд hero нэмэх» алхам арга хэмжээний маягт дотор **байхгүй** — hero-г
  «Нүүрний hero» хуудаснаас үүсгээд «Арга хэмжээтэй холбох»-оор холбоно.
- Гар туршилт (§13.3): dev дээр клиент үргэлжлүүлж байна — AI-ийн эхний Black Friday хувилбар амжилттай
  гарсан; бусад сэдэв (Цагаан сар, Наадам) × 2 хувилбар, арга хэмжээний хуурай гүйлт, хил дээрх checkout үлдсэн.

