# Савны түгжээ (bottle lock) — хэрэгжүүлэлтийн төлөвлөгөө

> Төлөв: **хэрэгжсэн** (2026-09-23) — код бичигдсэн, migration
> `0095_bottle_stock.sql` **ажиллуулаагүй** хэвээр (§4-ийг үз).
> Огноо: 2026-09-23
> Холбоотой: `docs/spec/development.md`, `docs/planning/todo.md`

## 1. Асуудал

Декант цутгах **хоосон сав** нь ml бүрт **3 өнгөтэй** ирдэг ба өнгө нь тухайн
үнэртний хүйсээр (`products.gender`) хуваарилагдана:

| өнгө | хэрэглэгдэх бараа |
| --- | --- |
| өнгө A | эрэгтэй үнэр (`gender = 'male'`) |
| өнгө B | эмэгтэй үнэр (`gender = 'female'`) |
| өнгө C | unisex үнэр (`gender = 'unisex'`) |

Нэг өнгө/хэмжээний сав дуусахад (ж: **эрэгтэй 10ml сав**) тэр хослолыг
цутгах боломжгүй болно. Одоо админд үүнийг зарлах арга байхгүй — гарцаагүй
бараа тус бүрийн 10ml-ийг гараар унтраах шаардлагатай болж байна (76+ бараа).

**Хүсэлт:** админ нэг товчоор `(хүйс × ml)` хослолыг түр хааж, сав ирэхэд буцааж
нээх. Хаагдсан үед дэлгүүрийн бүх холбогдох бараа/багцын тэр хэмжээ идэвхгүй
болно.

### Хамрах хүрээ — юу БИШ вэ

Энэ нь **захиалгын «Түгжигдсэн мл»** (`inventory.reserved_ml`, `/admin/reservations`)-
тэй огт өөр ойлголт:

| | Түгжигдсэн мл (одоо байгаа) | Савны түгжээ (шинэ) |
| --- | --- | --- |
| Юуны нөөц | эх савны **шингэн** ml | **хоосон сав** (өнгө × хэмжээ) |
| Түлхүүр | бараа тус бүр | `(gender, ml)` — 12 хослол |
| Хэн үүсгэдэг | захиалга автоматаар reserve хийнэ | админ гараар асаана/унтраана |
| Хугацаа | reserve timeout-оор автоматаар суллагдана | сав ирэх хүртэл |

## 2. Одоогийн байдал (код дахь баримт)

- Хэмжээний **зарагдах эсэх** дүрэм өнөөдөр 4+ газар **давхардаж** бичигдсэн:
  - `catalog_items` VIEW — `supabase/migrations/0059_product_detail.sql`
  - `search_all()` — `0082_search_collection_members_ui.sql`
  - `variants_for_products()` — `0064_variants_for_products.sql`
  - TS толь: `mapProduct()` — `src/features/products/api.ts:110-130`
  - Дүрэм: `pv.is_active and not inv.is_sold_out and inv.available_ml >= pv.ml`
- `product_variants.is_active` нь **бараа тус бүрийн** хэмжээний унтраалга — үүнийг
  савны түгжээнд ашиглавал (bulk update) админы гарын тохиргоо дарагдаж, сав ирэхэд
  юуг буцааж асаахаа мэдэхгүй болно. Тиймээс **тусдаа хүснэгт** хэрэгтэй.
- Багцын гишүүн (`toMember`, `src/features/collections/api.ts`) нь
  `ProductDetail.variants`-ийн `isActive`/`inStock`-оос шууд уншдаг → нэг газар
  зассан нь багц руу **өөрөө** тархана.
- `priceLines()` (`src/features/checkout/api.ts`) нь `variant.isActive`-ийг
  шалгаад `missing` болгож буцаадаг — сервер талын хамгаалалтын суурь бэлэн.
- `place_order()` нь **зөвхөн үлдэгдэл** шалгадаг (`reserve_inventory`), хэмжээ
  идэвхтэй эсэхийг шалгадаггүй → энд шинэ хамгаалалт нэмнэ.
- Сагс нь `localStorage`-д (zustand persist) хадгалагддаг тул **хуучин мөр**
  долоо хоногоор сууж болно → сагсны мөрийг сервер талаас дахин шалгах ёстой.

## 3. Өгөгдлийн загвар

Шинэ хүснэгт — 12 мөр (3 хүйс × 4 хэмжээ), мөр бүр нь нэг өнгө/хэмжээний сав:

```sql
create table bottle_stock (
  gender     gender_t    not null,
  ml         int         not null check (ml in (2, 5, 10, 20)),
  is_active  boolean     not null default true,
  -- Заавал биш: «10-нд ирнэ» гэх мэт админы тэмдэглэл, дэлгүүрт харагдахгүй.
  note       text        not null default '',
  updated_by uuid        references profiles(id),
  updated_at timestamptz not null default now(),
  primary key (gender, ml)
);
```

### Онцгой тохиолдлын «чөлөөлөх» тэмдэг

Шийдвэр (2026-09-23): савны өнгө нь `products.gender`-ээр **тодорхойлогдоно**,
орлуулах нь ердийн урсгал биш. Гэхдээ ховор тохиолдолд «эрэгтэй үнэрийг unisex
саванд хийж явуулъя» гэж админ шийдэж болно — түүнд зориулж **нэг барааны нэг
хэмжээг** түгжээнээс чөлөөлөх тэмдэг хэрэгтэй (түгжээг бүхэлд нь нээх нь 34
барааг зэрэг нээх тул болохгүй):

```sql
alter table product_variants
  add column if not exists bottle_override boolean not null default false;

comment on column product_variants.bottle_override is
  'Савны түгжээнээс чөлөөлөх — өөр өнгийн саванд цутгахаар админ гараар '
  'зөвшөөрсөн ганцхан бараа/хэмжээ. Сав ирэхэд буцааж false болгоно.';
```

Эцсийн дүрэм:

```
sellable = pv.is_active
       and (bottle_active(p.gender, pv.ml) or pv.bottle_override)
       and not inv.is_sold_out
       and inv.available_ml >= pv.ml
```

**Гурван унтраалга бие биеэ дардаггүй.** `pv.is_active` нь `and`-аар холбогдсон
тул савны түгжээ нээгдэх нь түүнийг **хэзээ ч** буцааж асаахгүй: админ бараа A-гийн
10ml-ийг гараар унтраасан бол сав ирсэн ч 10ml нь хаалттай хэвээр. Тиймээс
савны түгжээг **bulk `update product_variants set is_active = false`**-ээр
хэрэгжүүлж БОЛОХГҮЙ — тэр тохиолдолд л «нээхэд өмнө нь гараар унтраасан бараа
санамсаргүй нээгдэх» эрсдэл үүснэ.

Үлдэж болох цорын ганц «мартагдах» тэмдэг нь `bottle_override`: түгжээ нээгдсэн
хойно тэр `true` хэвээр үлдвэл хор хөнөөлгүй ч, ДАРААГИЙН удаа тэр өнгө/хэмжээ
хаагдахад тухайн бараа чимээгүй нээлттэй үлдэнэ. Үүний эсрэг §6-гийн
«чөлөөлсөн бараануудын жагсаалт» + нээхэд асуух цонх тавьсан.

**Яагаад тоо биш, унтраалга вэ:** клиентийн хүсэлт «дуусахад хаа, ирэхэд нээ»
гэсэн. Савны ширхэгийн тоог (`on_hand`) хөтлөх нь захиалга бүрт decrement/
reserve хийх шаардлага үүсгэж, inventory-той хоёр дахь транзакц болно —
энэ фазад оруулахгүй (§10-ийн 4-р асуултыг үз).

Туслах функц — дүрмийг **нэг** газар үлдээнэ:

```sql
create or replace function bottle_active(p_gender gender_t, p_ml int)
returns boolean language sql stable as $$
  select coalesce(
    (select bs.is_active from bottle_stock bs
      where bs.gender = p_gender and bs.ml = p_ml),
    true)          -- мөр байхгүй бол хаагаагүй гэж үзнэ (fail-open)
$$;
```

RLS (`0009_rls.sql`-ийн хэв маягаар):

```sql
create policy "bottle read"  on bottle_stock for select using (true);
create policy "bottle write" on bottle_stock for all
  using (is_staff()) with check (is_staff());
```

> `catalog_items` нь `security_invoker` тул **anon** уншиж чадах ёстой.

## 4. Migration — `0095_bottle_stock.sql`

1. `bottle_stock` хүснэгт + 12 мөр seed (бүгд `is_active = true`).
2. `bottle_active()` функц + RLS бодлого + `product_variants.bottle_override`
   багана (default `false`).
3. Зарагдах дүрмийн **бүх** хуулбарт нэг нөхцөл нэмэх:

   ```sql
   pv.is_active
     and (bottle_active(p.gender, pv.ml) or pv.bottle_override)   -- ← шинэ
     and not coalesce(inv.is_sold_out, false)
     and coalesce(inv.available_ml, 0) >= pv.ml
   ```

   Дахин тодорхойлох объектууд: `catalog_items` (view), `search_all()`,
   `variants_for_products()`. Гурвуулаа `products.gender`-т аль хэдийн хандаж
   байгаа тул нэмэлт join шаардлагагүй.
4. `place_order()`-д хамгаалалт — reserve хийхийн өмнөх давталтад:

   ```sql
   select p.gender, coalesce(pv.bottle_override, false)
     into v_gender, v_override
     from products p
     left join product_variants pv
       on pv.product_id = p.id and pv.ml = v_ml
    where p.id = v_product;
   if not (bottle_active(v_gender, v_ml) or v_override) then
     raise exception 'BOTTLE_UNAVAILABLE:%:%', v_gender, v_ml
       using errcode = 'check_violation';
   end if;
   ```

   `/api/orders` нь энэ алдааг барьж «Сонгосон хэмжээний сав түр дууссан»
   гэсэн мэдэгдэл рүү хөрвүүлнэ (`INSUFFICIENT_STOCK`-ийн одоогийн замтай адил).
5. `admin_product_options()`-ийн `price_by_ml` — **хэвээр** (админы багц угсрах
   формд үнэ харагдсаар байх ёстой), гэхдээ `locked_mls int[]` багана нэмж өгвөл
   форм дээр «түр хаалттай» тэмдэг тавих боломжтой.

> Migration нь `pnpm db:migrate-dev` → шалгах → `pnpm db:migrate-prod` дарааллаар.

## 5. TS давхарга

### 5.1 Нэг эх сурвалж

`src/features/products/api.ts`-ийн `mapProduct()` нь SQL-ийн толь тул мөн адил
өөрчлөгдөнө. Хаалттай эсэхийг мэдэхийн тулд `bottle_stock`-ийг кэштэй уншина:

```ts
// src/features/products/bottle-stock.ts (шинэ)
export type BottleKey = `${Gender}:${number}`;
/** unstable_cache + CACHE_TAG_CATALOG — 12 мөр, хуудас бүрт дахин уншихгүй. */
export const getLockedBottles: () => Promise<Set<BottleKey>>;
export const isBottleLocked = (locks, gender, ml) => locks.has(`${gender}:${ml}`);
```

### 5.2 Variant-ийн хэлбэр

Одоо `{ isActive, inStock }` хоёрыг дуудагч бүр **гараар** `&&`-ээр холбож
байна (`product-purchase.tsx:191`, `cart-size-select.tsx:52`, `builder.tsx:71`
гэх мэт). Гурав дахь нөхцөл нэмэгдэж байгаа тул **дүрмийг төвлөрүүлнэ**:

```ts
interface ProductVariant {
  id: string; ml: number; price: number; basePrice: number;
  isActive: boolean;      // админ энэ бараанд тэр хэмжээг унтраасан
  inStock: boolean;       // эх савны ml хүрэлцэнэ
  bottleLocked: boolean;  // ← шинэ: сав дууссан БА чөлөөлөөгүй
                          //    (bottle_override = true бол locked = false)
  sellable: boolean;      // isActive && inStock && !bottleLocked
  unavailableReason: null | "inactive" | "stock" | "bottle";  // UI-ийн текстэд
}
```

`sellable`-ийг оруулснаар `soldOut`, «-аас эхлэх» үнэ, багцын `available`
бүгд автоматаар зөв болно. `unavailableReason` нь **«Дууссан»** ба
**«Түр байхгүй»**-г ялгаж бичих боломж өгнө.

### 5.3 Хөндөгдөх файлууд

| Файл | Өөрчлөлт |
| --- | --- |
| `features/products/api.ts` | `mapProduct()`-д `bottleLocked`/`sellable`; `soldOut`, `startingPrice` нь `sellable`-ээр |
| `features/products/components/product-purchase.tsx` | хэмжээний товч — `sellable`, шалтгаанаар текст |
| `features/products/components/quick-add.tsx` | адил |
| `features/products/components/product-card.tsx` | «Дууссан» badge-ийн эх сурвалж |
| `features/cart/components/cart-size-select.tsx` | сонголтын жагсаалтад «түр байхгүй» |
| `features/collections/api.ts` | `toMember`, `BuilderProduct` — `variantByMl[ml]` дотор `sellable` |
| `features/collections/types.ts` | `variantByMl` утгын хэлбэр + `CollectionPriceAtMl.available` |
| `features/collections/components/builder.tsx` | `inStock` → `sellable` (мөр 71/73/266/419) |
| `features/collections/components/collection-detail.tsx`, `my-collections.tsx` | адил |
| `features/checkout/api.ts` | `priceLines`, `priceCollectionLines` — хаалттай мөрийг `missing` рүү |
| `features/search/api.ts`, `types.ts` | SQL-ээс ирэх `sellable_mls` аль хэдийн шүүгдсэн — тестээр батал |

## 6. Админы UI

**Байршил:** хажуугийн цэсний «Агуулах» бүлэгт `«Түгжигдсэн мл»`-ийн хажууд
шинэ холбоос — **`/admin/bottles` · «Савны нөөц»**
(`features/admin/components/admin-sidebar.tsx:91`).

**Хуудас:** 3×4 хүснэгт, нүд бүрт `Switch`:

```
            2ml      5ml      10ml     20ml
Эрэгтэй     [ ● ]    [ ● ]    [   ]    [ ● ]     ← 10ml хаалттай
Эмэгтэй     [ ● ]    [ ● ]    [ ● ]    [ ● ]
Unisex      [ ● ]    [ ● ]    [ ● ]    [ ● ]
```

- Унтраахад **баталгаажуулах цонх**: «Эрэгтэй үнэрийн 10ml — 34 бараа, 3 багцад
  нөлөөлнө. Үргэлжлүүлэх үү?» (тоог нь нэг RPC-ээр урьдчилан тоолж харуулна).
- Нүд бүрт сүүлд хэн, хэзээ өөрчилснийг харуулна (`updated_by`, `updated_at`).
- Заавал биш: `note` талбар («9/28-нд ирнэ») — зөвхөн админд.
- `/admin/products` жагсаалтын мөрөнд хаалттай хэмжээ саарал + tooltip, мөрийн
  цэснээс **«Түгжээнээс чөлөөлөх»** (`bottle_override`) — «Өөр өнгийн саванд
  цутгана» гэсэн анхааруулгатай.
- Савны нөөцийн хуудасны доод талд **чөлөөлсөн бараануудын жагсаалт**: сав
  ирэхэд эдгээрийг буцааж `false` болгохыг санахад тусална. Түгжээг нээхэд
  «3 бараа чөлөөлөгдсөн байна — цуцлах уу?» гэж асууна.

**API:** `PATCH /api/admin/bottles` → `{ gender, ml, isActive, note }`,
`operator | super_admin` эрх (route handler дотор давхар шалгалт, §7.5),
дараа нь `revalidatePublic()` (`CACHE_TAG_CATALOG` цэвэрлэгдэнэ).

## 7. Дэлгүүрийн зан төлөв

| Газар | Хаалттай үед |
| --- | --- |
| Барааны хуудас, хэмжээний товч | `disabled`, шошго «Түр байхгүй» (Дууссан ≠ Түр байхгүй) |
| Барааны карт, «-аас эхлэх» үнэ | хаалттай хэмжээг тооцохгүй |
| Бүх хэмжээ нь хаалттай бараа | «Дууссан» карт, каталогийн дараа эрэмбэлэгдэнэ |
| Каталогийн ml шүүлт | хаалттай хэмжээг сонгоход тэр хэмжээгээр зарагдах бараа гарахгүй (`sellable_mls` аль хэдийн шүүгдсэн) |
| Preset багцын тухайн ml | гишүүдийн **аль нэг** нь хаалттай бол багцын тэр хэмжээ `available = false` |
| Багц угсрагч (builder) | сонгосон ml дээр гишүүн саарал, «Энэ хэмжээ түр байхгүй» |
| Сагсны мөр | ✅ мөрийг устгахгүй — улаан тэмдэг + «Хэмжээ солих / хасах» санал |
| Хүслийн жагсаалт | мөн адил тэмдэг |
| Checkout | хаалттай мөртэй бол `missing` → «Эдгээр мөр одоо захиалах боломжгүй» дэлгэц |
| `place_order` | `BOTTLE_UNAVAILABLE` — сүүлийн шатны хамгаалалт |

**Сагсны талаар онцлон:** сагс нь браузарт хадгалагддаг тул серверийн мэдээгүйгээр
шийдэх боломжгүй. Сагсны хуудас нээгдэхэд мөрүүдийн `productId`-гаар
`/api/products?ids=…&details=1`-ийг нэг удаа дуудаж `sellable`-ийг шинэчилнэ
(хүслийн жагсаалт `wishlist/page.tsx:19`-д яг ийм загвартай ажилладаг).

## 8. Кэш ба цэвэрлэгээ

- `getLockedBottles()` → `unstable_cache`, tag `CACHE_TAG_CATALOG`.
- Админ унтраалга дарахад `revalidatePublic()` — `/` layout + каталогийн tag.
- `catalog_items`-ээс уншдаг хуудсууд ISR/кэштэй тул tag цэвэрлэгээгүйгээр
  хуучин үнэ харагдаж болзошгүй — **энэ алхмыг заавал** хийнэ.

## 9. Тест

- **Unit (vitest):** `sellable` дүрмийн хүснэгт — `isActive`/`inStock`/
  `bottleLocked`/`bottleOverride`-ийн 16 хослол; `startingPrice`, `soldOut`-ийн зөв утга.
- **Unit:** багцын `available` — эрэгтэй гишүүнтэй 10ml багц хаагдана, 5ml
  үлдэнэ; цэвэр unisex багцын 10ml хэвээр.
- **SQL:** transaction rollback дотор — `bottle_stock` унтраагаад
  `catalog_items`, `search_all()`, `variants_for_products()` гурвуулаа
  нийцэж буйг шалгах; `place_order` нь `BOTTLE_UNAVAILABLE` өгөх.
- **E2E (Playwright):** админ 10ml эрэгтэйг хаана → дэлгүүрийн эрэгтэй үнэрийн
  10ml disabled, 5ml идэвхтэй, unisex 10ml идэвхтэй; сагсанд байсан мөр
  анхааруулга өгнө; checkout зогсооно.
- PR-ээс өмнө: `pnpm typecheck` + `pnpm lint` + `pnpm test` цэвэр.

## 10. Хийх дараалал

| # | Ажил | Гаралт |
| --- | --- | --- |
| A | `0095_bottle_stock.sql` — хүснэгт, `bottle_active()`, RLS, 3 объектын дахин тодорхойлолт, `place_order` хамгаалалт | dev санд ажиллаж, SQL-ээр батлагдсан |
| B | `bottle-stock.ts` + `mapProduct()` + variant хэлбэр (`sellable`, `unavailableReason`) | нэг эх сурвалж |
| C | Админ: `/admin/bottles` хуудас, `PATCH /api/admin/bottles`, sidebar холбоос | админ хааж/нээж чадна |
| D | Дэлгүүрийн UI: барааны хуудас, карт, каталог | сайт дээр disabled харагдана |
| E | Багц (`collections`) + builder + сагс + checkout | багц, сагс зөв |
| F | Тест (unit + SQL + e2e), `docs/spec/development.md`-д §, `todo.md` тэмдэглэл | PR бэлэн |

Тооцоо: A ≈ 0.5 өдөр · B ≈ 0.5 · C ≈ 1 · D ≈ 0.5 · E ≈ 1 · F ≈ 0.5 →
**нийт ~4 өдөр**, нэг PR-т багтахааргүй тул A+B нэг PR, C+D+E нэг PR, F нэг PR.

## 11. Тодруулах асуултууд (клиент / шийдвэр)

1. ~~**Савны өнгө `products.gender`-ээр тодорхойлогдох уу?**~~
   ✅ **Шийдэгдсэн (2026-09-23):** тийм, `(gender, ml)` түлхүүр хэвээр.
   Орлуулах нь ердийн урсгал биш; ховор тохиолдолд админ тухайн бараа/хэмжээг
   `bottle_override`-оор гараар чөлөөлж, unisex саванд хийж явуулна (§3).
2. **2ml багтах уу?** `ML_SIZES` нь 2/5/10/20 — 12 хослол. 2ml нь өөр төрлийн
   саванд (атомайзер) орох бол хасна.
3. **Сар бүрийн 1ml бэлгийн sample** өөр савтай юу? Хэрэв мөн адил өнгөтэй бол
   `bottle_stock`-д 1ml мөр нэмнэ.
4. **Унтраалга vs тоо:** одоо гараар асаах/унтраах. Хожим «үлдсэн савны тоо»
   хөтөлж, 0 болоход автоматаар хаах хэрэгтэй юу? (2-р фаз болгож болно.)
5. **Хүлээгдэж буй захиалга:** хаахаас өмнө өгөгдсөн, төлбөр хүлээж буй эсвэл
   бэлтгэгдэж буй захиалгуудад тэр сав хэрэгтэй хэвээр. Тэдгээрийг **хөндөхгүй**
   гэж төлөвлөсөн — админд «энэ савыг хүлээж буй N захиалга» гэсэн жагсаалт
   хэрэгтэй юу?
6. **Текст:** «Түр байхгүй» гэж бичих үү, эсвэл энгийн «Дууссан» уу? (Ялгаж
   бичвэл хэрэглэгч дахин ирэхээ мэднэ.)
7. Хаагдсан үед барааны хуудсанд **«Ирэхэд мэдэгдэх»** товч хэрэгтэй юу?
   (Шинэ хүснэгт + и-мэйл — тусдаа ажил.)

## 12. Энэ фазад ОРОХГҮЙ

- Савны ширхэгийн нөөц, автомат хаалт/нээлт.
- «Ирэхэд мэдэгдэх» дараалал.
- Савны нийлүүлэлтийн захиалга, өртгийн тооцоо.
- Бараа тус бүрийн `product_variants.is_active`-ийн логик — хэвээр (савны
  түгжээ түүнээс **дээгүүр** давхар шүүлт болж ажиллана).
- Чөлөөлсөн бараанд «unisex саванд ирнэ» гэх мэт хэрэглэгчид харагдах тайлбар —
  чөлөөлөлт нь дотоод шийдвэр, дэлгүүрт ердийн идэвхтэй хэмжээ мэт харагдана.
