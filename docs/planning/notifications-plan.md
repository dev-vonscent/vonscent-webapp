# Хэрэглэгчийн мэдэгдэл (notifications)

> Төлөв: **хэрэгжсэн (dev)** — салбар `feat/notifications`; 0138–0142 dev-д орсон, dev дээр туг нээлттэй (2026-10-19). Prod: хараахан үгүй.
> Огноо: 2026-10-15 · клиентийн хариу 2026-10-18 · review засвар 2026-10-18 (§11)
> Feature flag: `notifications`
> Холбоотой: `docs/spec/development.md`, `docs/spec/design.md`, `0024_loyalty_pending`, `0091_points_unlock_on_delivery_day`, `0112`–`0114` (буцаалт), `0124_unpaid_order_to_saved`, `0129_spin_wheel_v2`, `0133_feature_flags`

## 1. Зорилго

Header-т хонхны icon + уншаагүйн тоо. Шинэ мэдэгдэл ирэхэд баруун дээд
буланд toast гарна. Мэдэгдэл бүр URL (дарахад шилжих) ба сонголтоор
thumbnail зурагтай.

Хоёр эх үүсвэр:

| Төрөл | Хэн үүсгэх | Жишээ |
| --- | --- | --- |
| **Нийтийн (broadcast)** | Админ гараар | Шинэ бараа, хямдрал, кампанит ажил, шинэ feature |
| **Хувийн (personal)** | Систем автоматаар (trigger / RPC / cron) | Захиалгын төлөв, V оноо нээгдлээ, азын хүрдний өдрийн үнэгүй эрх сэргэлээ |

Одоо байгаа `admin_notifications` (0032, staff-ийн дотоод мэдэгдэл,
`/admin/notifications`) **хөндөгдөхгүй** — энэ бол тусдаа, хэрэглэгчийн систем.

## 2. Шийдвэрүүд

| # | Асуулт | Шийдвэр |
| --- | --- | --- |
| 1 | Broadcast-ыг хэрхэн хадгалах? | **Fan-out:** илгээх үед хэрэглэгч бүрт `user_notifications` мөр нэг `insert … select`-ээр. Хувийн мэдэгдэлтэй нэг хүснэгт. Манай хэмжээнд (≤ хэдэн арван мянган хэрэглэгч) нэг statement хангалттай. |
| 2 | Илгээсний дараа бүртгүүлсэн хэрэглэгч хуучин broadcast-ыг харах уу? | **Үгүй** — клиент баталсан (2026-10-18). Fan-out-ын байгалийн үр дүн. |
| 3 | Зочин хонх харах уу? | **Үгүй.** Хонх зөвхөн нэвтэрсэн үед. |
| 4 | Шинэ мэдэгдлийг яаж хүргэх? | **Polling** (60с + window focus, §5). Realtime phase 2-т — `visible_at`-тай хойшлуулсан мөрөнд Realtime INSERT үед л event өгдөг. |
| 5 | Хэн broadcast илгээх эрхтэй? | `operator` + `super_admin` — клиент баталсан (2026-10-18). |
| 5a | Broadcast хэнд очих вэ? | **Бүх профайл, staff-ийг оруулаад** — клиент баталсан. Staff ч өөрөө захиалга хийдэг. |
| 6 | Сурталчилгааны мэдэгдлээс татгалзах уу? | **Үгүй** — toggle хийхгүй (клиент баталсан, 2026-10-18). |
| 7 | Push / SMS / имэйл суваг? | **Үгүй — зөвхөн in-app** (клиент баталсан, 2026-10-18). |
| 8 | Хадгалах хугацаа | Уншсан → 90 хоног, бүгд → 180 хоног (§3 cron) — клиент баталсан (2026-10-18). |

## 3. Өгөгдлийн загвар — `0138_notifications.sql`

```sql
create type notification_kind_t as enum (
  -- broadcast
  'product_new', 'promotion', 'campaign', 'feature', 'announcement',
  -- personal
  'points_released', 'free_spin_ready',
  'order_paid', 'order_shipping', 'order_delivered',
  'order_cancelled', 'order_refunded', 'order_saved'
);  -- шинэ төрлийг `alter type … add value`-ээр (expand-only)

-- Админы бичсэн нийтийн мэдэгдэл (эх загвар + статистик). Хэзээ ч устгахгүй —
-- буцааж татсан ч `cancelled` төлөвтэй үлдэнэ (audit).
create table notification_broadcasts (
  id           uuid primary key default gen_random_uuid(),
  kind         notification_kind_t not null,
  title        text not null check (char_length(title) between 1 and 80),
  body         text check (char_length(body) <= 300),
  url          text check (url is null or char_length(url) <= 500),
  image_path   text,
  audience     text not null default 'all' check (audience in ('all')), -- phase 2: сегмент
  publish_at   timestamptz not null default now(),
  status       text not null default 'draft'
               check (status in ('draft','scheduled','sent','cancelled')),
  sent_at      timestamptz,
  recipient_count int,
  cancelled_at timestamptz,
  cancelled_by uuid references profiles(id),
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Хэрэглэгч бүрийн мэдэгдэл (хувийн + fan-out хийсэн broadcast)
create table user_notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles(id) on delete cascade,
  kind         notification_kind_t not null,
  title        text not null check (char_length(title) between 1 and 120),
  body         text check (char_length(body) <= 400),
  url          text check (url is null or char_length(url) <= 500),
  image_path   text,
  data         jsonb not null default '{}' check (jsonb_typeof(data) = 'object'),
  broadcast_id uuid references notification_broadcasts(id) on delete cascade,
  dedupe_key   text check (char_length(dedupe_key) <= 120),
  visible_at   timestamptz not null default now(), -- ирээдүйд → тэр цагт л харагдана
  read_at      timestamptz,
  created_at   timestamptz not null default now(),
  -- broadcast мөр broadcast_id-аар, хувийн мөр dedupe_key-ээр давхардлаас хамгаалагдана
  check (
    (broadcast_id is not null and dedupe_key is null)
    or (broadcast_id is null and nullif(dedupe_key, '') is not null)
  )
);

create unique index user_notifications_dedupe_uidx
  on user_notifications (user_id, dedupe_key) where dedupe_key is not null;
create unique index user_notifications_broadcast_uidx
  on user_notifications (user_id, broadcast_id) where broadcast_id is not null;
create index user_notifications_feed_idx
  on user_notifications (user_id, visible_at desc, id desc);
create index user_notifications_unread_idx
  on user_notifications (user_id, visible_at) where read_at is null;
```

**Dedupe key-ийн нэг стандарт:**

| Төрөл | `dedupe_key` |
| --- | --- |
| Захиалга | `order:<order_id>:<kind>` |
| V оноо | `points:order:<order_id>` |
| Үнэгүй эрх | `free_spin:<spin_id>` |
| Broadcast тест | `broadcast-test:<broadcast_id>:<uuid>` (`broadcast_id = null` — жинхэнэ илгээлттэй зөрчилдөхгүй) |

**RLS / эрх:**
- `user_notifications`: хэрэглэгчид **зөвхөн SELECT** (`user_id = auth.uid()`).
  UPDATE policy **өгөхгүй** — RLS багана биш мөр хамгаалдаг тул update эрх
  өгвөл хэрэглэгч гарчиг/URL-аа өөрчилж чадна. `anon, authenticated`-аас
  insert/update/delete revoke.
- `notification_broadcasts`: staff select; бичилт service_role-оор.
- Бүх `security definer` функц: `set search_path = public`,
  `revoke all … from public, anon, authenticated`, `grant execute … to service_role`
  (0124-ийн жишгээр).

**RPC-ууд:**
- `notify_user(p_user, p_kind, p_title, p_body, p_url, p_data, p_dedupe, p_visible_at)`
  — `if not feature_enabled('notifications') then return null; end if;`
  `on conflict do nothing`. Бусад бүх хувийн producer үүнийг дуудна.
- `send_broadcast(p_id)` — row lock, `status in ('draft','scheduled')` шалгаад
  `insert into user_notifications select … from profiles` (**role-оор шүүхгүй**, #5a),
  `get diagnostics v_n = row_count` → `recipient_count` (урьдчилсан `count(*)` биш —
  зэрэг бүртгүүлэлтээс зөрөхгүй), `sent_at`. Туг хаалттай бол алдаа.
- `cancel_broadcast(p_id, p_by)` — хэрэглэгчийн мөрүүдийг устгана, broadcast
  мөр `cancelled` + `cancelled_at/by`-тай үлдэнэ.
- `mark_notifications_read(p_user, p_ids uuid[] | null)` — null = бүгдийг;
  зөвхөн `visible_at <= now()` мөр. `p_user`-ийг route handler **session-оос**
  авна, request body-оос хэзээ ч биш.
- Засварлах дүрэм: broadcast-ыг зөвхөн `draft`/`scheduled` үед засна.

**pg_cron** (`cron.unschedule(name)` → `cron.schedule(...)`, idempotent):
- `send-scheduled-broadcasts` `*/5 * * * *` — туг нээлттэй үед л;
  `status='scheduled' and publish_at <= now()` мөрүүдийг `for update skip locked`,
  нэг бүрийг өөрийн `begin … exception` блокт (нэг эвдэрсэн нь бусдыг блоклохгүй).
  Туг удаан хаалттай байгаад нээгдвэл `publish_at`-аас 24 цагаас хэтэрсэн
  хуваарьт broadcast-ыг **илгээхгүй**, `scheduled` хэвээр үлдээж админы
  жагсаалтад «Хугацаа хэтэрсэн» гэж харуулна (хуучирсан хямдрал санамсаргүй
  явахаас сэргийлнэ).
- `prune-notifications` `30 4 * * *`:
  `delete … where read_at < now() - interval '90 days' or visible_at < now() - interval '180 days'`
  (`created_at`-аар биш — ирээдүйд харагдах мөрийг устгахгүй).

**Туг:** migration-д `insert into feature_flags (key) values ('notifications') on conflict do nothing;`
**ба** `src/lib/constants.ts`-ийн `FEATURE_FLAGS`-д `notifications` түлхүүр
(label + description) — хоёулаа.

## 4. Хувийн мэдэгдлийн producer-ууд

Producer тус бүр **тусдаа migration** — том SQL функцуудын шинэ хувилбарыг
санамсаргүй хуучруулах эрсдэл багасна. Функц бүрийг **хамгийн сүүлийн
хувилбараас** хуулж зөвхөн мөр нэмнэ:

| Migration | Агуулга | Хуулах эх |
| --- | --- | --- |
| `0139_notify_points.sql` | V оноо | `release_order_points`, `release_due_points` (0024) |
| `0140_notify_free_spin.sql` | Үнэгүй эрх | `spin_wheel` (0129) |
| `0141_notify_orders.sql` | Захиалга + «Дараа захиалах» + буцаалт | `update_order_status` (0112), `abandon_unpaid_order` (0124) |

Бүх producer: бизнес үйлдэл **үргэлж** хийгдэнэ, зөвхөн мэдэгдлийн insert туг
шалгана (`notify_user` дотор).

### 4.1 V оноо нээгдлээ — `0139`

Оноо **гурван замаар** нээгддэг: `release_due_points` (cron, 15 мин),
`mark_order_paid` (`available_at` өнгөрсөн бол шууд, 0093), `update_order_status`
→ `delivered`. Гурвуулаа `release_order_points(p_order)`-ийг дууддаг/дуудна —
тиймээс **мэдэгдлийг тэр нэг helper дотор** үүсгэнэ:

- `release_order_points`: нийт нээсэн дүн `v_total > 0` бол
  `notify_user(…, 'points_released', «VS-1042 захиалгын 1,200 V оноо ашиглах боломжтой боллоо», '/account/loyalty', {points, orderId}, 'points:order:<id>')`.
  Ledger мөрүүд `for update` түгжигддэг тул зэрэг ажилласан хоёр дахь дуудлага
  0 буцааж мэдэгдэл үүсгэхгүй; dedupe нэмэлт хамгаалалт.
- `release_due_points`: ledger мөр бүрээр биш — due болсон мөрүүдийн
  **`order_id`-аар** давтаж `release_order_points(order_id)` дуудна
  (`for update skip locked`). `order_id is null` хуучин ledger мөрүүдийг
  одоогийнхоор нээнэ, **мэдэгдэлгүй**.
- Хүргэгдэх үед «Хүргэгдлээ» ба «оноо нээгдлээ» хоёр тусдаа мэдэгдэл байна
  (нэгтгэхгүй — нэгтгэвэл trigger-т дүн дамжуулах нэмэлт механизм хэрэгтэй).

### 4.2 Өдрийн үнэгүй эрх сэргэлээ — `0140`

`spin_wheel(p_mode='free')` амжилттай болоход:

1. Тухайн хэрэглэгчийн **уншаагүй** `free_spin_ready` мөрүүдийг устгана
   (өмнөх «эрх сэргэлээ» одоо худал болсон).
2. Шинэ мөр: `visible_at = spin.created_at + freeSpinHours`,
   `dedupe_key = 'free_spin:<spin_id>'`, `data = {spinId, spunAt}`.
   Текст «Азын хүрдний өдрийн үнэгүй эрх сэргэлээ» (emoji-гүй), URL `/lucky-wheel`.

Хуучрахаас хамгаалах:
- **`freeSpinHours` өөрчлөгдөх:** `settings` (`key = 'spin'`) дээр trigger —
  ирээдүйн уншаагүй `free_spin_ready` мөрүүдийн
  `visible_at = (data->>'spunAt')::timestamptz + шинэ цаг` болгож шинэчилнэ
  (`spin_wheel_state()`-тэй үргэлж таарна).
- **`lucky_wheel` туг хаалттай / хүрд «Идэвхгүй»:** устгах биш, **унших үед
  шүүнэ** — feed/poll query `kind <> 'free_spin_ready' or (feature_enabled('lucky_wheel') and хүрд идэвхтэй)`.
  Тугийг аль ч route-аар хаасан ч зөв ажиллана, cleanup хэрэггүй.

### 4.3 Захиалгын төлөв — `0141` (клиент баталсан, 2026-10-18)

**Зарчим (e-commerce best practice):**
- Зөвхөн хэрэглэгчийн **хийх зүйл эсвэл хүлээлтийг өөрчилдөг** milestone:
  төлсөн → хүргэлтэд → хүргэгдсэн, мөн цуцлалт/буцаалт. Дотоод алхам
  (`prepared_at`, 0099) — үгүй.
- Шошго `ORDER_STATUS_LABEL`-тай ижил үгээр.
- Богино: захиалгын дугаар + юу болсон + хийх зүйл.
- Зочин (`user_id is null`) — алгасна; тэдэнд имэйл хангалттай.

**Хаана:** `orders` дээр `after update of status, payment_status` trigger
(`orders_notify`), `orders_on_cancelled`-ийн (0113/0124) жишгээр. Бүх зам нэг
цэгээр: админ/courier, cron `auto_dispatch_orders`/`auto_deliver_orders`,
QPay `mark_order_paid`, `mark_order_refunded`. `order_status_history` дээр биш —
нэг шилжилтэд олон мөр бичигддэг.

**Актор (зөвхөн хэрэглэгчийн өөрийн цуцлалтыг дарахад):**
`update_order_status`-д яг нэг `update orders`-ийн **өмнө**
`set_config('vonscent.order_actor', coalesce(p_by::text,''), true)`, **дараа**
нь `set_config('vonscent.order_actor', '', true)` — нэг transaction-д дараагийн
update руу хуучин актор дамжихгүй. Trigger:
`nullif(current_setting('vonscent.order_actor', true), '')::uuid`.
Энэ дүрэм **зөвхөн `order_cancelled`-д** — бусад event (жишээ нь staff өөрийн
захиалгаа «хүргэлтэд» болгох) актороос үл хамааран үүснэ.

| Шилжилт | `kind` | Текст (жишээ) | Тайлбар |
| --- | --- | --- | --- |
| `payment_status` unpaid → paid | `order_paid` | «VS-1042 захиалгын төлбөр баталгаажлаа. 10/20-нд хүргэнэ.» | `NEW.deliver_on` (0069-ийн шилжилт орсон). Урамшууллын купон үүссэн бол «Дараагийн захиалгад купон нэмэгдлээ» нэг мөр. |
| → `shipping` | `order_shipping` | «VS-1042 захиалга тань өнөөдөр хүргэлтэд гарлаа. Утсаа ойрхон байлгаарай.» | Хамгийн үнэ цэнтэй — одоо ямар ч сувгаар хэлдэггүй. |
| → `delivered` | `order_delivered` | «VS-1042 захиалга хүргэгдсэн гэж бүртгэгдлээ. Хүлээж аваагүй бол бидэнтэй холбогдоорой.» | 23:00 авто шилжилт курьерын баталгаагүй тул зөөлөн текст (клиент баталсан). Оноо — тусдаа (§4.1). |
| → `cancelled`, төлсөн, актор ≠ эзэн | `order_cancelled` | «VS-1042 захиалга цуцлагдлаа. Төлбөрийн буцаалтын талаар бид тантай холбогдоно.» | Хугацаа амлахгүй. |
| → `cancelled`, актор = эзэн | — | — | Өөрийн үйлдэл; имэйл аль хэдийн явдаг. |
| `payment_status` → refunded | `order_refunded` | «VS-1042 захиалгын ₮45,000 буцаан олгогдлоо.» | Дүн = **`NEW.refund_amount`** (0114) — дахин тооцохгүй. |
| Төлөгдөөгүй → «Дараа захиалах» (автомат) | `order_saved` | «Төлөгдөөгүй захиалгаа «Дараа захиалах»-д хадгаллаа. Хүссэн үедээ нэг товчоор үргэлжлүүлээрэй.» | Trigger биш — **`abandon_unpaid_order`** дотор: `p_save and p_by is null and save_order_for_later(...) is not null` үед. Cron (`release_expired_reserves`) ба account хуудасны `settle-expired` хоёулаа хамрагдана; хэрэглэгчийн товч (`p_by = owner`) — үгүй. URL `/account/orders?tab=saved`. |
| `pending` үүсэх, `prepared_at` | — | — | |

- Буцах шилжилт (админ `shipping` → `confirmed` засах) — мэдэгдэлгүй.
- URL: `/account/orders/<id>` (`order_saved`-ээс бусад).
- Icon (lucide): `CreditCard`, `Truck`, `PackageCheck`, `XCircle`, `RotateCcw`, `Bookmark`.
- Phase 2: хүргэх өдөр админаар өөрчлөгдсөн, хүргэлт амжилтгүй; купон
  олгогдлоо (0118, 0135), бэлгийн карт, санал болгосон үнэртэн нэмэгдлээ (0137),
  хүслийн жагсаалтын бараа дахин орлоо.

## 5. API (route handler, Zod, эрх handler бүрт)

```
GET   /api/notifications?cursor=&limit=20     # feed
GET   /api/notifications/poll?cursor=         # 60с тутам
POST  /api/notifications/read                 # { ids: uuid[] } | { all: true }

GET   /api/admin/broadcasts                   # жагсаалт + уншсан тоо
POST  /api/admin/broadcasts                   # draft үүсгэх / засах
POST  /api/admin/broadcasts/:id/send          # одоо эсвэл publish_at-д хуваарьлах
POST  /api/admin/broadcasts/:id/test          # зөвхөн өөртөө
POST  /api/admin/broadcasts/:id/cancel
```

- **Gate дараалал:** хэрэглэгчийн route — туг 404 → нэвтрээгүй 401 →
  `user_id`-аар хязгаарласан query. Админ route — туг 404 → staff биш 403 →
  service-role client.
- **Cursor:** client timestamp биш — сервер үүсгэсэн opaque cursor
  `(visible_at, id)`. Feed эрэмбэ `visible_at desc, id desc`, нөхцөл
  `visible_at <= server now()`. Ингэснээр өнөөдөр үүсээд маргааш харагдах мөр
  (үнэгүй эрх) харагдах үедээ «шинэ» болж ирнэ.
- **Poll хариу:** `{ unread, freshCount, fresh: Notification[] /* ≤5 */, nextCursor }`.
  5-аас олон бол toast «N шинэ мэдэгдэл» (`freshCount`-аар), cursor бүгдийг
  давуулна.
- **URL validation** (`src/lib/validators/notification.ts`): `/`-ээр эхэлсэн
  дотоод path (`safeNext`-ийн дүрэм; `//` protocol-relative хориотой) эсвэл
  `https://`. Credentials (`user:pass@`), control char хориотой. Бичдэг нь
  staff тул hostname allowlist хийхгүй.
- **Rate limit:** `RATE_LIMITS`-д `broadcastSend`, `broadcastTest` шинэ түлхүүр.

## 6. UI

```
src/features/notifications/
  api.ts · types.ts
  use-notifications.ts           # useQuery(poll) + useInfiniteQuery(feed) + markRead
  use-notification-toasts.ts
  components/notification-bell.tsx · notification-panel.tsx
  components/notification-item.tsx · notification-toast.tsx
  components/broadcast-admin.tsx
src/app/(account)/account/notifications/page.tsx
src/app/(admin)/admin/broadcasts/page.tsx          # /admin/notifications эзэлсэн
```

**Query:** global config `refetchOnWindowFocus: false` (`providers.tsx`) тул
энд тодорхой: `refetchInterval: 60_000, refetchOnWindowFocus: true,
enabled: flagOn && !!userId`. Query key-д `userId` — logout / хэрэглэгч
солигдоход өмнөхийн feed харагдахгүй.

**Хонх (header):** `src/components/shared/site-header.tsx` гурван байрлалтай —
тус бүрд:
1. Нүүр хуудасны mobile floating header — сагсны зүүн талд.
2. Дотоод хуудасны mobile compact header (`md:hidden`) — сагсны зүүн талд.
3. Desktop header — сагс төв nav-д байдаг тул хайлт ба профайлын хооронд.

Badge 1–99, «99+»; 0 бол алга. `aria-label="Мэдэгдэл, уншаагүй 3"`. Туг хаалттай
эсвэл зочин бол render хийхгүй.

**Panel:** сүүлийн 20, «Бүгдийг уншсан болгох», «Бүгдийг харах» →
`/account/notifications`. Уншаагүй — dot + bg token. Дарахад уншсан (optimistic)
→ дотоод URL `router.push`, гадаад шинэ tab. Хоосон үед `EmptyState`.

**Item:** `image_path` байвал 48×48 thumbnail, үгүй бол `kind`-аас icon
(`PackagePlus`, `Percent`, `Megaphone`, `Rocket`, `VPointIcon`, `Gift`,
захиалгынх §4.3). Хугацаа «5 мин өмнө», «Өчигдөр» (`lib/time`-д
`formatRelative`, test-тэй).

**Toast:** баруун дээд (mobile дээд төв), 6с, дарахад шилжинэ, хаах товчтой.
- Анх ачаалахад хуучин уншаагүйг toast болгохгүй — зөвхөн session эхэлснээс хойш.
- 2-оос олон бол нэг toast «N шинэ мэдэгдэл».
- Олон tab: **зөвхөн харагдаж буй tab** (`document.visibilityState === 'visible'`)
  toast гаргана + `BroadcastChannel`-аар үзүүлсэн id хуваалцана. Энэ нь
  best-effort — хоёр tab зэрэг харагдвал давхар гарч болно, хүлээн зөвшөөрнө.
- `prefers-reduced-motion`; gradient үгүй, theme token л.

**Админ «Мэдэгдэл илгээх»** (Маркетинг цэс):
- Форм: төрөл, гарчиг (≤80), текст (≤300), холбоос (бараа/цуглуулга/кампанит
  ажил сонгогч + гараар path), зураг, илгээх цаг (одоо / хуваарьт).
- **Зураг:** `/api/upload`-ийн `FOLDERS`-д `notifications: "staff"` нэмнэ
  (одоо `BAD_FOLDER`). Зам нь generic `notifications/<user-id>-<uuid>.webp`
  (broadcast id биш). Orphan зураг цэвэрлэх — phase 2.
- Баруун талд урьдчилан харах: panel item + toast.
- «Надад туршиж илгээх» (§3 тест dedupe), `ConfirmDialog` «1,234 хэрэглэгчид илгээх үү?»
- Жагсаалт: төлөв, илгээсэн/уншсан тоо, буцааж татах, «Хугацаа хэтэрсэн».
- Бараа засах хуудсанд «Шинэ бараа мэдэгдэл илгээх» товч — урьдчилан бөглөсөн форм.

## 7. Хамгаалалт ба шалгалт

- **Туг 3 давхаргад:** route → 404; хонх → `useFeatureFlag`; `notify_user`,
  `send_broadcast`, cron → `feature_enabled('notifications')`. Хаалттай үед prod
  дээр `user_notifications` мөр **нэг ч** хуримтлагдах ёсгүй (0130-ийн сургамж) —
  оноо нээх (3 зам), хүрд эргүүлэх, захиалга төлөх → хүргэлтэд → хүргэгдсэн →
  цуцлах/буцаах, «Дараа захиалах»-ыг dev дээр туг хаалттай ажиллуулж
  `count(*) = 0`-ийг шалгана.
- Broadcast илгээлт row lock + `(user_id, broadcast_id)` unique → давхар илгээгдэхгүй.
- XSS: plain text, URL validator.
- **Тест (vitest):** URL validator, Zod schema, cursor encode/decode,
  `formatRelative`, toast dedupe (анхны ачаалал, олон шинэ → нэгтгэх, далд tab),
  badge «99+».
- **SQL шалгалт (dev):** нэг захиалгын оноо нэг л мэдэгдэл (cron + хүргэлт
  зэрэг), шинэ free spin хуучин уншаагүйг устгана, `freeSpinHours` солиход
  `visible_at` шинэчлэгдэнэ, хэрэглэгч өөрөө цуцлахад мэдэгдэлгүй.
- **E2E:** одоогийн Playwright config Supabase env-ийг хоосолдог (demo mode) тул
  нэвтэрсэн урсгал шалгах боломжгүй — phase 1-д E2E **үгүй**. Seeded integration
  config гарвал нэмнэ.

## 8. Release

1. `0138`–`0141` → `pnpm db:migrate-dev` → dev дээр туг нээж клиент туршина.
2. `pnpm db:migrate-prod` (туг хаалттай) → main руу merge.
3. Release өдөр Админ → Feature flag → `notifications` нээх. Эхний broadcast
   «Шинэ боломж: мэдэгдэл».
4. Тогтворжсоны дараа тугийг код + сангаас устгах тусдаа PR.

PR тайлбарт: туг `notifications`, migration 0138–0141, хаалттай үед мөр
хуримтлагдаагүйг шалгасан query.

## 9. Үе шат

| Үе | Агуулга |
| --- | --- |
| **1. Schema + security** | 0138: хүснэгт, constraint, unique index, RLS/revoke, RPC, cron, `FEATURE_FLAGS` |
| **2. Хэрэглэгчийн feed/UI** | API (feed/poll/read, cursor), хонх 3 байрлалд, panel, `/account/notifications`, toast |
| **3. Админ broadcast** | upload folder, форм, preview, тест, хуваарь, буцаах, статистик, rate limit |
| **4. Producer-ууд** | 0139 оноо → 0140 үнэгүй эрх → 0141 захиалга |
| **Phase 2** | Realtime, нэмэлт producer, сегментлэлт, orphan зураг цэвэрлэх |

## 10. Клиентээс тодруулах

Хариулсан (2026-10-18):

1. ~~Broadcast илгээх эрх~~ → `operator` + `super_admin`.
2. ~~Staff-д broadcast очих уу~~ → Тийм, staff өөрөө захиалга хийдэг.
3. ~~Шинэ хэрэглэгч өмнөх зарыг харах уу~~ → Үгүй.
4. ~~Захиалгын төлөв нэмэх үү~~ → Тийм, §4.3.
5. ~~§4.3-ийн жагсаалт тохирох уу~~ → Тийм, байгаагаар нь.
6. ~~23:00-ийн авто «Хүргэгдсэн» текст~~ → Зөөлрүүлнэ.
7. ~~Сурталчилгаанаас татгалзах toggle~~ → Хэрэггүй.
8. ~~Push / SMS / имэйл~~ → Үгүй, зөвхөн in-app.
9. ~~Хадгалах хугацаа 90/180 хоног~~ → Тийм.

Нээлттэй асуулт байхгүй.

## 11. Review-ээс авсан / аваагүй (2026-10-18)

Гадны AI review-г кодтой тулгаж шалгав.

**Авсан** (кодоор баталгаажсан): оноо ledger бүрээр loop хийдэг (0024) →
захиалгаар нэгтгэх; `mark_order_paid` оноо шууд нээдэг (0093) → helper дотор
мэдэгдэл; owner UPDATE RLS хасах; `dedupe_key is null` broadcast-ыг unique
хамгаалахгүй → partial index + check; `ROW_COUNT`; client `since` → сервер
cursor; актор дүрмийг зөвхөн цуцлалтад, `set_config`-ийг цэвэрлэх;
`settle-expired.ts` мөн `abandon_unpaid_order` дууддаг → `order_saved`-ийг тэнд;
`?tab=saved` URL; буцаалтын дүн `refund_amount` (0114); `FEATURE_FLAGS`
registry; `RATE_LIMITS` түлхүүр; upload `FOLDERS`-д `notifications` байхгүй;
header 3 байрлал; global `refetchOnWindowFocus: false`; Playwright demo mode;
free spin хуучрах / `freeSpinHours` солигдох; retention query; хуваарьт
broadcast-ын хэтэрсэн хугацаа; migration-ыг producer тус бүрээр хуваах.

**Өөрчилж авсан:**
- Хүргэлт + онооны мэдэгдлийг нэгтгэх → **нэгтгэхгүй**, хоёр тусдаа. Нэгтгэх нь
  trigger-т дүн дамжуулах нэмэлт механизм шаардана; ашиг нь бага.
- `lucky_wheel` хаахад DB cleanup → устгахын оронд **унших үед шүүх** (энгийн, route-оос үл хамаарна).
- Олон tab-ын `navigator.locks` leader → харагдаж буй tab + best-effort.

**Аваагүй:**
- Гадаад URL-ын hostname allowlist — бичдэг нь итгэмжлэгдсэн staff;
  protocol/credentials шалгалт хангалттай.
- Broadcast-ын `read_count` snapshot — 90 хоногоос хойшхи уншилтын статистик
  бизнест хэрэггүй.

## 12. Хэрэгжүүлэлтийн тэмдэглэл (2026-10-19)

Төлөвлөгөөнөөс зөрсөн:

- **Үнэгүй эрх (0140):** `spin_wheel` (~220 мөр)-ийг хуулж засахын оронд
  `spin_wheel_spins` дээр AFTER INSERT trigger (`spin_type = 'free'`).
  Үр дүн ижил, том функцыг хуучруулах эрсдэлгүй.
- **`freeSpinHours` солигдох:** «ирээдүйн» биш БҮХ уншаагүй
  `free_spin_ready`-ийг дахин тооцно — цагийг уртасгахад аль хэдийн
  харагдсан мөр ч худал болдог.
- **Захиалгын trigger-ийн нэр `orders_user_notify`:** Postgres trigger-үүдийг
  нэрээр эрэмбэлдэг — `orders_reward_coupon`-оос хойш ажиллаж «купон
  нэмэгдлээ»-г шалгана.
- **Panel:** popover биш баруун талын sheet (сагстай ижил; төсөлд popover байхгүй).
- **Засах route:** `POST` биш `PUT /api/admin/broadcasts/:id`.
- **Холбоос сонгогч:** бараа + багц. Кампанит ажилд нийтийн хуудас байхгүй.
- **Туршилтын route** нь `notify_user`-ийг тойрдог тул `feature_enabled()`-ийг
  сангаас шууд шалгана (кэштэй тугаас гадна).

Замдаа олдсон хуучин алдаа:

- **0140 / 0142:** `spin_wheel(uuid, text)` ба `spin_wheel_state(uuid)` нь
  security definer + `p_user` параметртэй атлаа PUBLIC-д execute эрхтэй байв
  (0129 гарын үсгийг сольсны дараа 0053b-ийн revoke хамаарахаа больсон).
  anon түлхүүрээр бусдын нэрийн өмнөөс эргүүлэх / төлөв унших боломжтой.
  Prod-д ч мөн адил байх магадлалтай — feature-ээс үл хамааран тусад нь
  оруулж болно (idempotent).

SQL шалгалт (dev, rollback transaction, §7): туг хаалттай — бүх producer
(оноо 3 зам, хүрд, төлөх → хүргэлтэд → хүргэгдсэн → цуцлах/буцаах,
«Дараа захиалах») ажиллуулахад `user_notifications` 0 мөр. Нээлттэй — тус
бүр яг 1, давхар нээлт/cron давталт 0, эзний цуцлалт 0, `shipping` →
`confirmed` → `shipping` 1, шинэ эргэлт хуучин уншаагүйг устгана,
`freeSpinHours` 24 → 48 үед `visible_at` шинэчлэгдэнэ.
