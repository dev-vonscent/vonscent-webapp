# Нэмэлт бараа ба савны тоон нөөц

> Төлөв: **v5 — хэрэгжүүлэхэд бэлэн**. v4-ийн PR0–10-т харгалзах код,
> migration 0144–0152 нь `feat/vial-inventory` локал салбарт хэрэгжсэн, push
> хийгээгүй. PR дугаарууд нь энэ баримтын төлөвлөлтийн шошго; remote PR нээгдсэн
> гэсэн үг биш.
> 2026-10-20-ны клиентийн эцсийн шаардлагыг бүх хэсэгт нэгтгэв. §0–§15 нь
> одоогийн хэрэгжсэн суурь ба өөрчлөгдөхгүй дүрэм, §18 нь 0153-аас эхлэх v5
> delta. Хоорондоо зөрөх дүрэм үлдээхгүй.
> Огноо: 2026-10-19 (v4), 2026-10-20 (v5)
> Feature flag: `extras_shop`, `vial_inventory`
> Салбар: `fix/loyalty-race` (§0), `feat/extras-shop`, `feat/vial-inventory`;
> v5-ыг түүн дээр шинэ `feat/extras-v5` салбарт үргэлжлүүлнэ.
> Холбоотой: `docs/planning/bottle-lock-plan.md` (0095), `docs/spec/design.md`,
> `docs/spec/development.md`
> Дизайн: Claude canvas «Нэмэлт бараа — каталог». Canvas дээрх «Мист»,
> «Шифриз» нь хуучин; зөрвөл энэ баримт давамгайлна.

## 0. Одоо байгаа алдаа — тусдаа, нэн түрүүнд засна

`place_order()` (0132:210) хэрэглэгчийн оноог **түгжихгүйгээр** уншдаг:

```sql
select loyalty_points into v_avail_points from profiles where id = v_user;
...
update profiles set loyalty_points = greatest(loyalty_points - v_points_used, 0) ...
```

10,000 оноотой хэрэглэгч хоёр checkout-ыг зэрэг илгээвэл хоёулаа 10,000-ыг
уншиж, 10,000 оноогоор **20,000₮** хөнгөлөлт авна. Энэ нь нэмэлт бараанаас
үл хамаарах, prod дээр одоо байгаа алдаа.

**Засвар (`fix/loyalty-race`, ~0.5 өдөр):**

1. Оноо уншихаас өмнө `select ... from profiles where id = v_user for update`.
2. Хүрэлцэхгүй оноог **чимээгүй багасгахгүй**: хэрэглэгчийн хүссэн оноо
   боломжтойгоос их бол `LOYALTY_CHANGED` (боломжтой оноотой) буцааж,
   захиалга үүсгэхгүй. Хэрэглэгч шинэ дүнг дахин батална.
3. SQL тест: сүүлийн оноогоо зэрэг хоёр захиалгад ашиглахад нэг нь амжилттай,
   нөгөө нь `LOYALTY_CHANGED`.

Энэ PR нэмэлт барааны ажлыг хүлээхгүй.

## 1. Зорилго

Нийт **5 ангилал** байна. Шинэ бараа, төрөл, хэмжээ, хувилбарын тоонд бизнесийн
хатуу дээд хязгаар тавихгүй.

| # | Ангилал | Тайлбар |
| --- | --- | --- |
| 1 | Хоосон шил | Хэрэглэгч өөрөө авч явах хоосон шил; нэг бараа олон ширхэг, batch code бүр өөр байж болно |
| 2 | Шприц | Хэмжээ бүр тусдаа үнэ, нөөцтэй |
| 3 | Грамын сав | Декант цутгадаг сав. 1/2/5/10/20ml бүгд нөөц, авсан үнэ, хэрэглээгээр тайлагнагдана; дангаар зөвхөн 5/10/20ml зарагдана |
| 4 | Шилтэй ус | Үлдэгдэлтэй эх шил болон бүтэн, лацтай шил |
| 5 | Гоёмсог бэлгийн сав | Хайрцаг, гоёмсог уут. Төрөл/хувилбар бүр чөлөөт нэр, зураг, чөлөөт хэмжээний тайлбар, үнэ, нөөцтэй |

`Брэндийн уут, сав`-ыг тусдаа зургаа дахь ангилал болгохгүй, `Гоёмсог
бэлгийн сав`-д нэгтгэнэ. Мист энэ удаад орохгүй (§16).

> Бэлгийн савны хувилбарын нэр, хэмжээг админ **чөлөөтэй бичнэ** («10ml-д
> тохирох», «Том · 8×5×4см», «20ml-ийн өндөр саванд тохирохгүй» гэх мэт).
> 5/10/20ml-тэй холбосон enum, mm-ийн бүтэцтэй талбар, тооны хязгаар байхгүй.

> Жишээ: ягаан 10ml сав 40 ширхэг байгаа гэж админ оруулна. Ягаан сав
> сонгогдсон үнэртнээс хэрэглэгч 10ml захиалахад зарах боломжтой тоо шууд
> **39** болно. Захиалга хүргэгдсэний дараа сав нөөцөөс бүрмөсөн хасагдана.

## 2. Шийдвэрүүд

### 2.1 Клиент

| # | Асуулт | Шийдвэр |
| --- | --- | --- |
| 1 | Хүйсээр өгөгдмөл савны өнгө | Эрэгтэй → Хар, Эмэгтэй → Ягаан, Unisex → Мөнгөлөг |
| 2 | Админ юуг тоолох вэ | Грамаар савлагдаад хүргэгдээгүй захиалгынхыг оруулаад **нийт** тоо |
| 3 | 1ml сав | Дангаар зарахгүй; бэлгийн дээжид хэрэглэнэ. Админ ширхэг, **нэгж авсан үнэ** оруулж, үлдэгдэл харна; худалдан авалт ба хэрэглээ тайланд орно |
| 4 | 2ml, 20ml сав | 2ml өнгөгүй бөгөөд дангаар зарахгүй; 20ml өнгөт бөгөөд дангаар зарж болно. Бүгдийн ширхэг, авсан үнэ, хэрэглээ тайланд орно |
| 5 | Төлсний дараа, хүргэхээс өмнө цуцлалт | Савыг нөөцөд буцааж нэмнэ, шаардлагатай бол админ засна |
| 6 | Грамын савыг тусад нь зарах | Зөвхөн 5/10/20ml-ийг зарна; үнийг админ бичнэ. Үнэртэнтэй нэг `vials` нөөцөөс хасагдана. 1/2ml нь зөвхөн дотоод хэрэглээ, тайланд орно |
| 7 | Үлдэгдэлтэй шил | Эх шил мөн. Ус нь эх үнэртний нөөцөөс түгжигдэнэ |
| 8 | Мист | Одоохондоо хийхгүй |
| 9 | Купон, V point | Нийт дүнд орно. Оноогоор төлж болно, оноо цуглуулна (түвшингийн хувиар) |
| 10 | Зөвхөн нэмэлт бараатай захиалга | Болно. Хүргэлтийн үнэ ижил |
| 11 | Нэр | «Шприц» |
| 12 | Гоёмсог бэлгийн сав | Үнэртэнтэй шууд холбохгүй. Төрөл/хувилбар бүр чөлөөт нэр, зураг, чөлөөт хэмжээний тайлбар, үнэ, нөөцтэй; олон ширхэгээр авч болно. Төрөл ба хэмжээнд хатуу дээд хязгааргүй |
| 13 | Сав цөөрөхөд | Хяналтын самбарын карт хангалттай |
| 14 | Үнэ | Бүх үнийг админ гараар бичнэ (0027) |

### 2.2 Техникийн

| # | Асуулт | Шийдвэр |
| --- | --- | --- |
| A | Энгийн нэмэлт барааг хэзээ хасах вэ | **Хүргэгдэх үед** (сав шиг). Шингэн төлбөрийн үед хасагддагаараа |
| B | Хүргэгдсэн нэмэлт бараа буцвал | Админ мөр бүрээр «Нөөцөд буцаах» тоог шийднэ |
| C | Хүргэгдсэн үлдэгдэлтэй шил буцвал | Шил, шингэн автоматаар буцахгүй. Админ гараар засна |
| D | Захиалах мөчид 1ml сав дууссан бол | Бэлгийг хасаад захиалга үргэлжилнэ, хэрэглэгчид мэдэгдэнэ |
| E | Сав дууссан үеийн `bottle_override` | Override нь орлох савны **өнгийг** хадгална |
| F | Ангилал засах хуудас | Хийхгүй, 5 ангилал seed; шинэ бараа/хувилбар/хэмжээг админ чөлөөтэй бичнэ |
| G | Бэлгийн дээжийн 200,000₮ босгод нэмэлт бараа орох уу | **Орно.** Босго нь купоны дараах барааны дүн (`src/lib/gift.ts`) — нэмэлт бараа ч бараа |
| H | Купон, оноо хүргэлтэд үйлчлэх үү | **Үгүй** — одоогийнх шиг зөвхөн барааны дүнд (`validate_coupon(p_subtotal)`, 0132:205). Зөвхөн нэмэлт бараатай захиалга ч оноо цуглуулна |
| I | НӨАТ | Одоо тооцдоггүй, энэ ажлаар өөрчлөгдөхгүй |
| J | Төлөвийн шилжилт | TS route-ийн хүснэгтийг SQL-д давхар шалгана, төлбөрийн төлөвтэй хамт (§6.4) |
| K | Баталсан дүн | Захиалгын бодит нийт дүн хэрэглэгчийн хамгийн сүүлд баталснаас **чимээгүй өөрчлөгдөхгүй** (§6.2) |
| L | Цуцлагдсаныг сэргээхэд купон, оноо | Одоогийн 0141-ийн дүрэм хэвээр: сэргэхгүй, захиалгын хадгалсан дүн хэвээр. Энэ ажлаар өөрчлөхгүй (§16) |

## 3. Одоогийн байдал (код дахь баримт)

**Сав:** `bottle_stock` (0095) — `(gender, ml)` 12 мөр, асаах/унтраах.
`bottle_active()` → `variant_sellable()` → `catalog_items`, `global_search()`,
`product_variants_for()`, `place_order()`. `/admin/bottles` нь «Каталог»
бүлэгт. `BOTTLE_STYLES` зөвхөн зураг сонгоход. `bottle_override boolean` өнгө
хадгалдаггүй.

**Шингэн:** `inventory.on_hand_ml`, `reserved_ml` (0004) — reserve нь нэг нийт
тоо, эзэнгүй. `place_order` мөрүүдийг ирсэн дарааллаар reserve хийнэ (0132:60).
Төлбөрт `commit_inventory`.

**Захиалга үүсгэх урсгал (`app/api/orders/route.ts`):**

- `computeSummary(input)` (TS) — мөр, хүргэлтийн бүс, хүргэлтийн үнэ.
- Бэлгийн эрх, бэлгийн мөрийг **TS дотор** transaction-аас өмнө бодно
  (`validate_coupon` + `priceGiftLines`).
- `place_order` — сул мөрийн үнийг сангаас, багцын үнийг TS-ээс,
  `shipping_fee`-г TS-ээс авна. Буцаах нь зөвхөн `order_no, total`.
- Хариунд transaction-аас **өмнөх** `summary` буцна.
- Давхар илгээлтээс `request_id` хамгаална (0087, `claimOrderRequest`).

**Купон, оноо:** купон хүчингүй болсон бол `place_order` хөнгөлөлтийг
чимээгүй 0 болгоно (0132:194), оноог боломжтой хэмжээ хүртэл чимээгүй
багасгана (0132:211). Иймээс хэрэглэгчийн харснаас өндөр дүнтэй QPay нэхэмжлэх
үүсэх боломжтой — §6.2-оор засна.

**Төлөвийн шилжилт:** `api/admin/orders/[id]/status/route.ts`-д хүснэгт бий —
`pending → confirmed | cancelled`, `confirmed → shipping | cancelled`,
`shipping → delivered | confirmed | cancelled`; super_admin сэргээлт:
`delivered → shipping`, `cancelled → pending`. Буцаасан (`refunded`)
захиалгыг хаадаг. Харин **төлөөгүй захиалгыг гараар `shipping`, `delivered`
болгохыг хориглодоггүй** (cron `auto_dispatch_orders` л `paid` шалгадаг,
0032:231). **SQL** (`update_order_status`) юуг ч шалгадаггүй.

**Буцаалт:** `mark_order_refunded(p_order, p_by, p_fee, p_restock)` (0114) —
restock нь захиалга бүхэлдээ, `v_ml := v_ml + v_item.ml * v_item.qty`.

**`order_items` (0006):** `ml not null check (ml > 0)`, `product_name`,
`brand` not null. `{ml}ml × qty` гэж уншдаг газар: Telegram, имэйл, админ,
хэрэглэгчийн захиалга, нэхэмжлэх, тайлан (0074, 0111).

**Сагс:** `CartState { items, collections }`, `CartItem` заавал `ml`.

**Хамгийн сүүлийн функцийн хувилбар:**

| Функц | Migration |
| --- | --- |
| `place_order` | `0132_place_order_variant_lock.sql` (+ §0-ийн засвар) |
| `update_order_status` | `0141_notify_orders.sql` |
| `mark_order_paid` | `0143_user_tiers.sql` |
| `release_expired_reserves` | `0124_unpaid_order_to_saved.sql` |
| `mark_order_refunded` | `0114_delivered_refund_keeps_shipping.sql` |
| `global_search`, `product_variants_for`, `variant_sellable` | `0095_bottle_stock.sql` |
| `catalog_items` (view) | `0125_product_coming_soon.sql` |

**Тоо:** мөнгөн багана бүгд `int`, `qty ≤ 99` (validator). Postgres
`create or replace function` нь signature өөрчлөгдвөл **шинэ overload**
үүсгэдэг — хуучныг `drop function`-оор устгасан жишээ: 0111, 0112, 0129.
Buy-now урсгал (`cart/page.tsx`, `checkout/page.tsx`) бий. Тайлан
`admin_report_events()` (0114) нь захиалга бүрт нэг `goods` дүн гаргана.

**Бусад:** `data-table`-ийн `renderCard` (утсан дээр карт). Playwright demo
горим; screenshot-ууд харьцуулалт биш. SQL тест `scripts/test-*.ts` +
`pnpm db:test-*-dev`.

## 4. Ангилал ба нөөцийн горим

Target v5-д **5 идэвхтэй ангилал**, 3 нөөцийн горим байна. Checkout, нөөцийн
код горимоор салбарлана — ангиллын slug-аар биш. Барааны горим үүссэний дараа
өөрчлөгдөхгүй.

| Ангилал | Зөвшөөрөх горим | Нөөц |
| --- | --- | --- |
| Хоосон шил, Шприц, Гоёмсог бэлгийн сав | `local_quantity` | хувилбар бүрт ширхэгээр |
| Грамын сав | `shared_vial` | `vials` (үнэртэнтэй хуваалцана) |
| Шилтэй ус | `leftover_liquid`, `local_quantity` | үлдэгдэлтэй эх шил эсвэл бүтэн, лацтай шил |

`brand-pouch`-ийн барааг `gift-box` руу шилжүүлээд ангиллыг идэвхгүй болгоно;
`leftover`-ийг `bottled` / «Шилтэй ус» болгоно.

**Өргөтгөх хүрээ:** эдгээр горимын дотор шинэ бараа, төрөл, хэмжээ,
хувилбар нэмэхэд schema өөрчлөхгүй. Бизнесийн `1–3 төрөл`, `5/10/20` гэх мэт
хатуу enum/check байхгүй. Шинэ нөөцийн горим нэмэхэд л enum, SQL мөчлөг,
админы форм, checkout өөрчлөгдөнө.

**Олон горимын best practice:** category дээр `modes[]` массив хадгалахгүй.
PostgreSQL-ийн зөвлөмжийн дагуу array-г set/relationship болгон ашиглахын оронд
`extra_category_modes(category_id, inventory_mode)` холбоос хүснэгт хэрэглэнэ.
Ингэснээр `(category_id, inventory_mode)` composite FK нь горимын зөвшөөрлийг
DB түвшинд trigger-гүй хамгаалж, давхардал ба хоосон/NULL array-ийн тусгай
шалгалт шаардахгүй. Эх сурвалж: [PostgreSQL Arrays — arrays are not sets](https://www.postgresql.org/docs/current/arrays.html).

Холбоос хүснэгт нь горим тус бүрийн `notice`, `requires_consent`-ийг хадгална
(«Шилтэй ус»-ны үлдэгдэлтэй шил ба бүтэн шил өөр анхааруулгатай, §18.5).

0145-д хэрэгжсэн `extra_categories.inventory_mode`-ийг 0153 **дотор** устгана.
Нэмэлт барааны хүснэгтүүд prod-д хараахан байхгүй тул expand/contract-ийн
тусдаа contract алхам шаардлагагүй (§18.3).

## 5. Өгөгдлийн загвар

Энэ хэсэг нь 0144–0152-т хэрэгжсэн v4 baseline schema. v5-ийн 0153 нь prod-д
гараагүй extras schema-г §18.3-ын дагуу нэг migration-д contract хийж болно;
харин prod-д байгаа `restock_log` зэрэг хүснэгтэд backward-compatible default,
UB backfill хэрэглэнэ. Хүснэгт хоорондын FK-ийн дарааллыг §15 тогтооно.

### 5.1 Нэмэлт бараа

```sql
create type extra_inventory_mode_t as enum
  ('local_quantity', 'shared_vial', 'leftover_liquid');

create table extra_categories (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name           text not null,
  inventory_mode extra_inventory_mode_t not null,
  image_url      text,
  sort           int not null default 0,
  is_active      boolean not null default true,
  unique (id, inventory_mode)
);

create table extra_products (
  id             uuid primary key default gen_random_uuid(),
  category_id    uuid not null references extra_categories(id),
  inventory_mode extra_inventory_mode_t not null,   -- ангиллаас хуулна, өөрчлөгдөхгүй
  slug           text not null unique,
  name           text not null,
  description    text not null default '',
  images         text[] not null default '{}',
  status         text not null default 'draft'
                 check (status in ('draft', 'published', 'archived')),
  product_id     uuid references products(id),       -- leftover-ийн эх үнэртэн
  remaining_ml   int check (remaining_ml > 0),        -- leftover
  full_ml        int check (full_ml > 0),             -- leftover
  attrs          jsonb not null default '{}',         -- зөвхөн дэлгэцийн утга (capacity)
  sort           int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, inventory_mode),
  foreign key (category_id, inventory_mode)
    references extra_categories (id, inventory_mode),
  check ((inventory_mode = 'leftover_liquid')
         = (product_id is not null and remaining_ml is not null and full_ml is not null)),
  check (remaining_ml is null or remaining_ml <= full_ml)
);

create table extra_variants (
  id             uuid primary key default gen_random_uuid(),
  extra_id       uuid not null,
  inventory_mode extra_inventory_mode_t not null,
  label          text not null default '',
  price          int not null check (price between 0 and 10000000),
  on_hand_qty    int not null default 0 check (on_hand_qty >= 0),
  reserved_qty   int not null default 0 check (reserved_qty >= 0),
  vial_id        uuid references vials(id),
  is_active      boolean not null default true,
  sort           int not null default 0,
  foreign key (extra_id, inventory_mode)
    references extra_products (id, inventory_mode),
  check ((inventory_mode = 'shared_vial') = (vial_id is not null)),
  check (inventory_mode = 'shared_vial'
         or reserved_qty <= on_hand_qty),
  check (inventory_mode <> 'shared_vial'
         or (on_hand_qty = 0 and reserved_qty = 0)),
  check (inventory_mode <> 'leftover_liquid' or on_hand_qty <= 1),
  unique (id, extra_id, inventory_mode)
);
create unique index extra_variants_one_leftover
  on extra_variants (extra_id) where inventory_mode = 'leftover_liquid';
-- Давхар хувилбараас хамгаална
create unique index extra_variants_label_uq
  on extra_variants (extra_id, lower(btrim(label)))
  where inventory_mode = 'local_quantity';
create unique index extra_variants_vial_uq
  on extra_variants (extra_id, vial_id) where inventory_mode = 'shared_vial';

create table extra_movements (
  id               bigserial primary key,
  extra_variant_id uuid not null references extra_variants(id),
  kind             text not null check (kind in
                     ('set', 'reserve', 'release', 'commit', 'restock')),
  delta_on_hand    int not null default 0,
  delta_reserved   int not null default 0,
  order_item_id    uuid references order_items(id),
  note             text not null default '',
  actor            uuid references profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);
```

- Composite FK нь ангилал → бараа → хувилбарын горимыг **заавал** ижил болгоно —
  горим зөрөх өгөгдөл import script-ээр ч үүсэхгүй.
- `inventory_mode`, `category_id`-ийг өөрчлөхийг trigger хориглоно.
- Нэмэлт бараа, хувилбар, ангиллыг **устгахыг trigger хориглоно** (service role
  RLS-ийг тойрдог тул бодлого хангалтгүй) — зөвхөн архивлана.
- Тооцоонд орох утга (`remaining_ml`, `full_ml`) typed багана; `attrs` нь зөвхөн
  дэлгэцийн (`capacity`), Zod + RPC дотор шалгана.
- Үнийн дээд хязгаар 10,000,000₮, `qty ≤ 99` → мөрийн дүн `int`-д багтана.
  Нийлбэрийг `bigint`-ээр бодоод `int`-ийн хязгаараас хэтэрвэл
  `ORDER_TOO_LARGE`.

### 5.2 Савны тоон нөөц

```sql
create table vials (
  id            uuid primary key default gen_random_uuid(),
  style         text check (style in ('black', 'pink', 'silver')),
  ml            int not null check (ml in (1, 2, 5, 10, 20)),
  on_hand       int check (on_hand >= 0),   -- null = тоолж эхлээгүй
  reserved      int not null default 0 check (reserved >= 0),
  low_threshold int not null default 10,
  is_active     boolean not null default true,
  note          text not null default '',
  updated_by    uuid references profiles(id) on delete set null,
  updated_at    timestamptz not null default now(),
  check ((ml in (1, 2)) = (style is null)),
  check (on_hand is null or reserved <= on_hand)
);
create unique index vials_style_ml_uq on vials (coalesce(style, '-'), ml);
-- vial_movements: extra_movements-тэй ижил бүтэц, vial_id-тай
```

- Seed 11 мөр (9 өнгөт + 2ml + 1ml), `on_hand = null`.
- `on_hand = null` нь «тоолж эхлээгүй» — зарах боломж **хязгааргүй** гэж
  тооцогдоно, гэхдээ **reserve үргэлж бичигдэнэ** (`reserved` өснө,
  `vial_state = 'reserved'`). Ингэснээр тоолж эхлэхээс өмнө орсон хүргэгдээгүй
  захиалгууд алга болохгүй: админ 40 гэж оруулахад тэр мөчид захиалгад байгаа
  10 нь «Захиалгад орсон»-д харагдана, зарах боломжтой 30. Хүргэгдэхэд хасагдана.
- Тоолж эхлэх: `set_vial_count(p_count)` нь `p_count >= reserved` шалгана.
- `vial_for(style, ml)` — хэрэгтэй савны `id`; ml ≤ 2 бол өнгөгүй мөр.
- `set_vial_count`: мөрийг `for update`, `p_count >= reserved` шалгаж,
  хөдөлгөөнтэй нэг transaction-д.

### 5.3 Үнэртний сав

```sql
alter table products add column if not exists vial_style text
  check (vial_style in ('black', 'pink', 'silver'));
alter table product_variants add column if not exists bottle_override_style text
  check (bottle_override_style in ('black', 'pink', 'silver'));
```

`vial_style = null` → хүйсээр. Барааны формын «Савны зураг» сонголт мөн
хадгална. Тоон горимд override асаасан бол өнгө заавал.

### 5.4 Захиалгын мөр

```sql
alter table order_items
  add column if not exists line_kind text not null default 'perfume'
    check (line_kind in ('perfume', 'extra')),
  add column if not exists extra_variant_id uuid,
  add column if not exists extra_product_id uuid,
  add column if not exists extra_inventory_mode extra_inventory_mode_t,
  add column if not exists variant_label text,
  add column if not exists image_url text,
  add column if not exists extra_state text
    check (extra_state in ('reserved', 'committed', 'released')),
  add column if not exists vial_id uuid references vials(id),
  add column if not exists vial_state text
    check (vial_state in ('reserved', 'committed', 'released')),
  add column if not exists restocked_qty int not null default 0
    check (restocked_qty >= 0 and restocked_qty <= qty);

alter table order_items alter column ml drop not null;

-- Хувилбар нь snapshot-ийн бараанд үнэхээр харьяалагдана
alter table order_items add constraint order_items_extra_fk
  foreign key (extra_variant_id, extra_product_id, extra_inventory_mode)
  references extra_variants (id, extra_id, inventory_mode);

alter table order_items add constraint order_items_kind_chk check (
  (line_kind = 'perfume'
     and ml is not null and extra_variant_id is null
     and extra_product_id is null and extra_state is null
     and restocked_qty = 0)
  or
  (line_kind = 'extra'
     and ml is null and product_id is null and variant_id is null
     and collection_id is null and not is_gift and not is_sample
     and extra_variant_id is not null and extra_product_id is not null
     and extra_inventory_mode is not null and extra_state is not null
     and ((extra_inventory_mode = 'shared_vial') = (vial_id is not null)))
);
alter table order_items add constraint order_items_vial_chk check (
  (vial_id is null) = (vial_state is null)
);
-- Мөнгөний invariant: шинэ мөрөнд (хуучин өгөгдлийг шалгасны дараа VALIDATE)
alter table order_items add constraint order_items_line_total_chk
  check (line_total = unit_price * qty) not valid;
alter table orders add constraint orders_total_chk
  check (total = subtotal + shipping_fee - discount - loyalty_used
         and discount <= subtotal
         and loyalty_used <= subtotal - discount) not valid;
```

- Нэмэлт барааны мөрөнд: `product_name` = барааны нэр, `brand` = ангиллын
  нэр, `variant_label` = «Хар». Грамын савны мөр `vial_id`-тай.
- Мөрийн `extra_product_id`, нэр, үнэ, зураг нь зарсан мөчийн хуулбар —
  хожим өөрчлөгдөхгүй.
- TS: `OrderItemRow` нь `line_kind`-аар discriminated union.

### 5.5 Үлдэгдэлтэй шилний шингэний түгжээ

```sql
-- Нэг үлдэгдэлтэй шил = нэг физик шил = НЭГ түгжээний мөр (байнгын).
-- Эх үнэртнийг extra_products.product_id-аас уншина, давхар хадгалахгүй.
create table leftover_liquid_locks (
  extra_product_id uuid primary key references extra_products(id),
  locked_ml        int not null check (locked_ml > 0),
  state            text not null
                   check (state in ('listed', 'reserved', 'committed', 'released')),
  order_item_id    uuid references order_items(id),
  updated_at       timestamptz not null default now(),
  check ((state in ('reserved', 'committed')) = (order_item_id is not null))
);
```

Шилжилт (бүгд мөрийг `for update`, хүлээгдэж буй төлөв + `order_item_id`-аар):

| Үйлдэл | Төлөв | `inventory.reserved_ml` |
| --- | --- | --- |
| Нийтлэх | — → `listed` | `+ locked_ml` |
| Захиалах | `listed` → `reserved` (+ `order_item_id`) | — |
| Захиалга цуцлагдах | `reserved` → `listed` (`order_item_id = null`) | — |
| Хүргэгдэх | `reserved` → `committed` | `− locked_ml`, `on_hand_ml − locked_ml` |
| Нуух / архивлах | `listed` → `released` | `− locked_ml` |
| Дахин нийтлэх | `released` → `listed` (ижил мөр) | `+ locked_ml` |
| `committed` | эцсийн төлөв — дахин нийтлэх, зарах боломжгүй | — |
| Цуцлагдсаныг сэргээх | `listed` → `reserved` зөвхөн өөр захиалгад ороогүй бол; эс бөгөөс `LEFTOVER_RESTORE_CONFLICT`, сэргээлт бүхэлдээ татгалзана | — |

**ml засах** (`listed` үед л, ижил мөрийг шинэчилнэ):

```text
сольж болох дээд хэмжээ = on_hand_ml − reserved_ml + хуучин locked_ml
reserved_ml += шинэ locked_ml − хуучин locked_ml
```

Жишээ: 100ml-ийн 2 шил, нэгд нь 10ml → нийт 110. Нийтлэхэд декант 100,
хүргэгдэхэд нийт 100. Захиалгад орсон шилийг засах, нуух, эх үнэртнийг солих
боломжгүй.

### 5.6 Эрх ба RLS

- Шинэ RPC бүр `revoke all ... from public, anon, authenticated; grant
  execute ... to service_role;`. Дэлгүүрийн `vial_available` л anon-д.
- Бүх шинэ хүснэгт RLS-тэй. Нийтийн унших: бараа `published` **ба** ангилал
  идэвхтэй; хувилбар эцгээрээ. Хөдөлгөөн, түгжээ зөвхөн `is_staff()`.
- Туг: `feature_flags`-д хоёр түлхүүр + `FEATURE_FLAGS` (constants).

## 6. Захиалга, нөөц, мөнгөний дүрэм

### 6.1 Мөнгөний invariant

```text
line_total   = unit_price × qty               (бэлгийн мөр 0)
subtotal     = Σ line_total                    (үнэртэн + багц + нэмэлт)
discount     = validate_coupon(subtotal)       (хүргэлтэд үйлчлэхгүй)
loyalty_used ≤ subtotal − discount             (хүргэлтийг оноогоор төлөхгүй)
total        = subtotal + shipping_fee − discount − loyalty_used
бэлгийн эрх  = min(⌊(subtotal − discount) ÷ 200,000⌋, GIFT_MAX_SAMPLES)
оноо         = mark_order_paid (0143): (subtotal − discount) × түвшний хувь
```

- Бүх дүн integer ₮. Нийлбэрийг `bigint`-ээр бодно (§5.1). НӨАТ тооцохгүй.
- `orders_total_chk`, `order_items_line_total_chk` (§5.4) нь эдгээрийг DB
  түвшинд хамгаална; reconciliation (§14) зөвхөн илрүүлнэ.
- Буцаалт: барааны мөнгө ба хүргэлтийн мөнгө тусдаа (0114-ийн дүрэм хэвээр).
- Тайлан: `admin_report_events()` захиалга бүрт **нэг** event хэвээр (захиалгын
  тоо, хүргэлт, купон, оноо, QPay шимтгэл давхар тоологдохгүй), дээр нь
  `perfume_goods`, `extras_goods`, `perfume_ml` тусдаа багана.
  `perfume_goods + extras_goods = goods`. Купон, оноог мөрийн төрөлд хуваахгүй —
  захиалгын түвшинд үлдэнэ.
- Буцаалт: **мөнгө** (0114-ийн дүрмээр, захиалгын түвшинд) ба **физик бараа
  нөөцөд буцаах** (§6.5) хоёр тусдаа шийдвэр. UI дээр тусдаа хэсэгт.

### 6.2 `place_order` — нэг authoritative transaction

1. **Нэгтгэл:** шаардлагыг түлхүүрээр нь нийлүүлнэ — шингэн `product_id`,
   нэмэлт бараа `extra_variant_id`, сав `vial_id`, шил `extra_product_id`.
2. **Түгжих дараалал** (тус бүр `id`-аар эрэмбэлж `for update`):
   `profiles → coupons → products → product_variants → inventory →
   extra_products → extra_variants → vials → leftover_liquid_locks`.
   Одоогийн купоны түгжээ (захиалга үүссэний дараа) энэ дараалал руу шилжинэ.
3. **Үнэ сангаас.** Нэмэлт барааны мөр бүр client-ийн харсан үнийг
   `expected_unit_price`-аар дамжуулна. Сангийнх зөрвөл `EXTRA_PRICE_CHANGED`
   (шинэ үнийн хамт) — сервер үнийг чимээгүй өөрчлөхгүй, хэрэглэгч дахин
   батална. Тоо хүрэхгүй бол `EXTRA_QTY_UNAVAILABLE` (боломжтой тоотой).
4. **Бэлэг transaction дотор.** Бэлгийн эрхийг §6.1-ээр дахин бодно. Эрхээс
   илүү эсвэл 1ml сав дууссан бэлгийн мөрийг оруулахгүй, захиалга үргэлжилнэ.
   Босгыг SQL `gift_entitlement()` функцэд, TS `src/lib/gift.ts`-тэй тэнцүү
   гэдгийг тестээр баталгаажуулна.
5. **Баталсан дүн өөрчлөгдөхгүй (§2.2 K).** Checkout хүсэлт урьдчилж харуулсан
   дүнгүүдийг дамжуулна: `expected_subtotal, expected_discount,
   expected_loyalty_used, expected_shipping_fee, expected_total`. SQL дахин
   бодсон утга аль нэгээрээ зөрвөл захиалга **үүсэхгүй**:
   `COUPON_CHANGED`, `LOYALTY_CHANGED`, `SHIPPING_CHANGED`, `TOTAL_CHANGED`
   (шинэ утгуудын хамт). Купоныг чимээгүй 0 болгох, оноог чимээгүй багасгах
   одоогийн зан төлөв ингэж солигдоно. Сагс устгагдахгүй — шинэ дүнг
   харуулаад хэрэглэгч дахин батална. Бэлэг хасагдсан нь subtotal-д
   нөлөөлөхгүй (0₮) тул зөвшөөрөгдөнө, мэдэгдэнэ.
6. **Хариу.** RPC нь хадгалсан утгуудаас summary буцаана:
   `{ order_id, order_no, subtotal, discount, loyalty_used, shipping_fee,
   total, lines, omitted_gifts: [{ product_id, reason: 'threshold' | 'vial' }] }`.
   `omitted_gifts` нь захиалгад хадгалагдана. Route болон `request_id`-ийн
   дахин илгээлт (`describeExistingOrder`) зөвхөн **сангаас** уншсан энэ
   summary-г буцаана, TS-ийн урьдчилсан тооцоог биш.
7. `shipping_fee` бүсээр TS-ээс тооцогддог хэвээр, гэхдээ `expected_shipping_fee`
   -тэй тулгана, хариу нь хадгалсан утгаас.
8. Мөрийн дараалал, хасагдсан бэлэг, дүн нь reload / retry үед сангаас ижил
   (deterministic) буцна. `request_id`-ийн давхар илгээлт ижил summary өгнө.
9. Buy-now урсгал ч нэмэлт бараа (ганцаараа ч) дэмжинэ.

### 6.3 Нөөцийн мөчлөг

| Үйл явдал | Шингэн | Сав (`vial_state`) | Энгийн нэмэлт (`extra_state`) | Үлдэгдэлтэй шил |
| --- | --- | --- | --- | --- |
| `place_order` | reserve | → `reserved` | → `reserved` | `listed` → `reserved` |
| Төлбөр | **commit** | хэвээр | хэвээр | хэвээр |
| Хүргэлт (cron орно) | — | → `committed` | → `committed` | → `committed` |
| Хугацаа дуусах | release | → `released` | → `released` | → `listed` |
| Хүргэхээс өмнө цуцлах | release / буцаах | → `released` | → `released` | → `listed` |
| Сэргээх (`cancelled → pending`) | reserve | → `reserved` | → `reserved` | §5.5 (зөрчилтэй бол татгалзана) |
| Буцаах хүргэлт (`delivered → shipping`) | — | `committed` хэвээр | `committed` хэвээр | `committed` хэвээр |
| Хүргэгдсэний дараах буцаалт | `p_restock` | хөдлөхгүй | мөр бүрээр (§6.5) | хөдлөхгүй |

**Дүрмүүд:**

1. **Idempotent:** төлөв зөвхөн хүлээгдэж буй өмнөх утгаас шилжинэ.
   Хөдөлгөөний мөр бүр `event_key`-тэй, `unique (event_key)`:
   `<order_item_id>:<resource>:<kind>:<orders.lifecycle_cycle>`.
   `orders.lifecycle_cycle int default 0` нь `cancelled → pending` сэргээлт
   бүрт нэмэгдэнэ — сэргээлтийн дараах дахин reserve нь шинэ түлхүүртэй.
   Restock-ийн түлхүүр нь refund operation id. Төлөвийн шилжилт, тооны өөрчлөлт,
   хөдөлгөөн нэг түгжсэн RPC дотор.
2. **Туг:** унтарсан үед **шинэ** reserve, шинэ listing үүсэхгүй. Өмнө үүссэн
   төлөвийн commit / release / сэргээлт **ба тэдгээрийн хөдөлгөөний бичлэг**
   тугаас үл хамааран үргэлж ажиллана. `null` төлөвтэй (хуучин) мөрийг алгасна.
3. **Сав дууссан бол** захиалга `VIAL_UNAVAILABLE`-ээр зогсоно (бэлгээс бусад).
4. Мөр бүр `qty` сав. 2ml-ийн бүх мөр өнгөгүй 2ml савнаас. Багц гишүүн бүр
   өөрийн савтай.

Жишээ — ягаан 10ml, админ 40:

| Үйл явдал | Нийт | Захиалгад | Зарах боломжтой |
| --- | --- | --- | --- |
| Админ 40 гэж оруулна | 40 | 0 | 40 |
| 10ml захиална | 40 | 1 | **39** |
| Төлбөр | 40 | 1 | 39 |
| Хүргэгдэнэ | 39 | 0 | 39 |
| *Эсвэл:* хүргэхээс өмнө цуцлагдана | 40 | 0 | 40 |

### 6.4 Төлөвийн шилжилт SQL-д

`update_order_status()` side effect хийхээс **өмнө** route-ийн хүснэгтийг
давхар шалгана, эс бөгөөс `ILLEGAL_TRANSITION`:

```text
pending   → confirmed | cancelled
confirmed → shipping | cancelled
shipping  → delivered | confirmed | cancelled
delivered → (super_admin) shipping
cancelled → (super_admin) pending — бүх нөөцийг дахин авч чадвал л
```

Нэмэлт дүрэм (захиалгын мөрийг `for update` түгжсэний дараа SQL шалгана):

```text
shipping, delivered        → payment_status = 'paid' заавал (PAYMENT_REQUIRED)
payment_status = 'refunded' → ямар ч идэвхтэй төлөв рүү орохгүй
mark_order_paid            → зөвхөн pending / confirmed захиалгад
ижил төлөв дахин өгөх       → бүрэн no-op (side effect, мэдэгдэлгүй)
```

Cron (`auto_dispatch_orders`, `auto_deliver_orders`) мөн энэ функцээр дамждаг
тул ижил хамгаалалт авна. Эрх (super_admin)-ийг route шалгана; SQL нь шилжилт
хууль ёсны эсэхийг. Хожуу ирсэн QPay callback цуцлагдсан/буцаасан захиалгад
юу ч өөрчлөхгүй (одоогийн 0073-ийн дүрэм) — тестээр баталгаажуулна.

### 6.5 Мөр бүрийн буцаалт

`mark_order_refunded`-д нэмэлт параметр:

```json
{ "extra_restocks": [{ "order_item_id": "…", "restocked_qty": 1 }] }
```

- `restocked_qty` нь **эцсийн нийт тоо** (нэмэх тоо биш) — ижил хүсэлт давтан
  ирвэл зөрүү 0, нөөц хоёр удаа нэмэгдэхгүй.
- Шалгалт: мөр тухайн захиалгынх, `line_kind = 'extra'`, бараа
  `local_quantity`, `extra_state = 'committed'`, `0 ≤ restocked_qty ≤ qty`,
  буурахгүй. Сав, үлдэгдэлтэй шилийн мөрийг хүсэлтэд оруулбал татгалзана.
- Хөдөлгөөн `restock`. Шингэний `ml` тооцоо `where line_kind = 'perfume'`.
- Signature өөрчлөгдөж буй тул хуучин `mark_order_refunded(uuid, uuid, int,
  boolean)`-ийг **`drop function`** хийж, шинийг үүсгээд эрхийг дахин олгоно.
  `place_order`-ийн signature өөрчлөгдөх бол мөн адил (0111, 0129-ийн жишээ).

## 7. Админ — нэмэлт бараа

**Зарчим:** горим бүр өөрийн урсгалтай. Админ аль тоо жинхэнэ нөөц болохыг
бодох шаардлагагүй.

### 7.1 Байршил ба жагсаалт

- Хажуугийн цэсний «Каталог» бүлэгт «Нэмэлт бараа» (`/admin/extras`).
- Ангиллын chip, мөр: зураг, нэр, ангилал, «-аас эхлэх» үнэ, нөөцийн badge,
  төлөв. Утсан дээр `renderCard`. Үйлдэл: засах, нийтлэх/нуух, хуулбарлах,
  архивлах.

### 7.2 Шинэ бараа — горим бүрийн урсгал

Эхлээд 5 ангиллын tile. Утсан дээр «Хадгалах» доод талд байнга.

**Энгийн бараа** (гоёмсог бэлгийн сав, хоосон шил, шприц):

1. Нэр, зураг, тайлбар
2. Хувилбар: `Нэр · Үнэ (₮)`, «+ Хувилбар нэмэх». Шинэ `local_quantity`
   хувилбар **үргэлж 0 нөөцтэй** үүснэ; create form анхны тоо авахгүй.
3. Барааг хадгалсны дараа админ «Нөөц нөхөх»-өөр ширхэг, нэгж авсан үнэ,
   авсан өдрийг заавал оруулж `purchase` хөдөлгөөн үүсгэнэ. Ингэснээр шинэ
   худалдан авалт өртөггүй `set` болж тайлангаас алга болохгүй.
4. Гоёмсог бэлгийн савны хувилбар бүрт:
   - хэрэглэгчид харагдах чөлөөт нэр (`Жижиг`, `10ml-д тохирох` гэх мэт);
   - өөрийн зураг;
   - чөлөөт `size_note` — хэмжээ, тохирох сав зэргийг админ хүссэнээрээ бичнэ
     (`8×5×4см · 20ml-ийн өндөр саванд тохирохгүй` гэх мэт), хоосон байж болно.

Бэлгийн савны хэмжээг `5/10/20ml`-тэй холбосон enum, compatibility array,
«хэдэн шил багтах» хатуу талбар, mm-ийн бүтэцтэй багана үүсгэхгүй.
Product-level `attrs.capacity`-г ашиглахгүй; variant-level `image_url`,
`size_note` ашиглана. Үнэ ба нөөц мөн тухайн хувилбарынх байна.

**Грамын сав:**

1. Нэр, зураг, тайлбар
2. Тоо оруулсан савнаас сонгоод **зөвхөн үнэ** бичнэ. Тооны талбар байхгүй:

   ```
   Сав            Зарах үнэ   Нийт   Захиалгад   Зарах боломжтой
   Ягаан 10ml     [       ]    40        1             39
   Хар 10ml       [       ]     8        0              8   Цөөхөн
   ```

   Дангаар борлуулах сонголтод зөвхөн өнгөт 5/10/20ml гарна. 1ml, 2ml нь энд
   огт гарахгүй; харин `/admin/bottles` дээр үлдэгдэл, нөөц нөхөлтийн ширхэг,
   нэгж авсан үнэ, нийт худалдан авалтын дүн, хэрэглээ нь бүрэн бүртгэгдэнэ.
   Тоо оруулаагүй 5/10/20ml сав «Эхлээд Савны нөөцөд тоо оруулна уу» гэж гарна.
   Энэ ангилал `vial_inventory` нээлттэй үед л.

**Үлдэгдэлтэй шил:**

1. «Аль үнэртний шил вэ?» — брэнд, нэр, хүйс, зураг автоматаар, нөөцийн ml
2. «Үлдсэн хэмжээ (ml)», «Бүтэн савны хэмжээ (ml)»
3. «Үнэ (₮)» (админ бичнэ; `1ml ≈ …` нь мэдээлэл л)

Хувилбарын хүснэгт, тооны талбар гарахгүй. Нийтлэхийн өмнө:

```
Нийтлэх мэдээлэл
• Creed Aventus
• 18 / 100ml
• Нөөцөөс 18ml түгжинэ
• 1 ширхэг
• [үнэ]₮
          [Болих]  [Нийтлэх]
```

Бүх урсгалын доод хэсэгт «Дэлгүүрт ингэж харагдана» урьдчилан харах.

**Нийтлэх бэлэн эсэх** («Нийтлэх» товч идэвхжихээс өмнө, мөн RPC дотор):

```text
local_quantity  → ядаж 1 идэвхтэй хувилбар, үнэтэй
shared_vial     → ядаж 1 сав сонгосон, үнэтэй
leftover_liquid → яг 1 хувилбар, түгжээ амжилттай
```

Дутуу бол товчны доор юу дутуу байгааг жагсаана («Үнэ оруулаагүй хувилбар
байна»). Давхар нэртэй хувилбар, нэг савыг хоёр удаа сонгохыг форм болон DB
хоёулаа хориглоно.

### 7.3 Нөөц засах (энгийн бараа)

Цонх нээгдэх үеийн тоог (`updated_at`) хамт илгээнэ. Энэ хооронд захиалга
орж тоо өөрчлөгдсөн бол хадгалахгүй, шинэ тоог харуулна: «Нөөц энэ хооронд
өөрчлөгдсөн байна. Шинэ тоог шалгана уу.» Чимээгүй дарж бичихгүй.

```
Гоёмсог бэлгийн сав — Хар
Одоо байгаа тоо   [ 12 ]
Захиалгад орсон    3   (хүргэгдээгүй)
Зарах боломжтой    9
Тэмдэглэл  [ Шинэ ачаа ирсэн          ]
                         [Болих] [Хадгалах]
```

### 7.4 Захиалга ба буцаалт

- `/admin/orders/[id]`: нэмэлт барааны мөр «Нэмэлт» шошготой
  (`Гоёмсог бэлгийн сав — Хар × 2`), үнэртний мөрөнд цутгах сав
  (`Aventus · 10ml · Хар сав`), хасагдсан бэлэг.
- Буцаалтын цонх хоёр тусдаа хэсэгтэй: **«Мөнгө буцаах»** (одоогийн 0114) ба
  **«Нөөцөд буцаах бараа»** — энгийн нэмэлт барааны мөр бүрт тоо (0…qty, өмнө
  буцаасан тоо харагдана). Сав, шилийн мөрөнд гарахгүй. Нөөцөд буцаах нь
  мөнгөний дүнд нөлөөлөхгүй гэж тайлбартай.

## 8. Админ — савны нөөц

`/admin/bottles` тоон горимд (`vial_inventory`):

```
                 5ml      10ml     20ml
Хар сав          64       [ 8 ]    40
Ягаан сав        52       39       —
Мөнгөлөг сав     0        22       18

2ml сав (өнгөгүй)      210
1ml сав (бэлгийн)      140
```

- Нүдэнд зарах боломжтой тоо; «Цөөхөн», «Дууссан», «Тоо оруулаагүй» гэж
  бичнэ (өнгөөр дангаар биш).
- Самбар: «Нийт тоо» (доор нь: «Грамаар савлагдаад хүргэгдээгүй захиалгын
  савыг оруулаад тоолно уу.»), «Захиалгад орсон», «Зарах боломжтой»,
  «Цөөхөн гэж анхааруулах хязгаар», «Түр хаах», сүүлийн 20 хөдөлгөөн.
- Утсан дээр өнгө бүрт карт. Барааны форм: «Цутгах сав»; override-д «Аль
  саванд цутгах вэ?» заавал. Самбарын «Цөөхөн үлдсэн сав» карт.

```sql
-- variant_sellable
case when feature_enabled('vial_inventory') then
       vial_available(vial_for(
         case when pv.bottle_override then pv.bottle_override_style
              else coalesce(p.vial_style, default_vial_style(p.gender)) end,
         pv.ml))
     else bottle_active(p.gender, pv.ml) or pv.bottle_override
end
-- vial_available = is_active and (on_hand is null or on_hand - reserved > 0)
```

## 9. Дэлгүүр

| Газар | Өөрчлөлт |
| --- | --- |
| `/catalog` | «Үнэртэн / Нэмэлт бараа», `?tab=extras`; утсан дээр бүтэн өргөн, sticky |
| Нэмэлт бараа таб | Эрэмбэлэх л, 5 ангиллын tile, ангилал бүрийн мөр, «Бүгд N» |
| `?tab=extras&cat=<slug>` | Chip (sticky), 2 баганатай grid, «Хамт авдаг» |
| `/extras/[slug]` | Галерей, хувилбар, үнэ, «Сагсанд нэмэх»; `metadata`, `sitemap.ts` |
| Үлдэгдэлтэй шилний карт | `Ганц ширхэг`, зурвас, `≈18 / 100ml`, `1ml ≈ 1,390₮`, `Зарагдсан` |
| `/products/[slug]` | «Гоёмсог бэлгийн сав нэмэх» («Сагсанд 1 байна»), «Энэ үнэрийн үлдэгдэлтэй шил байна» |
| Хайлт | `global_search()`-д нэмэлт бараа, «Нэмэлт» шошго |
| Нүүр | `home-sections`-д «Нэмэлт бараа» төрөл |

## 10. Сагс ба checkout

| Файл | Өөрчлөлт |
| --- | --- |
| `features/cart/store.ts` | `CartExtra { key, extraVariantId, extraId, slug, name, label, mode, unitPrice, qty, image }`, `extras: CartExtra[]`; persist version + migration |
| `use-cart-selection.ts`, `use-cart-availability.ts` | сонголт, дүн, боломжтой эсэх (шил зарагдсан бол) |
| `lib/validators/order.ts` | `extras: [{ extraVariantId, qty, expectedUnitPrice }]`; гурвын ядаж нэг |
| `validators/saved-checkout.ts`, `checkout/saved-checkouts.ts`, `checkout/pending-order.ts` | `extras` |
| `checkout/api.ts` | `priceLines`, `computeSummary` (урьдчилж харуулахад л) |
| `app/api/orders/route.ts` | RPC-ийн summary-г буцаана; бэлгийн тооцоог SQL-д шилжүүлнэ; §13-ын алдааны кодууд |
| Сагс, checkout, амжилттай захиалгын хуудас | нэмэлт барааны мөр, «Захиалгаа гүйцээх», хасагдсан бэлгийн мэдэгдэл (reload хийсэн ч сангаас) |
| Buy-now (`cart/page.tsx`, `checkout/page.tsx`) | нэмэлт бараа, зөвхөн нэмэлт бараатай захиалга |

Хэрэглэгчийн зан төлөв:

- Үнэ, купон, оноо, хүргэлтийн дүн өөрчлөгдвөл сагс устахгүй — шинэ дүнг
  харуулаад «Шинэ дүнгээр захиалах» товчоор дахин батлуулна.
- Нөөц багассан бол тоог автоматаар багасгахгүй: «Таны сонгосон 3-аас 1
  ширхэг үлдсэн байна» + «1 болгох» / «Хасах» сонголт.
- Үлдэгдэлтэй шил зарагдсан бол зөвхөн тэр мөрийг хасах санал.
- Бэлэг сонгох хэсэг сав дууссан үед урьдчилан идэвхгүй — захиалсны дараа
  анх мэдэгдэх тохиолдлыг аль болох багасгана.

## 11. Захиалгыг харуулдаг газрууд

`line_kind`-аар: `perfume` → `Нэр · 10ml × 2`, `extra` → `Нэр — Хувилбар × 2`.
`src/db/types.ts`, Telegram, имэйл, админы захиалга, хэрэглэгчийн захиалга,
нэхэмжлэх (`/pay/[token]`), тайлан (0074 — зөвхөн `perfume`; 0111 — нэмэлт
барааны орлого тусдаа).

## 12. Утсан дээрх UI дүрэм

360px-д эвдрэлгүй. Дарагдах талбай ≥ 44px. Тогтмол px өргөн хийхгүй, хэвтээ
мөр `overflow-x-auto snap-x` (2 бүтэн + хагас). `line-clamp-2`, үнэ
`whitespace-nowrap`. Админы хүснэгт `renderCard`. «Хадгалах» sticky, гарны дор
орохгүй. Sheet доороос. Theme token, gradient-гүй, dark mode. `aspect-ratio`.

## 13. UI текст

| Газар / код | Текст |
| --- | --- |
| Таб | Үнэртэн · Нэмэлт бараа |
| Хайлт | Бүх бараанаас хайх… |
| Үлдэгдэлтэй шил | Ганц ширхэг · Захиалсан даруй хаагдана · Зарагдсан |
| Барааны хуудас | Гоёмсог бэлгийн сав нэмэх · Сагсанд 1 байна · Энэ үнэрийн үлдэгдэлтэй шил байна |
| Сагс | Захиалгаа гүйцээх · Бэлэг барих бол хайрцаг, уутаа хамт аваарай |
| Сав дууссан | Энэ хэмжээ түр байхгүй |
| `VIAL_UNAVAILABLE` | Aventus-ийн 10ml-ийн сав дууссан тул одоогоор захиалах боломжгүй. Өөр хэмжээ сонгоно уу. |
| `EXTRA_PRICE_CHANGED` | Үнэ шинэчлэгдсэн байна. Шинэ үнийг шалгаад дахин батална уу. |
| `EXTRA_QTY_UNAVAILABLE` | Таны сонгосон 3-аас 1 ширхэг үлдсэн байна. |
| `LEFTOVER_ALREADY_SOLD` | Энэ үлдэгдэлтэй шил саяхан зарагдсан байна. |
| `LEFTOVER_RESTORE_CONFLICT` | Энэ шилийг өөр захиалгад авсан тул захиалгыг сэргээх боломжгүй. |
| Бэлэг хасагдсан (сав) | Бэлгийн дээж дууссан тул энэ удаа ороогүй. |
| Бэлэг хасагдсан (босго) | Захиалгын дүн өөрчлөгдсөн тул бэлгийн дээж ороогүй. |
| Бэлэг сонгох | Бэлгийн дээж түр дууссан |
| Админ: нөөц | Нийт тоо · Захиалгад орсон · Зарах боломжтой |
| Админ: савны тайлбар | Грамаар савлагдаад хүргэгдээгүй захиалгын савыг оруулаад тоолно уу. |
| Админ: тоо | Тоо оруулаагүй · Цөөхөн үлдсэн: 8 ширхэг |
| Админ: грамын сав | Эхлээд Савны нөөцөд тоо оруулна уу |
| Админ: тоо бага | Хүргэгдээгүй 3 захиалгад энэ сав орсон тул 3-аас бага тоо оруулах боломжгүй. |
| Админ: шил | Энэ үнэртний нөөцөд 12ml л байна. 12-оос их ml оруулах боломжгүй. · Энэ шил захиалгад орсон тул одоо засах боломжгүй. |
| Админ: override | Аль саванд цутгах вэ? |
| Админ: буцаалт | Нөөцөд буцаах |
| `ILLEGAL_TRANSITION` | Энэ төлөв рүү шилжүүлэх боломжгүй. |
| `PAYMENT_REQUIRED` | Төлбөр төлөгдөөгүй захиалгыг хүргэлтэд гаргах боломжгүй. |
| `COUPON_CHANGED` | Купоны хөнгөлөлт өөрчлөгдсөн байна. Шинэ дүнг шалгаад дахин батална уу. |
| `LOYALTY_CHANGED` | Таны V point өөрчлөгдсөн байна. Ашиглах оноогоо дахин сонгоно уу. |
| `SHIPPING_CHANGED` | Хүргэлтийн үнэ өөрчлөгдсөн байна. Шинэ дүнг шалгаад дахин батална уу. |
| `TOTAL_CHANGED` | Захиалгын дүн өөрчлөгдсөн байна. Шинэ дүнг шалгаад дахин батална уу. |
| `ORDER_TOO_LARGE` | Захиалгын дүн хэт их байна. Тоогоо багасгана уу. |
| Админ: нөөц өөрчлөгдсөн | Нөөц энэ хооронд өөрчлөгдсөн байна. Шинэ тоог шалгана уу. |
| Админ: нийтлэх | Үнэ оруулаагүй хувилбар байна |
| Хоосон төлөв | Нэмэлт бараа алга байна. Эхнийхээ барааг нэмээрэй. |

## 14. Feature flag ба тест

| Туг | Хамрах хүрээ |
| --- | --- |
| `extras_shop` | `/admin/extras`, `/extras/*`, таб, хайлт, сагс, `place_order`-ийн нэмэлт барааны салаа, шилний listing |
| `vial_inventory` | `/admin/bottles` тоон горим, «Грамын сав» ангилал, `variant_sellable` салаа, шинэ савны reserve |

Хуудас (`notFound`), client (`useFeatureFlag`), SQL — зөвхөн **шинэ** reserve,
listing (§6.3 дүрэм 2).

**SQL (`scripts/test-extras.ts`, `pnpm db:test-extras-dev`):**

1. Нэг хэрэглэгч сүүлийн оноогоо зэрэг хоёр захиалгад (§0).
2. Бэлгийн босгын орчимд купоны хэрэглээ зэрэг өөрчлөгдөх.
3. Урьдчилж харсан болон `place_order`-ийн хооронд нэмэлт барааны үнэ өөрчлөгдөх → `EXTRA_PRICE_CHANGED`.
4. Хариу алдагдах → ижил `request_id`-аар дахин илгээхэд ижил summary, ижил хасагдсан бэлэг.
5. Админ тоо засахтай checkout зэрэг.
6. Үнэртэн ба тусад нь зарж буй сав сүүлийн нэг савны төлөө зэрэг.
7. Шил: A цуцлах → B авах → A сэргээх (`LEFTOVER_RESTORE_CONFLICT`).
8. Хэсэгчилсэн restock, ижил хүсэлт давтах.
9. Хууль бус төлөвийн шилжилт бүр.
10. Холимог хоёр захиалга урвуу дарааллаар (deadlock-гүй).
11. Туг ON → reserve → OFF → цуцлах: суллагдаж, хөдөлгөөн бичигдэнэ.
12. `user_tiers` ON/OFF үед нэмэлт бараатай захиалгын оноо.
13. `gift_entitlement()` = `src/lib/gift.ts` (хилийн утгууд).
14. Урьдчилж харсны дараа купон дуусах / идэвхгүй болох / хэрэглээний хязгаарт хүрэх → `COUPON_CHANGED`.
15. Урьдчилж харсны дараа оноо өөр захиалгад ашиглагдах → `LOYALTY_CHANGED`.
16. Хүргэлтийн үнэ эсвэл багцын үнэ өөрчлөгдөх → `SHIPPING_CHANGED` / `TOTAL_CHANGED`.
17. Төлөөгүй захиалгыг shipping / delivered болгох → `PAYMENT_REQUIRED`.
18. Цуцлагдсан / буцаасан захиалгад хожуу QPay callback.
19. Ижил төлөвийг давтан өгөх → no-op.
20. `on_hand = null` үед захиалга → дараа нь тоолж эхлэх → хүргэлт: тоо зөв.
21. Ангилал/бараа/хувилбарын горим зөрсөн insert → constraint алдаа.
22. Өөр барааны хувилбартай захиалгын мөр → FK алдаа.
23. `committed` үлдэгдэлтэй шилийг дахин нийтлэх → татгалзана.
24. Reserve / commit / release-ийг давтах → хөдөлгөөн нэг л удаа.
25. Хуучин `mark_order_refunded` signature байхгүй (overload үлдээгүй).
26. Нэг хүсэлтэд ижил хувилбар хоёр удаа, qty 99 × хамгийн өндөр үнэ.
27. Туг OFF үед нийтлэгдсэн нэмэлт бараа нийтийн RLS-ээр харагдахгүй (хуудас 404, API хоосон).
28. Холимог захиалгын тайлан, буцаалт: `perfume_goods + extras_goods = goods`.
29. Төлсөн захиалга цуцлах → сэргээх: дүн хэвээр, купон/оноо 0141-ийн дүрмээр.

**Reconciliation query** (тест бүрийн төгсгөлд, prod-д туг нээхийн өмнө 0 зөрүү):

```text
orders.subtotal = Σ order_items.line_total
orders.total    = subtotal + shipping_fee − discount − loyalty_used
local_quantity : extra_variants.reserved_qty
                 = Σ qty (extra_inventory_mode = 'local_quantity', extra_state = 'reserved')
shared_vial    : vials.reserved
                 = Σ qty (vial_state = 'reserved')   -- үнэртэн + тусад нь зарсан сав
leftover       : inventory.reserved_ml
                 = Σ ml×qty (perfume, захиалга төлөөгүй, reserve хийгдсэн)
                 + Σ locked_ml (state in ('listed','reserved'))
эхний тоо + Σ хөдөлгөөн = одоогийн тоо   (vials, extra_variants)
event_key давхардалгүй
```

**Unit:** Zod (горим бүр), `sellable` хүснэгт, `computeSummary`, сагсны migration.
**E2E (demo):** админы гурван урсгал, таб, сагс — demo fixture-ээр.
**Visual:** `toHaveScreenshot()`, 360/390/768/1280 — UI гарсан **PR бүрт**.

## 15. Хийх дараалал

Нөөц үүсгэдэг код (захиалга) ба нөөцийг суллаж/хасдаг код (цуцлалт, хугацаа,
хүргэлт, сэргээлт, буцаалт) **нэг PR-т** орно. Ингэснээр нэмэлт бараатай
захиалга нь мөчлөг нь бүрэн болохоос өмнө хэзээ ч үүсэхгүй.

| PR | Ажил | Тооцоо |
| --- | --- | --- |
| 0 | `fix/loyalty-race` (§0) — шууд | 0.5 |
| 1 | Schema: ангилал → бараа → `vials` → хувилбар → хөдөлгөөн (`event_key`) → шилний түгжээ; composite FK, uniqueness, горим өөрчлөх/устгахыг хориглох trigger, RLS/эрх, туг, `products.vial_style`, override өнгө | 2.5 |
| 2 | `order_items` (§5.4) + `orders.lifecycle_cycle`, `orders_total_chk`; `OrderItemRow` union; бүх харуулдаг газар, тайлангийн шинэ баганууд. Нэмэлт барааны мөр **хараахан үүсэхгүй** | 2.5 |
| 3 | Админ: гурван урсгал, нийтлэх бэлэн эсэх, нөөц засах (conflict), шилний RPC; `place_order` нэмэлт барааг **татгалзсан** хэвээр; visual | 3.5 |
| 4 | Дэлгүүр: таб, ангилал, `/extras/[slug]`, хайлт, sitemap; «Сагсанд нэмэх» туг хаалттай; visual | 2.5 |
| 5 | Сагс, хадгалсан checkout, pending snapshot, validator (`expected_*`) | 2 |
| 6 | **Нэг атомик хэсэг:** `place_order` (нэгтгэл, түгжих дараалал, сангийн үнэ, баталсан дүн, бэлэг SQL-д, summary, replay) + төлбөр + цуцлалт + хугацаа + хүргэлт + сэргээлт + мөр бүрийн буцаалт + төлөв/төлбөрийн хамгаалалт + signature drop | 5 |
| 7 | Checkout-ийн алдааны UX, мэдэгдэл (Telegram, имэйл); SQL тест бүгд + reconciliation; visual | 2.5 |
| 8 | Cross-sell, нүүрний хэсэг | 1 |
| 9 | Савны нөөцийн админ (тоолж эхлэх, null), «Цутгах сав», override, самбарын карт | 1.5 |
| 10 | Савны reserve асаах, `variant_sellable`, нээх өмнөх reconciliation | 1.5 |

**Нийт ~25 өдөр.** Migration бүр `db:migrate-dev` → шалгах →
`db:migrate-prod` → merge. Туг prod-д хаалттай орно. Туг нээхийн өмнө
reconciliation query бүгд 0 зөрүүтэй. `not valid` constraint-уудыг хуучин
өгөгдлийг шалгасны дараа `validate constraint` хийнэ.

## 16. Энэ удаад орохгүй

Мист · хөнгөлөлтийн карт · бэлгийн карт (дараа тусдаа, §18.9) ·
ангилал засах хуудас · захиалгын мөр засах · нэг бүрчилсэн өртөг/маржин (§18.6) ·
«Ирэхэд мэдэгдэх» · нэмэлт барааны тусгай хямдрал · `shipping_fee`-г SQL-д
шилжүүлэх · цуцлагдсаныг сэргээхэд купон/оноог сэргээх (§2.2 L) · шингэний
reserve-ийг захиалгын мөрөөр эзэнтэй болгох · `bottle_stock`, `bottle_active()`, boolean override-ийг устгах
(туг тогтворжсоны дараа).

## 17. Нээлттэй асуулт ба хэрэгжүүлэх суурь

Клиентээс хүлээж буй нээлттэй асуулт байхгүй. Энэ workspace-д v4-ийн
0144–0152 migration болон PR0–10-т харгалзах код `feat/vial-inventory` дээр
аль хэдийн хэрэгжсэн. Тэдгээр migration-ийг засах, дугаар солихгүй; v5 нь
0153-аас зөвхөн forward migration-аар үргэлжилнэ.

PR0–10 гэдэг нь төлөвлөлтийн шошго бөгөөд remote PR нээгдсэн гэсэн үг биш.
Шинэ ажлын эхлэл нь **PR11 / migration 0153**. PR бүрт SQL invariant, RPC эрх,
RLS, concurrency, тайлангийн reconciliation-ийг тухайн өөрчлөлттэй нь хамт
шалгана.

## 18. v5 — клиентийн нэмэлт шаардлага (2026-10-20)

Клиент ангилал бүрийн дэлгэрэнгүй тайлбар, ppt («Нэмэлт бараа»), тодруулах
асуултын хариултыг ирүүлсэн. PR0–10 prod-д ороогүй тул өөрчлөлтийг
**0153-аас эхлэх шинэ migration**-аар хийнэ. dev дээр хэрэгжсэн 0145–0152-ыг
засахгүй, дугаарыг ч солихгүй. Салбар: `feat/vial-inventory` дээр давхарласан
`feat/extras-v5`.

### 18.1 Клиентийн хариулт

| # | Асуулт | Хариулт |
| --- | --- | --- |
| 1 | Савны тайлан | 1/2/5/10/20ml бүх савны **худалдан авалт** авсан өдрөөрөө бүрэн зарлага болно. Үнэртэн/бэлгийн дээжтэй хамт гарсан сав орлого авчрахгүй; дангаар зарагдсан 5/10/20ml сав борлуулалтын орлого болно. Хэрэглээг хэмжээгээр, өнгөт савыг өнгөөр нь тайлагнана |
| 2 | 1ml, 2ml сав | **Дангаар зарахгүй.** Админ тус бүрийн үлдэгдэл, захиалгад орсон болон ашиглах боломжтой ширхэгийг харна. Нөөц нөхөхдөө ширхэг ба нэгж авсан үнэ оруулна; тайланд худалдан авалт, хэрэглээг нэгтгэнэ |
| 3 | Хөнгөлөлтийн карт | Одоохондоо хийхгүй |
| 4 | Бэлгийн карт | Дараа тусдаа хийнэ. Нэмэлт бараанд хялбар нэмэгддэг бүтэцтэй байхад л хангалттай (§18.9) |
| 5 | Хоосон шил | Нэг шил олон ширхэг байж болно. Batch code нь ширхэг бүрт өөр байж болно |
| 6 | Гоёмсог бэлгийн сав | 5 ангиллын нэг. Хувилбарын нэр, хэмжээг админ чөлөөтэй бичнэ («10ml-д тохирох» г.м.); 1–3 төрөл, 5/10/20ml нь хатуу хязгаар биш |
| 7 | Бүтэн, лацтай шил | Хэрэглэсэн барааны зөвшөөрөл, ±1–2ml анхааруулга **хэрэггүй**. Тэдгээр нь зөвхөн хоосон шил ба үлдэгдэлтэй шилэнд |

### 18.2 Ангилал (6 → 5)

| slug | Нэр | Горим | Өөрчлөлт |
| --- | --- | --- | --- |
| `empty-bottle` | Хоосон шил | `local_quantity` | Хувилбар = batch code (§18.3) |
| `syringe` | Шприц | `local_quantity` | Хувилбар нь 5/10/20ml, үнэ тус бүр |
| `vial` | Грамын сав | `shared_vial` | Хэмжээ → өнгө → тоо гэсэн сонголт; 1ml, 2ml **зарагдахгүй** |
| `bottled` (хуучин `leftover`) | **Шилтэй ус** | `leftover_liquid` **ба** `local_quantity` | Үлдэгдэлтэй шил ба бүтэн, лацтай шил |
| `gift-box` | **Гоёмсог бэлгийн сав** | `local_quantity` | Хайрцаг, уут; төрөл/хувилбар бүр чөлөөт нэр, зураг, чөлөөт `size_note`, үнэ, өөрийн нөөцтэй; тоо/хэмжээнд хатуу хязгааргүй |

- `brand-pouch` ангиллыг `gift-box`-д нэгтгэнэ. Бараа байвал шилжүүлж, ангиллыг
  `is_active = false` болгоно (устгахыг trigger хориглодог, §5.1).
- «Шилтэй ус» ангилалд хоёр горим орно. `modes[]` array ашиглахгүй;
  `extra_category_modes(category_id, inventory_mode)` холбоос хүснэгт үүсгэнэ.
  `extra_products(category_id, inventory_mode)` нь уг хүснэгт рүү composite FK-
  тай байна. Ингэснээр зөвшөөрөгдсөн горимыг DB өөрөө хамгаална. Бараа → хувилбар
  → захиалгын мөрийн одоогийн composite FK хэвээр. Барааны горим үүссэний дараа
  өөрчлөгдөхгүй.
- **Бүтэн, лацтай шил** нь `local_quantity`. Эх үнэртний ml нөөцөөс **хасагдахгүй**:
  нэг бараа гэж орлогодож, авсан үнэ нь зарлага болно.
- **Үлдэгдэлтэй шил** нь `leftover_liquid` хэвээр: эх үнэртний ml-ээс түгжиж,
  хүргэгдэхэд хасна (§5.5). Ингэснээр «Тайланд үлдэгдлийн хэмжээгээр хасагдана»
  гэсэн шаардлага хангагдана. Шингэний өртөг эх савны худалдан авалтаар аль хэдийн
  зарлага болсон тул энд нэмэлт өртөг бичихгүй.

### 18.3 Өгөгдлийн өөрчлөлт (0153)

0153 нь одоогийн 0144–0152-ыг засахгүй forward migration. Нэмэлт барааны
schema prod-д хараахан гараагүй тул category-mode шилжилтийг **0153 дотор шууд
дуусгана**: SQL function/view, API/TS reader-ийг нэг PR-д шинэчилж, хуучин
`extra_categories.inventory_mode`, composite FK, guard-ийг мөн 0153-д устгана.

```sql
-- Ангилал ↔ зөвшөөрөгдсөн нөөцийн горим: array биш normalized relation.
create table extra_category_modes (
  category_id     uuid not null references extra_categories(id),
  inventory_mode extra_inventory_mode_t not null,
  notice          text not null default '',
  requires_consent boolean not null default false,
  primary key (category_id, inventory_mode)
);

-- notice/consent нь category + mode түвшинд: bottled/leftover-д true,
-- bottled/local_quantity (бүтэн, лацтай)-д false байж чадна.

alter table extra_variants
  add column if not exists batch_code text,              -- хоосон/бүтэн шил
  add column if not exists image_url text,               -- хувилбарын зураг
  add column if not exists size_note text
    check (char_length(size_note) <= 300);                -- чөлөөт хэмжээ/тохирох тайлбар

-- Нөөц нөхөх = худалдан авалт; restock = хэрэглэгчийн буцаалт.
alter table extra_movements add column if not exists unit_cost int
  check (unit_cost >= 0);
alter table extra_movements add column if not exists cost int
  check (cost >= 0);
alter table extra_movements add column if not exists purchased_on date;
-- vial_movements-д мөн адил unit_cost, cost, purchased_on.
-- kind-д 'purchase', 'adjust' нэмнэ; хуучин 'set' түүхийг өөрчлөхгүй.

-- Үнэртний одоогийн худалдан авалт мөн ижил business date ашиглана.
alter table restock_log add column if not exists purchased_on date;
update restock_log
   set purchased_on = (created_at at time zone 'Asia/Ulaanbaatar')::date
 where purchased_on is null;
alter table restock_log alter column purchased_on set not null;
alter table restock_log alter column purchased_on
  set default ((now() at time zone 'Asia/Ulaanbaatar')::date);

alter table orders add column if not exists used_goods_consent_at timestamptz;
```

**Category migration-ийн атомик дараалал (бүгд 0153-д):**

1. Одоогийн 6 ангиллын `(id, inventory_mode)`-ийг `extra_category_modes` руу
   backfill хийнэ; association бүрийн `notice/requires_consent`-ийг mode-оор seed
   хийнэ.
2. `leftover`-ийг `bottled` / «Шилтэй ус» болгоод `leftover_liquid` болон
   `local_quantity` хоёр association үүсгэнэ. ±1–2ml notice ба хэрэглэсэн барааны
   consent нь зөвхөн `(bottled, leftover_liquid)` дээр; бүтэн, лацтай
   `(bottled, local_quantity)` дээр хоёулаа байхгүй.
3. `brand-pouch` барааг `gift-box` руу нэг transaction-д шилжүүлж хуучин
   ангиллыг идэвхгүй болгоно. Migration дотор guard-ийг хяналттай сольж, төгсгөлд
   category/mode immutable хамгаалалтыг сэргээнэ.
4. `extra_products(category_id, inventory_mode)`-ийн FK-г
   `extra_category_modes(category_id, inventory_mode)` руу солино. Product →
   variant → order item composite FK-г хэвээр үлдээнэ.
5. `extra_products_guard()` insert үед нэг горимтой ангилалд mode-ийг default
   хийнэ; `bottled`-д mode заавал ирнэ. Association FK эцсийн хамгаалалт байна.
6. Хамааралтай бүх SQL function/view, admin/storefront API, TS type/mapper-ийг
   шинэ relation ашиглахаар **энэ PR-д** шинэчилнэ.
7. Хуучин category composite FK, guard logic, `(id, inventory_mode)` unique болон
   `extra_categories.inventory_mode` баганыг 0153-ын төгсгөлд шууд устгана.
   Завсрын хоёр source of truth, тусдаа contract PR үлдэхгүй.

**Нөөц ба худалдан авалтын ledger:**

- `purchase`: `+N` ширхэг, `unit_cost` = нэгж авсан үнэ, `cost = N × unit_cost`,
  `purchased_on` = бодитоор худалдаж авсан **Улаанбаатарын календарийн өдөр**.
  `created_at` нь системд бүртгэсэн `timestamptz` audit цаг; тайлангийн business
  date биш.
- **Шинэ барааны анхны нөөц = 0.** Хоёр хувилбараас каталог үүсгэхийг санхүүгийн
  хөдөлгөөнөөс салгах шийдлийг сонгов. `extras_save` шинэ `local_quantity`
  variant-ийг үргэлж `on_hand_qty = 0`-ээр үүсгэнэ; `initial_qty > 0` хүсэлтийг
  `INITIAL_STOCK_REQUIRES_PURCHASE` гэж татгалзана. Хадгалсны дараа админ
  «Нөөц нөхөх»-өөр purchase оруулна. Ингэснээр 0147-ийн өртөггүй анхны `set`
  хөдөлгөөн бүрэн арилна.
- Шинэ purchase-ийн `purchased_on` нь UB цагаар одоогийн сарын 1-нээс өмнө,
  өнөөдрөөс хойш байж болохгүй. Өмнөх саруудыг хаагдсан гэж үзнэ; RPC нь
  `PURCHASE_DATE_CLOSED`, `PURCHASE_DATE_FUTURE` буцаана. Zod/API мөн ижил
  шалгана. Өөрөөр хэлбэл одоогийн нээлттэй сарын өнгөрсөн болон өнөөдөр л
  зөвшөөрөгдөнө.
- Тайлан `p_from/p_to timestamptz` хилээ purchase date-тай харьцуулахдаа
  `(p_from at time zone 'Asia/Ulaanbaatar')::date`,
  `(p_to at time zone 'Asia/Ulaanbaatar')::date` болгон хөрвүүлнэ; дээд хил
  exclusive. Backfill нь
  `(created_at at time zone 'Asia/Ulaanbaatar')::date`; `created_at::date` биш.
- `restock_log.purchased_on` нэмэгдсэнээр үнэртний `StockAdjustDialog`,
  `/api/admin/inventory`, `restock_inventory` мөн шинэчлэгдэнэ. Form UB өнөөдрийг
  default болгож дээрх огнооны хязгаарыг шалгана. Хуучин 5 аргументтай
  `restock_inventory(uuid,int,text,uuid,int)`-ийг drop хийгээд
  `p_purchased_on date default null` (null → UB өнөөдөр) параметртэй signature
  үүсгэнэ. **Default заавал:** `db:migrate-prod` нь merge-ээс өмнө ажилладаг тул
  prod-ийн хуучин код 5 нэртэй аргументаар дуудсаар байна — default-гүй бол
  merge хүртэл prod-ийн restock эвдэрнэ (0149-ийн `mark_order_refunded`-тэй ижил
  загвар). 0112-ийн эрхийн жагсаалт, `src/db/types.ts`, `scripts/test-reports.ts`
  мөн шинэчлэгдэнэ.
- `adjust`: тооллогын залруулга (±), өртөггүй. Одоогийн `set` хөдөлгөөний түүхийг
  rename/update хийхгүй; шинэ absolute «Тоо засах» үйлдэл `adjust` хөдөлгөөн бичнэ.
- Нөөц нөхөх болон тоо засах нь тусдаа service-role RPC. Мөрийг `for update`
  түгжиж, `expected_updated_at` stale-write шалгалт хийж, тоо + хөдөлгөөн + өртгийг
  нэг transaction-д бичнэ. Хөдөлгөөний `cost` нь тайлангийн source of truth;
  variant дээр «сүүлд авсан үнэ» давхар хадгалахгүй.
- `vials.on_hand is null` үед эхлээд «Эхний тооллого» хийнэ; тодорхойгүй хуучин
  үлдэгдэл дээр purchase шууд нэмэхийг `STOCK_NOT_COUNTED`-оор хориглоно.
- 1ml/2ml-д purchase price ба count яг адил бүртгэгдэнэ. Энэ нь **зарах үнэ биш**;
  тэдгээрийг standalone `extra_variant` болгохгүй.

**Standalone грамын савны хамгаалалт:**

- 0147 одоогоор 1ml-ийг л хориглож, 2ml-ийг дангаар зарж чаддаг. 0153 SQL/RPC
  guard нь `shared_vial` extra variant-д зөвхөн `ml in (5, 10, 20)` зөвшөөрнө.
- Байгаа 1/2ml shared-vial variant-уудыг migration-аар идэвхгүй болгоно.
- Энэ хориг нь perfume-ийн 2ml декант болон 1ml бэлгийн дээжид **үйлчлэхгүй**;
  тэд `vials` нөөцөө хэвийн reserve/commit хийнэ.

**Бусад хувилбар:**

- Хоосон шилийн нэг batch code = нэг variant; ижил batch code-той ширхгийг нэг
  variant дээр тоогоор нэгтгэж болно.
- Гоёмсог бэлгийн савны хэмжээ нь variant-level чөлөөт `size_note` (optional).
  5/10/20ml-тэй hard relation үүсгэхгүй. Variant-ийн тоо, нэр, хэмжээнд enum
  эсвэл дээд хязгаар тавихгүй.
- Хоосон/бүтэн шилний `0/125ml` зэрэг хэмжээ нь display metadata; үлдэгдэлтэй
  шилний `remaining_ml/full_ml` л нөөцийн тооцоонд орно.

### 18.4 Админ

| Газар | Өөрчлөлт |
| --- | --- |
| Нэмэлт бараа — нөөц | «Нөөц нөхөх»: `+ ширхэг`, `Нэгж авсан үнэ (₮)`, `Авсан өдөр`; нийт дүнг автоматаар харуулна. «Тоо засах» нь тусдаа, өртөггүй. Хоёул stale-write conflict шалгалттай |
| Савны нөөц `/admin/bottles` | 1/2/5/10/20ml нүд бүрт «Нөөц нөхөх» (`+ ширхэг`, нэгж авсан үнэ, авсан өдөр), «Тоо засах», нийт/захиалгад/ашиглах боломжтой тоо, «Цөөхөн» анхааруулга. 1ml, 2ml дээр **«Дангаар зарагдахгүй»** шошго; standalone sale price талбар байхгүй |
| Гоёмсог бэлгийн сав | Хувилбарын мөр: `Нэр · зураг · хэмжээ (чөлөөт текст, optional) · зарах үнэ · нөөц`. «Хэдэн шил багтах», 5/10/20ml enum, 1–3 төрлийн хязгаар байхгүй |
| Хоосон шил | Хувилбарын мөр: `Batch code · Үнэ · Тоо`. Хэмжээ `0 / [125] ml` |
| Шилтэй ус | Эхлээд «Үлдэгдэлтэй шил» эсвэл «Бүтэн, лацтай шил» гэж сонгоно. Бүтэн шилд batch code, нэгж авсан үнэ, авсан өдөр, тоо оруулна (`purchase`). Үлдэгдэлтэй шил §7.2-оор |
| Зарагдсан үлдэгдэлтэй шил | «Дахин нийтлэх» товч нь зураг, тайлбар, эх үнэртнийг хуулсан шинэ бараа нээнэ. Админ ml, үнээ солиод нийтэлнэ. Хуучин бараа архивлагдаж, борлуулалтын түүх үлдэнэ |
| Грамын сав (дэлгүүрийн хувилбар) | Сонголтод зөвхөн 5/10/20ml-ийн өнгөт сав гарна; 1/2ml нь нөөц ба тайланд л харагдана |

### 18.5 Дэлгүүр ба checkout

- **Жагсаалт:** хоосон шил ба шилтэй усыг ангилал дотор доошоо урсдаг жагсаалтаар
  харуулна (эрэмбэ шаардлагагүй). Нэрээр хайх талбар болон «Зөвхөн үлдэгдэлтэй»
  шүүлтүүртэй.
- **Үлдэгдэл харагдана:** «Үлдэгдэл: 6 ширхэг». Дууссан бараа нуугдахгүй,
  «Үлдэгдэлгүй» гэж идэвхгүй харагдана. Тоо нь үлдэгдлээс хэтэрч болохгүй.
- **Карт:** үнэ, үлдэгдэл, тухайн бараанд хамаарах хэмжээ (`0/125ml`), batch code,
  тайлбар.
- **Гоёмсог бэлгийн сав:** сонгосон хувилбарын зураг, `size_note`, үнэ,
  үлдэгдэл солигдоно. Админы бичсэн нэр, хэмжээг тэр чигээр нь харуулна.
- **Шприц:** хэмжээ сонгоход үнэ, үлдэгдэл солигдоно. Үлдэгдэлгүй хэмжээ идэвхгүй.
- **Грамын сав:** хэмжээ → өнгө → тоо.
- **Анхааруулга** (`extra_category_modes.notice`) нь тухайн барааны
  `(category_id, inventory_mode)` association-аас сонгогдож, барааны хуудсанд
  «Сагсанд нэмэх»-ийн дээр гарна.
- **Зөвшөөрөл:** сагсанд таарах association-ийн `requires_consent = true` бараа
  (хоосон шил, үлдэгдэлтэй шил) байвал checkout дээр checkbox заавал. Бүтэн,
  лацтай `(bottled, local_quantity)` шилэнд шаардахгүй. Шалгалтыг client, Zod,
  `place_order` гурвуулаа хийнэ (`USED_GOODS_CONSENT_REQUIRED`). Хугацааг
  `orders.used_goods_consent_at`-д хадгална.
- Оноо, купон ашиглах боломжтой хэвээр (§2.1-ийн 9).

**Анхааруулгын текст (seed, Монгол хэлний шалгалт хийгдсэн):**

| Ангилал + горим | `notice` |
| --- | --- |
| Шприц | Ихэнх үнэртэй усанд тохирдог ч Baccarat Rouge зэрэг зарим үнэртэй усны шүршигчийн хоолойд таардаггүй. Захиалахаасаа өмнө аль үнэртэй усанд хэрэглэхээ Facebook, Instagram, утас эсвэл сайтын чатаар лавлана уу. Лавлалгүй авч, таараагүй тохиолдолд буцаах боломжгүй. |
| Шилтэй ус — үлдэгдэлтэй шил | Шилнээс гаргаж хэмжээд буцааж хийх боломжгүй тул заасан хэмжээнээс ±1–2ml зөрүүтэй байж болно. |
| Шилтэй ус — бүтэн, лацтай шил | (анхааруулгагүй) |
| Хоосон шил, үлдэгдэлтэй шил | Зөвшөөрлийн текст (доор) |

**Зөвшөөрөл** (хоосон шил, үлдэгдэлтэй шил; бүгдэд ижил. Бүтэн, лацтай шилэнд үгүй):

> Энэ бараа үйлдвэрээс шинээр гарсан биш, хэрэглэсэн бараа юм. Шил зурагдсан,
> өнцөг булан нь бага зэрэг цуурсан, шүршигч муу ажилладаг, таг сайн барьдаггүй,
> бичиг наалт нь элэгдэж бүдгэрсэн, тестер савлагаатай, гадна хуулганы өнгө
> бүдгэрсэн байж болно. Зөвхөн цуглуулга болон хувийн хэрэгцээнд худалдан авч
> байна. Цааш дамлан зарах, арилжаа хийх зорилгоор авсан, манайхаас аваагүй
> бараагаар сольсон эсвэл худал мэдээлэл тараасан нь нотлогдвол хэрэглэгчийн
> бүртгэлийг түр хаах, цаашлаад устгах бөгөөд үүнээс үүдэх хохирлыг манайх
> хариуцахгүй.
>
> ☐ Хэрэглэсэн бараа гэдгийг ойлгож, нөхцөлийг зөвшөөрч байна

### 18.6 Тайлан

0111-ийн загвар хэвээр: **Ашиг = цэвэр борлуулалт − QPay шимтгэл − худалдан
авалт + буцаалтын шимтгэл**. Худалдан авалт нь бэлэн мөнгөний (cash-based)
зарлага: бараа зарагдах/хэрэглэгдэхийг хүлээлгүй, **бодитоор худалдаж авсан
өдрөөр** нь бүтэн дүнгээр тооцно.

- Худалдан авалт = `restock_log.cost` + Σ `extra_movements.cost` + Σ
  `vial_movements.cost` (`kind = 'purchase'`). Шүүлт нь `purchased_on`; audit-ын
  `created_at`-аар биш. Тайлангийн `p_from/p_to` (timestamptz) нь
  `(p_from at time zone 'Asia/Ulaanbaatar')::date`-аар огноо болж харьцуулагдана.
- Хуучин `restock_log`-д `purchased_on` нэмээд
  `(created_at at time zone 'Asia/Ulaanbaatar')::date`-аар backfill хийнэ.
  `created_at::date` (UTC) хэрэглэвэл УБ-ын 00:00–08:00-д бүртгэсэн мөр өмнөх
  өдөр рүү шилжиж өнгөрсөн сарын ашиг өөрчлөгдөнө. Backfill-ийн өмнө/дараа
  сар бүрийн худалдан авалтын нийлбэр ижил гэдгийг тестээр батална.
- Үнэртний restock форм (`restock_log`-д бичдэг) мөн «Авсан өдөр» талбартай
  болно (default өнөөдөр, ижил хязгаар).
- **1ml сав:** standalone борлуулалт 0; бэлгийн дээжид хэрэглэсэн ширхэг,
  худалдан авсан ширхэг/нэгж үнэ/нийт дүн, үлдэгдэл харуулна.
- **2ml сав:** standalone борлуулалт 0; 2ml үнэртний захиалгад хэрэглэсэн ширхэг,
  худалдан авсан ширхэг/нэгж үнэ/нийт дүн, үлдэгдэл харуулна.
- **5/10/20ml сав:** үнэртэнтэй гарсан болон standalone зарагдсан ширхгийг
  тусад нь, өнгө ба хэмжээгээр харуулна. Худалдан авалт авах үедээ аль хэдийн
  бүтэн зарлага болсон тул хэрэглэгдэх/зарагдах үед өртгийг дахин хасахгүй.
- **Дангаар зарагдсан нэмэлт бараа:** `extras_goods`-д (§6.1) орлого болж,
  цэвэр борлуулалтад орно. Хөгжүүлэгчийн 12%-ийн суурьт ч мөн нэмэгдэнэ.
- **Шинэ хэсэг «Нэмэлт бараа»:** 5 ангилал бүрээр тухайн хугацааны борлуулалт,
  худалдан авалт, зөрүү; саванд худалдан авалт, хэрэглээ, standalone борлуулалт,
  эцсийн үлдэгдлийг тусад нь харуулна.
- Нэг бүрчилсэн COGS/FIFO/weighted-average маржин хийхгүй. Учир нь клиент
  худалдан авалтын өртгийг авсан өдөр нь бүхэлд нь зарлага болгохыг баталсан.
  `movement.cost` нь ledger/source of truth; UI-д харагдах нэгж үнэ тайлангийн
  дүнг дахин тооцох эх үүсвэр биш.

### 18.7 Хийх дараалал (v5)

| PR | Ажил | Тооцоо |
| --- | --- | --- |
| 11 | 0153: 5 ангилал, `extra_category_modes` (горим тус бүрийн notice/consent) + composite FK/guard; legacy `inventory_mode`/хуучин FK-г шууд устгаж бүх SQL/TS reader-ийг нэг PR-д шилжүүлэх; batch code, variant зураг/`size_note`; purchase/adjust + нэгж үнэ/нийт cost/`purchased_on`; шинэ local variant 0 нөөцтэй үүсэх; 1/2ml standalone sale-г SQL-ээр хориглох; consent timestamp; SQL тест | 2 |
| 12 | Админ: эхний тооллого, заавал тусдаа нөөц нөхөх/тоо засах (нэмэлт бараа ба 1/2/5/10/20ml сав), хоосон шилийн batch, гоёмсог бэлгийн савны чөлөөт хувилбар/хэмжээ, бүтэн шилийн урсгал, «Дахин нийтлэх» | 3 |
| 13 | Дэлгүүр: жагсаалт, хайлт ба «Зөвхөн үлдэгдэлтэй», үлдэгдлийн тоо, «Үлдэгдэлгүй», шприц/грамын савны сонголт, бэлгийн савны variant зураг/`size_note`, горимын анхааруулга | 2 |
| 14 | Checkout-ийн mode-level зөвшөөрөл (client + Zod + `place_order`). Зөвшөөрлийг `p_order.used_goods_consent` (optional) талбараар дамжуулна — 0149-ийн `p_order.expected`-тэй ижил. `place_order(jsonb, jsonb)` signature **өөрчлөгдөхгүй, drop хийхгүй**: prod migration merge-ээс өмнө орох тул drop нь prod-ийн checkout-ыг merge хүртэл зогсооно. Талбар байхгүй хуучин хүсэлт нь `requires_consent` бараагүй тул нөлөөгүй | 1 |
| 15 | Тайлан: `purchased_on`-оор бүх худалдан авалт (UB boundary), `restock_log`-ийн UB backfill; үнэртний `StockAdjustDialog`, `/api/admin/inventory`, `restock_inventory`-д «Авсан өдөр» нэмэх, хуучин 5-arg RPC-г drop хийж default-тай 6-arg болгон regrant хийх; 5 ангиллын борлуулалт/худалдан авалт; 1/2ml хэрэглээ, 5/10/20ml хэрэглээ ба standalone борлуулалт; `db:test-reports-dev` | 2 |
| 16 | Үлдсэн SQL сценари (§14-ийн №12, №22, №24 болон §18.8 acceptance), E2E/visual, reconciliation, dev дээр туг асааж хөтчөөр шалгах | 2 |

Нийт ~12 өдөр. v4-ийн локал commit/migration-уудыг өөрчлөхгүй; v5-ыг
0153-аас дараалуулж, дараа нь нэг PR цуваа болгон нээнэ. Тусдаа contract PR
байхгүй.

### 18.8 v5 acceptance ба reconciliation

1. Идэвхтэй category яг 5; `brand-pouch` идэвхгүй, бараа нь `gift-box`-д.
2. `bottled` нь `local_quantity`, `leftover_liquid` хоёрыг; бусад ангилал зөвхөн
   өөрийн зөвшөөрсөн mode-ийг FK түвшинд хүлээн авна. 0153 дуусахад
   `extra_categories.inventory_mode`, хуучин category FK/guard үлдээгүй байна.
3. Product/variant/order-item mode FK болон түүхэн мөр эвдрэхгүй.
4. Standalone shared-vial extra variant: 1ml/2ml татгалзана, 5/10/20ml зөвшөөрнө.
   Харин 1ml бэлгийн дээж, 2ml perfume order reserve/commit хэвийн ажиллана.
5. Шинэ `local_quantity` variant 0 нөөцтэй үүснэ; `initial_qty > 0`-г
   `INITIAL_STOCK_REQUIRES_PURCHASE` гэж татгалзана. Дараах purchase л анхны
   ширхэг ба өртгийг ledger-т оруулна.
6. 1ml ба 2ml нөөц нөхөхөд `+ширхэг`, нэгж үнэ, нийт cost, авсан өдөр нэг атомик
   хөдөлгөөн болно; тайланд тухайн `purchased_on` өдөр бүрэн зарлага болно.
7. Тоолж эхлээгүй саванд purchase хийхэд `STOCK_NOT_COUNTED`; эхний тооллогын
   дараа purchase амжилттай. Stale dialog-ийн хүсэлт тоо/өртөг өөрчлөхгүй.
8. Тоо засах хөдөлгөөн өртөг 0; purchase cost-ийг засвар/буцаалт давхардуулахгүй.
9. Нөөцийн invariant (сав ба нэмэлт бараа): бүх хөдөлгөөний
   `Σ delta_on_hand = одоогийн on_hand` (§14-тэй ижил). Савны usage count нь
   committed vial order items-тэй таарна.
10. 1/2ml-ийн standalone борлуулалт тайланд үргэлж 0; хэрэглээ ба худалдан авалт
    харагдана. 5/10/20ml-ийн perfume usage ба standalone sale тусдаа таарна.
11. Гоёмсог бэлгийн саванд дурын тооны variant, дурын нэр, зураг, чөлөөт
    `size_note` хадгална; 5/10/20ml эсвэл 1–3 гэсэн validation байхгүй.
12. Зөвшөөрөл: хоосон шил / үлдэгдэлтэй шилтэй сагс checkbox-гүй бол
    `USED_GOODS_CONSENT_REQUIRED`; зөвхөн бүтэн, лацтай шилтэй сагсанд шаардахгүй.
    ±1–2ml notice мөн зөвхөн үлдэгдэлтэй шилэнд харагдана.
13. `restock_log.purchased_on` backfill нь
    `(created_at at time zone 'Asia/Ulaanbaatar')::date`; UB сараар тооцсон
    худалдан авалтын нийлбэр backfill-ийн өмнө/дараа ижил. Одоогийн UB сарын
    1-нээс өмнөх болон UB өнөөдрөөс хойших огноог RPC татгалзана.
14. Тайлангийн нийт худалдан авалт = perfume restock + extra purchase + бүх vial
    purchase; profit formula §18.6-тай таарна.
15. `place_order(jsonb,jsonb)` хэвээр (overload нэмэгдээгүй); хуучин 5-arg
    `restock_inventory` overload үлдээгүй, харин 5 нэртэй аргументтай дуудлага
    (prod-ийн хуучин код) шинэ функцээр амжилттай ажиллана. Хоёулаа зөвхөн
    service role эрхтэй.
16. Feature flag OFF үед шинэ reserve/listing үүсэхгүй ч өмнөх movement-ийн
    commit/release ба тайлангийн ledger үргэлжилнэ.

### 18.9 Бэлгийн карт (дараа) — одоо бэлдэх зүйл

Бэлгийн карт нь нөөцгүй бараа: төлбөрийн үед код үүсгэж, имэйлээр илгээнэ,
код нь V point болж хувирна. Дараа нэмэхэд хялбар байлгахын тулд:

- `order_items.line_kind`-ийн check-ийг шинэ утгаар (`'gift_card'`) өргөтгөж
  болохоор үлдээнэ. TS-ийн `OrderItemRow` union-д нэг салаа нэмэгдэнэ.
- Нэмэлт барааны таб нь ангиллын tile-аар ажилладаг тул «Бэлгийн карт» tile нь
  тусдаа хуудас (`/gift-cards`) руу холбоно. Нөөцийн горим нэмэхгүй.
- Мэдэгдэж буй дүрэм (дараагийн төлөвлөгөөнд):
  - Дүн нь 100k/200k/300k/500k, дизайн сонгоно, мэндчилгээ болон «хэнээс»-ийг бичнэ.
  - Хүлээн авагчийн имэйл рүү код, заавар, QR илгээнэ.
  - Кодыг 1 жилийн дотор ашиглах ёстой; V point болсны дараа хугацаагүй.
  - Зөвхөн бүртгэлтэй хэрэглэгч ашиглана.
  - Оноо болон купоноор авахгүй.
  - Худалдан авагч түвшний хувиар V point авна.
  - Тайланд карт зарагдах үед орлого болно. Дараа нь оноогоор авсан бараа зарлага
    болно (клиентийн тайлангийн ppt).
