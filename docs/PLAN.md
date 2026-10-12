# PLAN: «Тун удахгүй» (coming_soon) барааны төлөв

> Энэ файл нь хэрэгжүүлэлтийн үнэн эх сурвалж. Reviewer agent энэ файлтай харьцуулж шалгана.
> Алхам бүрийн `- [ ]` нь **acceptance criteria**: бүгд биелсэн үед л тухайн алхмыг дууссан гэж үзнэ.

## Зорилго

Админ шинэ барааг худалдаанд гаргахаас өмнө дэлгүүрт «Тун удахгүй» төлөвтэйгөөр харуулах боломжтой болох. Ийм барааг харж болох ч худалдан авах боломжгүй. Нэгэнт худалдаанд гарсан бараа дахин «Тун удахгүй» болж чадахгүй.

## Үндсэн загвар

- `products.status`: `hidden` / `coming_soon` / `active`. **Үнэн эх сурвалж нь энэ багана.**
- `products.is_active`: хуучин кодтой нийцэхийн тулд хэвээр үлдэнэ. Доорх trigger-ээр `status`-тэй sync хийнэ.
- `products.launched_at`: анх `active` болох үед бөглөгдөнө. Дараа нь хэзээ ч өөрчлөгдөхгүй, null болохгүй.
- `products.coming_soon_note`: заавал биш текст.

### Sync дүрэм (BEFORE INSERT/UPDATE trigger)

| # | Нөхцөл | Үр дүн |
|---|---|---|
| S1 | INSERT, `status` өгсөн | `is_active := status = 'active'` |
| S2 | INSERT, зөвхөн `is_active` өгсөн (хуучин код) | `true → active`, `false → hidden` |
| S3 | INSERT/UPDATE, хоёуланг нь зөрүүтэй өгсөн | `STATUS_ACTIVE_MISMATCH` алдаа |
| S4 | UPDATE, зөвхөн `status` өөрчлөгдсөн | `is_active := status = 'active'` |
| S5 | UPDATE, зөвхөн `is_active` өөрчлөгдсөн | `true → active`, `false → hidden` |
| S6a | UPDATE, `status → active`, `launched_at` null | `launched_at := now()` |
| S6b | INSERT, `status = active` | `launched_at := coalesce(created_at, now())` |
| S7 | `old.launched_at` бөглөгдсөн, шинэ `status = coming_soon` | `ALREADY_LAUNCHED` алдаа |
| S8 | Caller `launched_at`-ийг INSERT болон UPDATE-ийн аль алинд нь бичих, өөрчлөх, null болгох | `LAUNCHED_AT_IMMUTABLE` алдаа. Зөвхөн trigger S6a/S6b-ээр бөглөнө |

Дэлгэрэнгүй үндэслэл: «Хэрэгжүүлэлтийн явцад өөрчилсөн зүйлс» хэсгийг үз.

INSERT дээр «өгсөн эсэх»-ийг ялгахын тулд `status`-ийг эхлээд default-гүй, nullable байдлаар нэмнэ. Backfill хийсний дараа `NOT NULL` болгоно.

---

## PR 1: DB + API + Админ (`feat/coming-soon-status`)

### 1.1 Migration `0125_product_coming_soon.sql`

> `0124` дугаарыг `feat/payment-page-updates` салбарын `0124_unpaid_order_to_saved.sql` эзэлсэн (dev санд аль хэдийн хэрэгжсэн) тул `0125` ашигласан.
> `0124` нь зөвхөн `feat/payment-page-updates`-д байгаа (`origin/dev` болон энэ хоёр салбарт байхгүй). `0125`/`0126`/`0127` нь түүнээс хамааралгүй: 0124-ийн үүсгэдэг объектуудын (`checkout_snapshot`, `saved_checkouts.source_order_id`, `save_order_for_later`, `abandon_unpaid_order`, `release_expired_reserves`, `orders_*` trigger) алийг нь ч хөндөхгүй, 0124 нь `place_order`-т хүрэхгүй. Runner нэрээр бүртгэдэг тул аль дарааллаар merge хийсэн ч ажиллана.

**Schema ба trigger**
- [ ] `product_status` enum болон `status`, `launched_at`, `coming_soon_note` баганууд нэмэгдсэн
- [ ] Sync trigger нь S1–S8 мөр бүрийг яг хүснэгтийн дагуу хэрэгжүүлсэн
- [ ] Backfill-ийн дараа `status` нь `NOT NULL` болсон

**Backfill (conservative)**
- [ ] `status` нь `is_active`-аас бөглөгдсөн
- [ ] Одоо байгаа бүх бараанд `launched_at = created_at`
- [ ] Хэзээ ч нийтлэгдээгүй ноорог бараа байвал prod migration-оос **өмнө** клиенттэй баталгаажуулж шийдсэн (0125 ажилласны дараа `launched_at`-ийг өөрчлөх боломжгүй)
- [ ] Candidate query migration checklist-д орсон:
  ```sql
  select id, name, created_at from products p
   where not is_active
     and not exists (select 1 from order_items where product_id = p.id);
  ```

**«Шинэ» таг**
- [ ] `refresh_new_tag()` нь `where p.status = 'active' order by p.launched_at desc, p.id desc` ашигладаг
- [ ] `trg_refresh_new_tag()`-ийг **`0103_auto_sale_tag.sql`-ийн нийлмэл (new/hot/sale) хувилбар** дээр үндэслэсэн. `0100`-аас хуулаагүй
- [ ] hot болон sale refresh хэвээр ажилладаг
- [ ] Хуучин болон шинэ trigger давхар үлдээгүй
- [ ] Products trigger нь `update of status, launched_at`-д ажилладаг
- [ ] Hot/sale функцууд `p.is_active`-ийг хэвээр ашиглана (шийдвэр, өөрчлөхгүй)

**RLS**
- [ ] Products read policy: `status in ('active','coming_soon') or is_staff()`

**`place_order` (эхний давталт)**
- [ ] Мөр бүрт нэг query-ээр шалгадаг:
  - `p.status = 'active'`, `for share` түгжээтэй
  - `pv.id = variant_id` ба `pv.product_id = p.id`
  - `pv.ml = ml` ба `pv.is_active`
  - `qty > 0`
- [ ] Бэлгийн мөр: `status = active` ба `ml = GIFT_SAMPLE_ML` шалгадаг
- [ ] Алдаа гарвал `ITEMS_UNAVAILABLE:<variant_id>` буцаадаг
- [ ] Шалгалт нь bottle/inventory reservation-аас **өмнө** хийгддэг (бүтэлгүйтвэл reservation commit болохгүй — rollback)

**`launch_product(p_id)` RPC**
- [ ] `update ... set status = 'active' where id = p_id and status = 'coming_soon' returning launched_at`
- [ ] Аль хэдийн `active` бол амжилттай (idempotent)
- [ ] Бусад тохиолдолд 409-д хөрвөх алдаа

### 1.2 Шийдвэр: RLS-ийн баганын ил байдал

- [ ] «Тун удахгүй» мөрүүд REST-ээр идэвхтэй бараатай ижил баганатайгаар уншигдахыг **ухамсартайгаар хүлээн зөвшөөрсөн**. Энэ ажилд засахгүй.

### 1.3 RLS өргөссөний дараах query аудит

- [ ] `from("products")` дууддаг 23 газар бүгд шалгагдсан
- [ ] RLS-д найдаж шүүлтгүй уншдаг storefront query бүрт `.eq("is_active", true)` нэмэгдсэн
- [ ] `getProductById` (захиалгын зам) зөвхөн active барааг буцаадаг хэвээр

### 1.4 API

- [ ] Constants: `PRODUCT_STATUSES` болон монгол шошгууд
- [ ] Zod: `status`, `comingSoonNote`
- [ ] Алдааны кодууд: `ALREADY_LAUNCHED` → 409, `STATUS_ACTIVE_MISMATCH` → 409
- [ ] Orders route: RPC-ийн `ITEMS_UNAVAILABLE:<id>` алдааг одоо байгаа `409 { error: "ITEMS_UNAVAILABLE", variantIds }` руу хөрвүүлдэг. Клиентийн код өөрчлөгдөөгүй
- [ ] Create route:
  - барааг үргэлж `hidden`-ээр insert хийдэг
  - variants, images, inventory, tags insert бүрийн алдааг шалгадаг
  - бүгд амжилттай болсны дараа л хүссэн төлөв рүү шилжүүлдэг
  - AI горимд зураггүй бол `hidden` хэвээр үлдэж, хариунд **бодит** төлөвийг буцаадаг
- [ ] `POST /api/admin/products/:id/launch`: `launch_product` RPC дууддаг, commit амжилттай болсны **дараа** `revalidatePublic()` дууддаг
- [ ] `POST /api/reviews`: бараа `active` биш бол 404

### 1.5 Админ UI

- [ ] Засах/шинэ барааны маягт: гурван сонголттой segmented control
- [ ] Бараа гарч байсан (`launched_at` бөглөгдсөн) бол «Тун удахгүй» сонголт идэвхгүй, тайлбартай
- [ ] Үлдэгдэлтэй «Тун удахгүй» бараа дээр «Худалдаанд гаргах» анхааруулга, launch endpoint дууддаг
- [ ] AI горимд: «Зураг бэлэн болоогүй тул "Нуусан" төлөвөөр хадгаллаа» toast
- [ ] StockAdjustDialog: restock амжилттай болсны дараа `coming_soon` бол «Худалдаанд гаргах уу?» асуулт, launch endpoint дууддаг
- [ ] Quick price dialog: зөвхөн үнэ ба хэмжээ. «Идэвхтэй» checkbox хасагдсан. Төлөвийг харуулах ч өөрчлөхгүй
- [ ] Жагсаалт: «Тун удахгүй» шүүлтүүр, «Бэлэн» badge, мөрийн цэсэнд «Худалдаанд гаргах»
- [ ] Админы нүүр: «Худалдаанд гаргахад бэлэн N бараа» сануулга
- [ ] Reservations badge болон export-ийн шошгонд шинэ төлөв орсон

### 1.6 Шалгалт

**Vitest**
- [ ] Zod schema
- [ ] Route-ийн 409 кодууд
- [ ] Launch endpoint-ийн idempotency
- [ ] Restock-ийн дараах асуулт
- [ ] Review POST-ийн хориг

**Dev сан дээрх SQL checklist**
- [ ] S1–S5, S7 мөр бүр
- [ ] S6a: UPDATE `hidden → active` үед `launched_at = now()`
- [ ] S6b: INSERT `status = active` үед `launched_at = coalesce(created_at, now())`
- [ ] `active → hidden → coming_soon` хориглогдсон
- [ ] S8: `launched_at`-ийг утга → өөр утга, утга → null болгох хориглогдсон
- [ ] S8 null → утга: хэзээ ч гараагүй (`hidden`/`coming_soon`) бараанд `launched_at` бичих хориглогдсон
- [ ] S8 INSERT: `launched_at` өгсөн INSERT хориглогдсон
- [ ] `place_order`: өөр барааны `variant_id`, `ml` зөрүү, inactive variant, coming_soon бэлэг тус бүр бүтэлгүйтэж, нөөц түгжигдээгүй

**Migration snapshot**
- [ ] Migration-ий өмнө/дараа active ба hidden тоо ижил
- [ ] «Шинэ» тагтай 12 барааны ID ижил

**Ерөнхий**
- [ ] `typecheck`, `lint`, `test` бүгд pass

---

## PR 2: Дэлгүүрийн тал (`feat/coming-soon-storefront`)

### 2.1 Domain type
- [ ] `mapProduct()`-д `comingSoon: boolean`
- [ ] «Тун удахгүй» үед бүх variant `sellable = false`
- [ ] Шошгын эрэмбэ: `comingSoon` > `soldOut`

### 2.2 Барааны хуудас
- [ ] `active` ба `coming_soon` хоёуланг буцаадаг **тусдаа** fetcher. `getProductById` хатуу хэвээр
- [ ] ProductPurchase (coming_soon үед):
  - үнэ ба хэмжээ харагдана
  - «Тун удахгүй» гэсэн идэвхгүй товч, доор нь `coming_soon_note`
  - quantity control, mobile buy bar, «Нөөцөд бэлэн · маргааш хүргэнэ» текст гарахгүй
  - add/buy tracking ажиллахгүй

### 2.3 Wishlist
- [ ] «Тун удахгүй» шошго
- [ ] «Бүгдийг сагслах» нь `!soldOut && !comingSoon` бараагаар шүүдэг
- [ ] `cheapestVariant` нь `sellable` хэмжээг сонгодог

### 2.4 SEO
- [ ] JSON-LD: «Тун удахгүй» үед `offers` байхгүй
- [ ] OG зурагт «Тун удахгүй» шошго
- [ ] Sitemap-д орсон

### 2.5 Нүүр хуудас
- [ ] Migration: `home_sections.kind`-д `'coming_soon'`
- [ ] `features/content/api.ts` resolver-т тусдаа салбар, `created_at desc` эрэмбэ
- [ ] Админ UI-д сонголт
- [ ] Хэсгийн мөрийг deploy-ийн **дараа** үүсгэнэ

### 2.6 Шалгалт
- [ ] Vitest: ProductPurchase coming_soon, wishlist шүүлт
- [ ] Playwright: «Тун удахгүй» хуудас нээгдэх ч сагслах боломжгүй
- [ ] `typecheck`, `lint`, `test` бүгд pass

---

## Нэвтрүүлэх дараалал

1. Backfill candidate жагсаалтыг клиенттэй баталгаажуулна.
2. PR 1: `db:migrate-dev` → SQL checklist → typecheck, lint, test → merge → `db:migrate-prod` → snapshot харьцуулалт.
3. PR 2: deploy → нүүрний хэсгийг нэмнэ → prod дээр нэг бараагаар шалгана.

## Аудитаас гарсан шийдвэрүүд (reviewer эдгээрийг алдаа гэж бүү тооцоорой)

- **PR-ийн тоо 2 хэвээр.** CLAUDE.md-д «migration ба түүнийг ашиглах код нэг PR-д» гэж заасан тул 1A/1B/2 болгон хуваахгүй.
- **OG-г тусад нь revalidate хийхгүй.** `revalidatePublic()` нь `revalidatePath("/", "layout")` хийдэг тул OG route-ийг ч цэвэрлэнэ.
- **Hot/sale функц `is_active`-ийг хэвээр ашиглана.** Sync trigger найдвартай тул.
- **Хуурамч захиалгын эрсдэл бага.** Orders route нь серверт шалгасан мөрүүдийг л дамжуулдаг. `place_order`-ийн шалгалт нь race ба нэмэлт хамгаалалтад зориулагдсан.
- **AI зураг үүссэний дараа автоматаар `coming_soon`/`active` болохгүй.** Энэ scope-д орохгүй.
- **Trigger S5 (`is_active=true` → `active`) нь «Тун удахгүй» барааг launch endpoint-гүйгээр гаргаж болох ч зөвшөөрөгдсөн.** S5-ын дараа S6 нь `launched_at`-ийг бөглөдөг тул бараа «гарсан» гэж зөв бүртгэгдэнэ, төлвийн өгөгдөл зөрөхгүй. Одоогийн TS код `products.is_active`-ийг бичдэггүй. Энэ зам зөвхөн скрипт эсвэл гар SQL-д үлддэг.
- **PATCH: `coming_soon → active` нь 409 `LAUNCH_REQUIRED`.** Шалгалт нь нөхцөлтэй UPDATE (`.neq("status", "coming_soon")`) тул урьдчилан уншиж шалгахаас ялгаатай нь хооронд нь завсар үлдэхгүй. Edit form дээр сан дээр «Тун удахгүй» байгаа бараанд «Идэвхтэй» сонголт хаалттай, оронд нь сонгогчийн доор «Худалдаанд гаргах» товч (launch endpoint) гарна.
- **`coming_soon → hidden → active` гэсэн хоёр алхамт зам зөвшөөрөгдсөн.** PATCH болон edit form-оор эхлээд «Нуусан», дараа нь «Идэвхтэй» болгож launch endpoint-гүйгээр гаргаж болно. `hidden → active`-ийг хаавал create route (бараа үргэлж `hidden`-ээр үүсч, төгсгөлд хүссэн төлөв рүү шилждэг) болон S5 эвдэрнэ. `launched_at`-ийн invariant хадгалагдана: S6 нь анх `active` болох үед `launched_at`-ийг бөглөдөг тул энэ замаар гарсан бараа ч «гарсан» гэж зөв бүртгэгдэж, дахин «Тун удахгүй» болж чадахгүй.
- **PATCH-ийн transaction болон `updated_at` (optimistic concurrency) нь тусдаа task.** Одоогоор `products.update` → variant upsert-ууд → inventory гэсэн бичилтүүд тус тусдаа явдаг. Variant upsert бүрийн алдааг шалгаж эхний алдаан дээр 500 буцаадаг ч өмнөх бичилтүүд буцаагдахгүй. Хоёр админы засварт сүүлд хадгалсан нь давамгайлна. RPC + `updated_at` шалгалт нь create route-тэй хамт «Scope-оос гадуур»-ын transaction task-д орно.
- **«Тун удахгүй» барааны хуудсанд «Төстэй бараа» гарахгүй.** `related_products` RPC (0059) эх барааг `is_active`-аар хайдаг тул «Тун удахгүй» бараа олдохгүй, жагсаалт хоосон ирнэ. Хэсэг нь `related.length > 0` нөхцөлтэй тул зүгээр нуугдана, алдаа гарахгүй. RPC-г өөрчлөхгүй.
- **JSON-LD-д `offers` байхгүй тул Search Console анхааруулга гарч болно, зөвшөөрнө.** Үнэлгээгүй «Тун удахгүй» бараанд `offers`, `review`, `aggregateRating` гурвуулаа байхгүй бол «Product snippet invalid» гэж мэдэгдэж болно. Төлөв түр зуурынх, бараа худалдаанд гармагц `offers` буцаж орно.

### Хэрэгжүүлэлтийн явцад төлөвлөгөөнөөс өөрчилсөн зүйлс

- **Нүүрний «Тун удахгүй» мөр нь `home_sections`-ийн шинэ төрөл биш, тогтмол хэсэг (2.5-ыг орлоно).** `src/app/(shop)/page.tsx`-ийн `ComingSoonSection` нь «Шинээр ирсэн»-ий дараа байрлах бөгөөд `getComingSoonProducts()`-оос уншина. `home_sections.kind`-ийн migration, resolver-ийн салбар, админ UI-ийн сонголт хийгдээгүй.
  - *Үндэслэл:* Админ UI-аас нүүрний мөр шинээр үүсгэх боломжгүй (`HomeSectionManager` зөвхөн байгаа мөрийн дараалал, агуулгыг засна). Тиймээс шинэ төрөл нэмсэн ч мөрийг migration-аар оруулах шаардлагатай байсан. Нүүрний бусад мөр (Эрэлттэй, Шинээр ирсэн, Онцгой санал) мөн код дотор тогтмол бичигдсэн байдаг. Хэсэг нь бараагүй үед огт гарахгүй тул «deploy-ийн дараа мөр үүсгэх» алхам шаардлагагүй болсон.
- **Quick price dialog нь төлөвийг зөвхөн харуулна (1.5 хэвээр; өмнөх «өөрчилж болно» гэсэн шийдвэрийг цуцалсан).** Цонхны нэр «Үнэ засах» болсон. Төлөвийг солих газар нь засах хуудас, «Тун удахгүй» барааг гаргах газар нь launch endpoint.
  - *Үндэслэл:* Review-гаар цонх нь «Тун удахгүй» барааг launch endpoint-гүйгээр шууд «Идэвхтэй» болгож чаддаг нь илэрсэн. Мөн хуучирсан цонх нь бусад админы засварыг дардаг (доорх PATCH-ийн шийдвэрийг үз).
- **Каталогийн «Шинэ» эрэмбэ ч `launched_at`-аар болсон (1.1-д нэмэлт).** `catalog_items` view-ийн `created_at` багана нь `coalesce(launched_at, created_at)` болсон. `mapProduct()`-ийн `createdAt` (санах ойн нөөц зам) ч мөн адил.
  - *Үндэслэл:* Зөвхөн `refresh_new_tag()`-ийг солих нь хангалтгүй байсан. Урьдчилан оруулсан ус гарахдаа «Шинэ» таг авах ч `catalog_search` болон нүүрний «Шинээр ирсэн» нь `created_at`-аар эрэмбэлдэг тул жагсаалтын ард орох байсан. Дэлгүүрт энэ багана зөвхөн эрэмбэлэхэд ашиглагддаг, огноо болгон хаана ч харагддаггүй тул утгыг нь солиход өөр нөлөө байхгүй.
- **S6-ийн INSERT салаа: `active` бараа оруулахад `launched_at = coalesce(created_at, now())` (`now()` биш).** UPDATE дээр S6 хэвээр `now()`. Caller `launched_at`-ийг өөрөө өгч чадахгүй (0127).
  - *Үндэслэл:* App код `products.created_at`-ийг бичдэггүй тул ердийн INSERT-д `created_at = now()` болж үр дүн нь ижил. Зөрүү зөвхөн түүхэн `created_at`-тай мөр оруулдаг import/clone-д гарна. Тэр мөч нь бодит нийтлэгдсэн огноонд хамгийн ойр.
- **Backfill: одоо байгаа БҮХ бараа «гарсан» гэж тооцогдсон, ноорог гэж үлдээсэн бараа байхгүй (1.1-ийн candidate мөрийг орлоно).** Migration нь бүх бараанд `launched_at = created_at` бөглөдөг бөгөөд онцгой жагсаалт агуулаагүй. Backfill нь зөвхөн анх удаа ажиллана (`products_status_sync` trigger байхгүй үед), дахин ажиллуулахад «Тун удахгүй» бараа эвдрэхгүй.
  - *Үндэслэл:* Өмнө нь нийтлэгдээд дараа нь нуугдсан барааг schema-аас таних арга байхгүй. Буруу таавал хуучин бараа «Тун удахгүй» болж каталогоос алга болох эрсдэлтэй тул болгоомжтой талыг сонгосон. Dev сан дээр нуусан бараа 0 байсан. Draft байвал prod migration-оос ӨМНӨ шийдэнэ: candidate query-ээр жагсааж, клиенттэй баталгаажуулна. 0125 ажилласны дараа `launched_at`-ийг өөрчлөх боломжгүй (trigger, 0127-оос хойш null → утга ч хориотой). Ийм бараа үлдсэн ч «Идэвхтэй» болгож шууд нийтэлж болно.

## Scope-оос гадуур (тусдаа task)

- `bottle_price`, `reference_image_url` нь REST-ээр нийтэд уншигдаж байгаа хуучин асуудал. 0125-ын RLS (`status in ('active','coming_soon')`) нь энэ хүрээг **«Тун удахгүй» бараа руу өргөжүүлсэн** — худалдаанд гараагүй барааны өртөг, эх савны зураг ч anon-д ил болно. **Анхны бодит «Тун удахгүй» бараа оруулахаас өмнө засна.**
- Барааны create/update-ийг бүрэн transaction (RPC) болгох. PATCH дээр `updated_at` эсвэл version-оор optimistic concurrency нэмж, quick price dialog-ийн хуучирсан snapshot бусдын засварыг дарахаас сэргийлэх.
