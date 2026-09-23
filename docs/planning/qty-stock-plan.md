# Тоо ширхэг × үлдэгдэл (oversell) — засварын төлөвлөгөө

> Төлөв: **хэрэгжсэн** (2026-09-23) — migration шаардаагүй, сан хөндөгдөөгүй.
> `typecheck` + `lint` + `test` цэвэр (516 тест; `process-image.test.ts` нь
> `sharp`-ийн платформын binary-аас болж зөвхөн Linux орчинд унасан).
> Огноо: 2026-09-23
> Холбоотой: `docs/planning/bottle-lock-plan.md`, `docs/spec/development.md`,
> `docs/planning/todo.md` (§«Хэмжээ тус бүрийн үлдэгдэл шалгах»)

## 1. Асуудал

Үлдэгдэл **15ml** байхад:

- 20ml — идэвхгүй ✅ (зөв)
- 10ml — идэвхтэй, **тоо ширхэгийг 2 болгож сагсанд нэмж болно** ❌ (20ml хэрэгтэй)
- 10ml + 5ml + 2ml гэсэн **гурван тусдаа мөр** нийлээд 17ml болж болно ❌
- Багцын тоо ширхэгийг 2 болговол гишүүн бүрийн ml хоёр дахин нэмэгдэнэ ❌

Захиалга **эцэст нь бүтдэггүй**: `place_order` → `reserve_inventory` нь
`ml × qty`-г шалгаад `INSUFFICIENT_STOCK` шиднэ. Өөрөөр хэлбэл **oversell
болдоггүй** — сан зөв. Гэхдээ хэрэглэгч:

1. хаяг, утас, хүргэлтийн өдрөө бүгдийг бөглөж дуусаад,
2. «Захиалах» дарж байж,
3. **«Уучлаарай, зарим бараа дууссан байна»** гэсэн ЕРӨНХИЙ мессеж авна —
   аль бараа, хэдээр багасгахаа мэдэхгүй, сагс нь хэвээрээ үлдэнэ.

Тэр хэрэглэгч тоог нь 1 болгож бууруулснаар захиалга орно гэдгийг таамаглах
арга байхгүй → **орхигдсон сагс**.

**Зорилго:** «хэдэн ширхэг авч болох» гэдгийг **эхний дэлгэц дээр** хэлж,
сагс болон checkout-д тууштай барих. Сан дээрх сүүлийн хамгаалалт хэвээр.

## 2. Одоогийн байдал (код дахь баримт)

Өнөөдрийн зарагдах дүрэм бол **нэг ширхэгийн boolean**:

| газар | дүрэм |
| --- | --- |
| `variant_sellable()` — `0095_bottle_stock.sql` | `coalesce(p_available_ml,0) >= pv.ml` |
| `mapProduct()` — `src/features/products/api.ts:130` | `!is_sold_out && availableMl >= v.ml` |
| `variantAvailability()` — `src/features/products/sellable.ts:23` | `isActive && inStock && !bottleLocked` |

Гурвуулаа **«нэг ширхэг цутгах ml хүрэлцэх үү»** гэсэн асуулт. `qty`-г хаана
ч үржүүлдэггүй, нэг барааны олон мөрийг хаана ч нэмдэггүй.

Тоо ширхэгийн **дээд хязгааргүй** 6 газар:

| файл | мөр | юу |
| --- | --- | --- |
| `src/features/products/components/product-purchase.tsx` | 283 | PDP `setQty(q => q + 1)` |
| `src/features/products/components/quick-add.tsx` | 213 | Хурдан нэмэх |
| `src/features/cart/components/cart-sheet.tsx` | 342 / 261 | мөр / багц |
| `src/app/(shop)/cart/page.tsx` | 290 / 202 | мөр / багц |
| `src/features/cart/store.ts` | 191 (`setQty`) | зөвхөн `Math.max(1, qty)` |

Сервер тал:

- `useCartAvailability` (`src/features/cart/use-cart-availability.ts`) нь
  `/api/products?ids=…&details=1`-ээс **`sellable` boolean-ийг** л уншдаг.
  Хариунд нь `availableMl` **аль хэдийн ирдэг** (`ProductDetail.availableMl`)
  — ашиглагдаагүй байна.
- `priceLines()` (`src/features/checkout/api.ts:74`) — зөвхөн
  `!variant.sellable` бол `missing`. Нийт ml тоолохгүй.
- Бэлгийн 1ml дээж (`src/features/checkout/api.ts:273`) —
  `p.availableMl < GIFT_SAMPLE_ML` гэж **сагснаас тусад нь** шалгадаг тул
  сагс эх савыг бүрэн дуусгасан байхад ч бэлэг нэмэгдэнэ.
- `place_order` (`0095`) → `reserve_inventory(v_product, v_ml * v_qty)` —
  **энд л** жинхэнэ шалгалт болно, мөр бүрээр, row lock дотор. **Зөв.**
- `src/app/api/orders/route.ts:233` — `INSUFFICIENT_STOCK:<product_id>` гэсэн
  алдааны **product_id-г хаядаг**, `OUT_OF_STOCK` гэж л буцаана.
- `src/app/(shop)/checkout/page.tsx:812` — ерөнхий мессеж, сагсыг засдаггүй
  (харьцуул: `ITEMS_UNAVAILABLE` нь мөрийг нэрлээд **сагснаас хасдаг**).

## 3. Үндсэн шалтгаан

> Үлдэгдэл нь **ml-ийн нөөц** (тасралтгүй), харин UI нь түүнийг
> **хэмжээ тус бүрийн on/off** болгож хялбарчилсан. Хоёрын хооронд
> «хэдэн ширхэг» гэсэн ойлголт **огт байхгүй**.

`bottle-lock-plan.md`-ийн сургамж энд ч хамаатай: дүрмийг **нэг газар**
бичээд бүх дуудагч тэндээс уншина. Тиймээс шинэ дүрмийг `sellable.ts` дээр,
`variantAvailability()`-ийн хажууд тавина.

## 4. Шийдэл — нэг дүрэм: «үлдсэн ширхэг»

`src/features/products/sellable.ts` дотор (шинэ SQL шаардахгүй, цэвэр функц):

```ts
/** Энэ хэмжээгээр ХЭДЭН ширхэг цутгаж болох вэ — үлдсэн ml-ийн дагуу. */
export function maxUnits(v: {
  ml: number;
  sellable: boolean;        // variantAvailability()-ийн гаралт
  remainingMl: number;      // эх савны үлдэгдэл, ЭНЭ сагсны хэрэглээг хассан
}): number {
  if (!v.sellable || v.ml <= 0) return 0;
  return Math.max(0, Math.floor(v.remainingMl / v.ml));
}

/** Нэг барааны эх савнаас сагс ХЭДЭН ml аль хэдийн «идсэн» бэ. */
export function cartMlFor(productId: string, cart: {...}): number
```

`cartMlFor` нь **дөрвүүлэнг** тоолно: энгийн мөр (`items`), багцын гишүүн
(`collections[].members` × багцын `qty`), «Захиалах» мөр (`buyNow`) ба
сонгосон бэлгийн 1ml дээж. Ингэснээр «энэ бараанаас өөр хэмжээгээр аль
хэдийн авсан» тохиолдол автоматаар зөв бодогдоно.

**Ойлголтууд:**

- `availableMl` — сан дээрх `on_hand_ml - reserved_ml` (бусад хүний
  дуусаагүй захиалга аль хэдийн хасагдсан).
- `remainingMl = availableMl - cartMlFor(productId)` — ЭНЭ хэрэглэгчийн
  сагсыг хассан үлдэгдэл.
- `maxQty` — тухайн мөрийн `+` товч хүрэх дээд тоо (мөрийн өөрийнх нь
  одоогийн qty-г нэмж тооцно).

**`variant_sellable()`-ийг ӨӨРЧЛӨХГҮЙ.** Тэр нь «энэ хэмжээг зарах уу»
гэсэн каталогийн асуулт хэвээр байх ёстой — үлдэгдэл 15ml байхад 10ml
**зарагдана**, зүгээр л 1 ширхэгээр.

## 5. Давхаргууд (хамгаалалт бүрийн үүрэг)

| # | Давхарга | Үүрэг |
| --- | --- | --- |
| 1 | PDP / quick-add | `+` товчийг **хаана**, «Дээд тал нь N ш» гэж хэлнэ |
| 2 | Сагс (store + 4 stepper) | `setQty` нь `maxQty`-д **clamp**, `+` идэвхгүй |
| 3 | `computeSummary` (сервер) | **бараа тус бүрээр** Σ(ml×qty) > availableMl бол **чанга унана**, аль барааг хэд болгохыг нэрлэнэ |
| 4 | `place_order` (сан) | **өөрчлөхгүй** — row lock дахь эцсийн үнэн |

### 5.1 Давхарга 1 — PDP / quick-add

`ProductDetail.availableMl` аль хэдийн ирдэг тул шинэ хүсэлт хэрэггүй.

```ts
const inCart = cartMlFor(product.id);                      // сагсны хэрэглээ
const cap = maxUnits({ ml: selected.ml, sellable: selected.sellable,
                       remainingMl: product.availableMl - inCart });
```

- `+` товч: `disabled={qty >= cap}`.
- `cap === 0` (сагс аль хэдийн дүүргэсэн) → «Сагсанд чинь энэ барааны
  үлдэгдэл бүрэн орсон байна» гэсэн мөр, `Сагсанд нэмэх` идэвхгүй.
- `cap` нь 1–3 бол хомсдлын мөр: **«Үлдэгдэл 15ml — 10ml-ээс 1 ш авах
  боломжтой»**. 4-өөс дээш бол дэмий сандаргахгүй, юу ч бичихгүй.
- Хэмжээ солиход `qty`-г `Math.min(qty, cap)` болгож буулгана (одоо
  20ml-ээс 2ml рүү шилжихэд qty хэвээр үлддэг).

### 5.2 Давхарга 2 — Сагс

- `store.ts`-ийн `setQty`/`setCollectionQty` нь **`max` параметр** авна:
  `qty: Math.min(Math.max(1, qty), max ?? Infinity)`. Store нь өөрөө
  үлдэгдлийг мэдэхгүй (persist хийгддэг, хуучирдаг) — хязгаарыг **дуудагч**
  дамжуулна. Ингэснээр localStorage дотор хуучин үлдэгдэл хэзээ ч
  хадгалагдахгүй.
- `useCartAvailability`-г өргөтгөнө: `/api/products?…&details=1` хариунаас
  `availableMl`-ийг **бараагаар** хадгалж, мөр бүрд `maxQty` буцаана.
  Одоогийн `blockedItemKeys` хэвээр; шинээр `overQtyKeys` нэмэгдэнэ.
- Сагс нээгдэхэд хэтэрсэн мөрийг **чимээгүй хасахгүй**, харин
  `maxQty` хүртэл буулгаад мөрийн доор: «Үлдэгдэл хүрэлцэхгүй тул 2 ш → 1 ш
  болголоо». Энэ нь `ITEMS_UNAVAILABLE`-ийн одоогийн зан төлөвтэй нийцнэ
  (нэрлээд засна, дуугүй өнгөрөхгүй).
- Багц: гишүүн бүрийн `ml × багцын qty`-г шалгаж, хамгийн хатуу гишүүнээр
  `maxQty` тогтооно (`collectionStatus`-ийн «хамгийн муу гишүүн» загвартай
  ижил).
- Сүлжээ унасан бол **хязгаарлахгүй** (одоогийн `OK` fallback-тай ижил
  философи) — сервер тал барина.

### 5.3 Давхарга 3 — checkout серверийн шалгалт

`computeSummary`-д **бараагаар нэгтгэсэн** шалгалт нэмнэ (`priceLines` ба
`priceCollectionLines` хоёрын **дараа**, бэлгийн мөрийг оруулаад):

```ts
// бараа бүрээр Σ(ml × qty) ≤ availableMl
class InsufficientStockError extends Error {
  // [{ productId, name, ml, requestedMl, availableMl, maxQty }]
}
```

→ `src/app/api/orders/route.ts` нь `409 { error: "INSUFFICIENT_STOCK", items: [...] }`
буцаана. Checkout хуудас нь `ITEMS_UNAVAILABLE`-ийн замаар: мөрүүдийг
`maxQty` хүртэл буулгаад **нэрлэсэн** мессеж харуулна —
«Dior Sauvage 10ml-ээс 1 ш л үлдсэн тул тоог багасгалаа. Шалгаад дахин
үргэлжлүүлнэ үү.»

Мөн `place_order`-ийн `INSUFFICIENT_STOCK:<product_id>`-оос **product_id-г
задлаад** тэр барааг нэрлэнэ (race — захиалга үүсэх зуур өөр хүн авчихсан).
Migration шаардахгүй: дугаар нь алдааны мөрөнд аль хэдийн байгаа.

### 5.4 Бэлгийн 1ml дээж

`priceGiftLines` нь `availableMl >= GIFT_SAMPLE_ML` биш, **сагсны хэрэглээг
хассан** үлдэгдлээр шалгана. Бэлэг нь төлбөртэй мөрийн **дараа** нөөцлөгдөх
ёстой — эх сав дуусгасан бараанаас бэлэг санал болгохгүй
(`/api/gifts` дээр ч мөн адил: сагсны `productId → ml` нийлбэрийг query-гээр
дамжуулна).

## 6. Ирмэгийн тохиолдол

| тохиолдол | хүлээгдэх зан төлөв |
| --- | --- |
| «Захиалах» (buy-now) | Сагсыг **тоолохгүй** — тэр урсгалд зөвхөн энэ мөр захиалагдана |
| Нэг бараа: 10ml×1 + 5ml×1, үлдэгдэл 15 | Зөвшөөрнө (яг таарна). 2ml нэмэх гэвэл `+` хаалттай |
| Нэг бараанаас 2 багцад орсон | Хоёуланг нь нийлбэрт тоолно |
| `is_sold_out = true` | `sellable = false` → `maxQty = 0` (өмнөх дүрэм хэвээр) |
| Савны түгжээ (0095) | `sellable = false` → `maxQty = 0`, мессеж нь **савных** хэвээр |
| Үлдэгдэл 15, 2ml сонгосон | `floor(15/2) = 7` ш — 1ml үлдэнэ, энэ нь зөв (хагас сав цутгахгүй) |
| Хоёр хэрэглэгч зэрэг | Давхарга 1–3 хэзээ ч баталгаа биш; `reserve_inventory`-ийн row lock шийднэ |
| Сүлжээгүй / API унасан | Хязгаарлахгүй, сервер тал барина |

## 7. Тест

**Unit (vitest)**

- `sellable.test.ts` — `maxUnits`: 15ml дээр `{20:0, 10:1, 5:3, 2:7}`;
  `sellable=false` бол үргэлж 0; `remainingMl < 0` бол 0.
- шинэ `cart-budget.test.ts` — `cartMlFor`: энгийн мөр + багц × qty +
  buyNow + бэлэг; нэг бараа олон мөрөөр.
- `store.test.ts` — `setQty(key, 5, { max: 2 })` → 2; `max` өгөөгүй бол хуучин
  зан төлөв хэвээр (regression).
- шинэ `checkout/stock.test.ts` — `computeSummary` нь 10ml×2 (үлдэгдэл 15)
  дээр `InsufficientStockError` шиднэ, `maxQty: 1` буцаана; багц + энгийн
  мөр нийлсэн тохиолдол; бэлэг нь сагсны дараа тоологдох.

**E2E (playwright, `e2e/shop.spec.ts` / `checkout.spec.ts`)**

- Үлдэгдэл 15ml бүхий бараа: 20ml зураастай, 10ml дээр `+` дарахад qty 1
  хэвээр, хажууд нь «1 ш авах боломжтой» гэсэн мөр.
- Сагсанд 10ml×1 байхад ижил барааны 10ml дахин нэмэх гэвэл болохгүй.
- Checkout дээр гараар (devtools-гүй) хүрэхгүй тул давхарга 3-ыг
  **API тест**-ээр: `POST /api/orders` рүү 10ml×2 илгээхэд `409
  INSUFFICIENT_STOCK` + `maxQty`.

**Гараар шалгах**

`pnpm db:migrate-dev` шаардахгүй — dev сан дээр нэг барааны `on_hand_ml`-ийг
15 болгоод дээрх 3 сценарийг давтана.

## 8. Хэрэгжсэн байдал

| хэсэг | файл |
| --- | --- |
| Дүрэм | `src/features/products/sellable.ts` → `maxUnits()` |
| Сагсны төсөв | `src/features/cart/budget.ts` → `cartMlByProduct` / `cartMlFor` |
| Серверийн шалгалт | `src/features/checkout/api.ts` → `findStockShortages()`, `mlByProduct()`, `InsufficientStockError`; `priceLines`/`priceCollectionLines` нь `stock` буцаана; `priceGiftLines` нь `usedMl` авна |
| API хариу | `src/app/api/orders/route.ts` → `409 INSUFFICIENT_STOCK` (мөр бүрийн `maxQty`-тай), `OUT_OF_STOCK` дээр `productId` |
| Checkout UI | `src/app/(shop)/checkout/page.tsx` → мөрийг `maxQty` хүртэл буулгаад нэрлэсэн мессеж |
| Сагс | `store.ts` (`setQty`/`setCollectionQty` нь `max`), `use-cart-availability.ts` (`maxQtyOf`, `maxCollectionQtyOf`, авто clamp, `enabled`), `cart-sheet.tsx`, `(shop)/cart/page.tsx` |
| Бараа | `product-purchase.tsx`, `quick-add.tsx` — `+` хаагдана, хомсдлын мөр |
| Тест | `sellable.test.ts`, `budget.test.ts`, `checkout/stock.test.ts`, `store.test.ts` |

Хийгдээгүй: E2E сценари (`e2e/shop.spec.ts`) — dev сан дээр 15ml үлдэгдэлтэй
бараа бэлдэх шаардлагатай тул гараар шалгасны дараа нэмэх.

## 8a. Анхны төлөвлөсөн дараалал (PR-ууд)

| # | PR | Хамрах хүрээ | Эрсдэл |
| --- | --- | --- | --- |
| 1 | `fix/stock-max-units-rule` | `sellable.ts` дээр `maxUnits` + `cartMlFor` + unit тест. **UI хөндөхгүй.** | Байхгүй (шинэ цэвэр функц) |
| 2 | `fix/stock-server-guard` | `computeSummary` шалгалт, `InsufficientStockError`, `/api/orders` хариу, checkout хуудасны мессеж + сагс засах. Бэлгийн дээжийн засвар. | Дунд — checkout урсгал. API тесттэй |
| 3 | `fix/stock-qty-cap-ui` | PDP, quick-add, сагсны 4 stepper, `store.setQty(max)`, `useCartAvailability.maxQty` | Бага — зөвхөн хязгаарлана |
| 4 | `fix/stock-error-naming` | `INSUFFICIENT_STOCK:<product_id>`-ийг задлаж барааг нэрлэх (race-ийн мессеж) | Бага |

**Дараалал санаатай:** сервер тал (PR 2) эхэлж орсноор UI засагдаагүй байхад
ч хэрэглэгч ойлгомжтой мессеж авна; PR 3 нь түүнийг ХҮРТЭЛ ХҮРГЭХГҮЙ байх
тухай. Урвуугаар хийвэл UI нь хаачихаад сервер тал хэвээр ерөнхий мессежтэй
үлдэнэ.

Тус бүр өмнө: `pnpm typecheck` + `pnpm lint` + `pnpm test` цэвэр.

## 9. Хамрахгүй зүйл

- **Migration байхгүй.** `variant_sellable()`, `place_order`,
  `reserve_inventory` гурвыг **хөндөхгүй** — сан дээрх логик зөв байна.
  (Хэрэв ирээдүйд `product_variants_for()` рүү `maxUnits` нэмэх бол тусдаа
  `0096` — энэ төлөвлөгөөнд ороогүй.)
- **Админ талд** «хэдэн ширхэг үлдсэн» харуулах — `/admin/inventory` нь ml-ээр
  ажилладаг нь зөв, өөрчлөхгүй.
- Reserve timeout, oversell-ийн race — одоогийн загвар (row lock + pg_cron)
  хэвээр.
- Үнийн логик, багцын хөнгөлөлт — огт хөндөхгүй.
