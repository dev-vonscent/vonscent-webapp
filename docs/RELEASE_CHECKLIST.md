# Release-ээс өмнө хийх зүйлс — vonscent.mn

Сүүлд шинэчилсэн: 2026-09-12. Хийсэн зүйл бүрийг `[x]` болгож тэмдэглэ.

---

## 1. Имэйл — Resend (бүх тохиргоо release-ийн өмнө)

Захиалга баталгаажих/цуцлагдах имэйл, contact формын дамжуулалт бүгд
Resend-ээр явна. `RESEND_API_KEY` байхгүй бол код чимээгүй алгасдаг тул
release хүртэл юу ч эвдрэхгүй — гэхдээ release дээр заавал асаана.

- [x] **Бүртгүүлэх:** [resend.com](https://resend.com) → Sign up (GitHub эсвэл
      имэйл). Free багц: өдөрт 100, сард 3,000 имэйл — эхлэхэд хангалттай.
      Сарын 3,000-д ойртвол paid руу шилжинэ (development.md §9.5).
- [x] **Домэйн баталгаажуулах:** Dashboard → Domains → Add Domain →
      `vonscent.mn` (Region: Tokyo ойр). Resend-ийн өгсөн DNS бичлэгүүдийг
      домэйны DNS самбарт нэмнэ:
      - MX + TXT (SPF) — `send.vonscent.mn` дээр
      - TXT (DKIM) — `resend._domainkey.vonscent.mn` дээр
      - DMARC санал болговол мөн нэмнэ
      Дараа нь Resend дээр **Verify** — минутаас хэдэн цаг хүлээнэ.
      ⚠ Домэйн баталгаажаагүй бол default `onboarding@resend.dev` илгээгч нь
      зөвхөн өөрийн бүртгэлтэй имэйл рүү явдаг — бодит хэрэглэгчид очихгүй.
- [x] **API key:** Dashboard → API Keys → Create:
      Name `vonscent-production`, Permission **Sending access**, Domain
      `vonscent.mn`. `re_...` key-г нэг л удаа харуулна — шууд хуул.
- [x] **Env:** `.env.local` + Vercel (Settings → Environment Variables,
      Production):
      ```
      RESEND_API_KEY=re_xxxxxxxxxx
      EMAIL_FROM=Vonscent <no-reply@vonscent.mn>
      ```
      `STORE_INBOX_EMAIL` default нь vonscent.store@gmail.com — өөрчлөх бол л нэмнэ.
- [~] **Шалгах:** локал дээр захиалга баталгаажуулж шалгасан (2026-09-03,
      Resend: Sent → Delivered). Vercel дээрх deploy дээр давтан шалгах үлдсэн —
      env тавьсны дараа **redeploy** шаардлагатай, мөн
      `NEXT_PUBLIC_SITE_URL=https://dev.vonscent.mn` байх ёстой (эс бөгөөс имэйл
      доторх линк localhost руу заана).
      Хуучин заавар: contact формоос мессеж илгээх + mock төлбөр баталгаажуулах →
      Resend Dashboard → Logs дээр илгээлтүүд харагдана. Хэрэглэгчийн имэйл
      очихын тулд тухайн данс footer-ийн формоор имэйлээ бүртгүүлсэн байх
      ёстойг санаарай.

## 2. Домэйн ба hosting

- [ ] **vonscent.mn** домэйныг Vercel project-д холбох (Vercel → Domains).
- [ ] Vercel env: `NEXT_PUBLIC_SITE_URL=https://vonscent.mn` (имэйл доторх
      линк, sitemap, OG бүгд үүнээс уншина).
- [x] **Vercel Pro** багц авах — $20/сар (1 deploy seat) + $20 credit, дотор нь
      1 TB Fast Data Transfer, 10 сая Edge Request. Hobby нь **арилжааны
      хэрэглээ хориотой**, Spend Management байхгүй, image квот давбал зураг
      402 алдаа буцаана. Fluid compute дээр функцийн хугацаа 300s (Pro 800s) —
      `after()` доторх OpenAI зураг үүсгэлтэд хүрэлцэнэ.
      ⚠ **Vercel Cron-д ч заавал:** Hobby дээр cron өдөрт нэг л удаа
      ажилладаг тул `vercel.json`-ы `*/5 * * * *` (төлбөр тулгалт) Pro-гүйгээр
      огт ажиллахгүй байсан.
- [x] **Supabase Pro** багц авах — $25/сар + $10 compute credit (Micro).
      Free project 1 долоо хоног идэвхгүй бол унтардаг; Pro-д өдрийн backup
      (7 хоног), лог 7 хоног, pg_cron найдвартай. Багтсан: 8 GB DB, 250 GB
      egress, 100 GB storage, 100k MAU.
- [ ] Pro орчинд **pg_cron ажиллаж буйг шалгах** (Pro болсны ДАРАА заавал —
      Free үед job-ууд бүртгэгдсэн ч төсөл унтарвал ажиллахгүй байсан):

      ```sql
      -- 6 job, бүгд active байх ёстой
      select jobname, schedule, active from cron.job order by jobname;

      -- Сүүлийн ажиллалтууд амжилттай юу (Pro-д лог 7 хоног)
      select j.jobname, r.status, r.start_time, r.return_message
        from cron.job_run_details r
        join cron.job j on j.jobid = r.jobid
       order by r.start_time desc limit 20;
      ```

      Хүлээгдэж буй 6: `release-expired-reserves`, `refresh-sold-out`,
      `release-due-points`, `auto-dispatch-orders`, `auto-deliver-orders`,
      `prune-rate-limits`. Дутуу байвал тухайн migration-ийг дахин ажиллуул.

### 2.1 Зардлын хяналт (Pro руу шилжихэд заавал)

Тарифыг `icn1` (Seoul) бүсээр тооцов — функц тэнд ажиллана (`vercel.json`).
Дэлгэрэнгүй: Vercel-ийн багтсан нөөцөөс гадуур ISR write $5.20/1M (8KB unit),
Edge Request $2.60/1M, Fast Origin Transfer $0.24/GB, invocation $0.60/1M.

- [ ] **Vercel Spend Management** асаах (Hobby дээр байхгүй): threshold ~$100,
      и-мэйл мэдэгдэл + шаардлагатай бол project-ийг автоматаар зогсоох.
- [ ] **ISR зардал багасгах:** дэлгүүрийн хуудсуудын `export const revalidate = 60`
      → `3600` болгох (`(shop)/page.tsx`, `catalog`, `products/[slug]`, `blog`,
      `blog/[slug]`, `collections`, `collections/[slug]`, `about`, `faq`,
      `contact`). Урсгал сийрэг үед 60 секундын ISR нь **үзэлт тутам** хуудсыг
      дахин бичдэг (~$0.00017/үзэлт ≈ 100k үзэлтэд $17/сар). Өгөгдөл шинэчлэгдэх
      нь алдагдахгүй — `src/lib/cache.ts`-ийн on-demand `revalidatePath`/
      `revalidateTag` админы бичилт бүр дээр аль хэдийн дуудагддаг.
- [ ] **Төлбөрийн polling зөөлрүүлэх:** `payment-panel.tsx` (`POLL_MS = 3_000`,
      timeout 20 мин) нь нэг захиалгад 400 хүртэл хүсэлт үүсгэнэ. Шатласан
      interval (3с → 5с → 10с) + tab нуугдсан үед (`visibilityState`) зогсоох.
      QPay webhook аль хэдийн байгаа тул polling нь зөвхөн UI-н баталгаа.
- [ ] **Vercel Firewall / rate limiting** тавих задгай route-уудад: `/api/search`,
      `/api/products`, `/api/reviews` (bot-ын урсгал Edge Request-ыг тэсрүүлэх
      гол эрсдэл).
- [ ] **Supabase compute:** Micro-оор эхлэх ($10 credit-д багтана), 2 долоо
      хоногийн дараа metric харж Small ($15) шаардлагатай эсэхийг шийдэх.
      Spend cap эхлээд ON (тасрах эрсдэлтэй) — амьд болсны дараа OFF болгоод
      Vercel-ийн threshold-той хослуулж хянана.
- [ ] **Авахгүй байх add-on-ууд:** Supabase PITR ($100/сар), Custom domain
      ($10/сар), Advanced MFA Phone ($75/сар — утасны баталгаажуулалт verify.mn
      дээр байгаа тул хэрэггүй). Supabase Storage image transformation
      ($5/1000 зураг) бүү асаа — next/image Vercel дээр аль хэдийн хийж байна.

### 2.2 Төлбөрийн хоёр нууц (ЗААВАЛ — release-ийн өмнө)

Хоёулаа **зөвхөн Production** scope. Preview-д хэрэггүй: тэнд
`QPAY_MOCK=true` тул бодит QPay callback ирэхгүй, тулгах бодит төлбөр ч
байхгүй.

```bash
openssl rand -hex 32   # → QPAY_CALLBACK_SECRET
openssl rand -hex 32   # → CRON_SECRET   (тус бүрд ӨӨР утга)
```

Vercel → Settings → Environment Variables → scope **Production**.

---

#### `QPAY_CALLBACK_SECRET` — callback-ийн хаалга

**Юу шийддэг вэ.** QPay төлбөр орсны дараа бидэн рүү callback дууддаг ч тэр
дуудлагадаа **гарын үсэг өгдөггүй** (V2 баримтад HMAC ч, IP allowlist ч
байхгүй — QPay өөрөө «хүлээн авсны дараа шалгаж баталгаажуулна уу» гэж
заадаг). Тиймээс дуудагч нь QPay мөн эсэхийг батлах цорын ганц арга бол
хуваалцсан нууц.

**Нууцгүй үед юу болох вэ.** Хаяг нь
`…/api/payments/qpay/webhook?order=VS-1042` бөгөөд `order_no` нь дараалсан
sequence (0006). Хэн ч `VS-1000`-аас `VS-9999` хүртэл гүйлгэж:

- захиалга бүрийн **оршин буй эсэх, төлбөрийн төлвийг** status code-оор
  зураглана (404 / 402 / 200 / 409);
- хариу бүр QPay руу нэг бодит `payment/check` илгээдэг тул **мерчантын
  квотыг шатааж**, бодит баталгаажуулалтыг удаашруулна.

> Хуурамч хүсэлтээр захиалгыг «төлөгдсөн» болгох боломж **хэзээ ч байгаагүй**
> — handler нь ирсэн өгөгдлийг уншдаггүй, QPay-ээс дахин асуудаг. Асуудал нь
> мэдээлэл алдагдах ба квот шатаах хоёр.

**Тавьсны дараа.** Хаяг нь
`…/api/payments/qpay/webhook/<нууц>?order=VS-1042` болно. Нууц нь QPay-д
үүсгэсэн invoice дотор л явна — хэрэглэгчийн browser-т хэзээ ч гарахгүй.
Буруу нууцад **404** (401/403 биш — тэр нь «энд зөв зам байна» гэдгийг
баталчихдаг).

**⚠️ Шилжилтийн цонх.** Тавьсны дараа **шинэ invoice** л нууцтай хаягийг
авна. Тэр агшинд идэвхтэй байсан хуучин invoice-ууд (дээд тал нь 35
минутынх) хуучин зам руу заасаар байх ба тэр зам одоо 404 болно. Тэднийг
төлбөрийн хуудасны poller ба тулгалтын cron хоёулаа барих тул алдагдахгүй —
гэхдээ **ачаалал багатай цагт тавь**.

- [ ] `QPAY_CALLBACK_SECRET` Production env-д тавигдсан
- [ ] Deploy хийсний дараа бодит нэг төлбөр хийж, callback ирснийг
      `order_status_history`-оос батлав
- [ ] Хуучин нууцгүй зам 404 буцааж байгааг шалгав:
      `curl -i "https://vonscent.mn/api/payments/qpay/webhook?order=VS-1042"`

---

#### `CRON_SECRET` — тулгалтын cron-ий хаалга

**Юу шийддэг вэ.** Хэрэглэгч төлбөрөө хийчихээд QPay-ийн callback алдагдвал
(cold start, deploy явж байсан, 502), хэрэглэгч browser-оо хаавал — 35
минутын дараа `release_expired_reserves` захиалгыг **QPay-ээс огт асуулгүй**
цуцална. Мөнгө гарсан, захиалга цуцлагдсан, админд ямар ч дохио очихгүй.
Илрэх цорын ганц зам нь хэрэглэгч гомдоллох.

`/api/cron/reconcile-payments` (Vercel Cron, 5 мин тутам) нь нөөц нь **дуусах
гэж буй** захиалгуудыг QPay-ээс эцсийн удаа шалгаж энэ нүхийг хаана.

**Нууц нь юуг хамгаалдаг вэ.** Энэ route дуудалт бүрд QPay руу гадагш
хүсэлт илгээдэг. Нээлттэй орхивол танихгүй хүн давтан дуудаж квотыг
шатаана. Vercel Cron нь `Authorization: Bearer <CRON_SECRET>` header-ыг
автоматаар илгээдэг; буруу эсвэл байхгүй бол **401**.

**Хоосон орхивол.** Route нь өөрийгөө **503**-аар хаана — аюулгүй, гэхдээ
алдагдсан callback-ийг олох механизм **огт ажиллахгүй**.

⚠️ **Vercel Pro шаардлагатай:** Hobby дээр cron өдөрт нэг л удаа ажилладаг
тул `*/5 * * * *` бүтэхгүй.

- [ ] `CRON_SECRET` Production env-д тавигдсан
- [ ] Vercel → Settings → Cron Jobs дээр `/api/cron/reconcile-payments`
      бүртгэгдсэн
- [ ] Нууцгүй дуудлага 401 буцаана:
      `curl -i https://vonscent.mn/api/cron/reconcile-payments`
- [ ] Нууцтай дуудлага 200 буцаана:
      `curl -i -H "Authorization: Bearer $CRON_SECRET" https://vonscent.mn/api/cron/reconcile-payments`

---

## 3. Төлбөр — QPay ба банк

- [ ] QPay-тэй **гэрээ хийж** бодит credential авах.
- [ ] Vercel env: `QPAY_USERNAME`, `QPAY_PASSWORD`, `QPAY_INVOICE_CODE`
      бөглөж, `QPAY_MOCK`-ыг устгах/`false` болгох.
- [ ] Бодит жижиг дүнгээр туршилтын төлбөр хийж webhook + payment/check
      урсгалыг баталгаажуулах (одоо хүртэл зөвхөн mock-оор туршигдсан).
- [ ] **Банкны данс** — `src/app/(shop)/order/success/page.tsx` доторх `BANK`
      constant одоо placeholder («Хаан банк 5000 1234 5678»). Бодит дансаар
      солих (эсвэл админ Тохиргооноос уншдаг болгох).

## 4. Analytics ба хяналт

- [ ] GA4 property үүсгэж Vercel env-д `NEXT_PUBLIC_GA_ID` (бодит ID).
- [ ] Meta Pixel үүсгэж `NEXT_PUBLIC_META_PIXEL_ID`.
- [ ] Sentry DSN production орчинд орсон эсэх.
- [ ] Telegram мэдэгдэл: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`
      production утгаараа Vercel дээр байгаа эсэх.
- [ ] Утасны баталгаажуулалт: `VERIFY_MN_API_KEY` production key,
      `AUTH_PASSCODE_PEPPER` тогтмол (солибол бүх нууц үг хүчингүй болно!).
- [ ] **Хүсэлтийн хязгаар** (development.md §9.7): `0076_rate_limits.sql`
      production дээр хэрэгжсэн эсэх, `prune-rate-limits` pg_cron ажил
      бүртгэгдсэн эсэх (`select * from cron.job;`). `RATE_LIMIT_SALT` нь
      заавал биш — тавихгүй бол `AUTH_PASSCODE_PEPPER` ашиглагдана.
      Нэвтрүүлсний дараа Sentry дээр 429-ийн тоог ажиглаж, `RATE_LIMITS`-ын
      утга жирийн хэрэглэгчийг хааж эхэлбэл сулруулна.

## 5. Админ контент (Тохиргоо самбараас)

- [ ] Хүргэлтийн бүсийн үнэ, хамрах хороод эцсийн байдлаар хянах
      (X бүсэд Налайх, Шарга морьт, 22 товчоо орсон эсэх).
- [ ] **Бэлгийн үнэрүүд** — 6–8 ус сонгох (Админ → Бэлгийн үнэрүүд). Сан хоосон
      эсвэл унтраалттай бол бэлгийн сонголт бүхэлдээ гарахгүй: багцын хуудсан
      дээрх «Бэлэгтэй» тэмдэг, сагсны сануулга, checkout-ийн сонгох хэсэг
      гурвуулаа алга болно.
- [ ] Автомат урамшууллын купон хэрэгтэй бол асаах
      (Тохиргоо → Купон autoGrant — одоогоор унтраалттай).
- [ ] Popup, hero баннер, нүүрний хэсгүүд, About, FAQ, блогийн эхний
      контентоо оруулах.
- [ ] Custom tag-уудыг бараа бүр дээр оноох (хайлт, quiz, төстэй бараа
      бүгд үүнээс сайжирна).
- [ ] Барааны үнэ, үлдэгдэл, зургууд бүрэн эсэхийг шалгах.

## 6. Мэдэж байх зүйл — бэлгийн хамгаалалт ⚠

- [ ] **`place_order` RPC өөрөө бэлгийн эрхийг шалгадаггүй** 🔴 — ирсэн
      `is_gift=true, unit_price=0` мөрийг шууд бичдэг. Өнөөдөр аюулгүй: RPC-г
      зөвхөн service-role түлхүүртэй `/api/orders` дуудаж чадах бөгөөд тэр
      route нь эрх, сангийн гишүүнчлэл, үлдэгдлийг бүгдийг сервер тал дээр
      дахин боддог (`priceGiftLines`). Эрсдэл нь: ирээдүйд өөр дуудагч (шинэ
      route, скрипт, edge function) нэмэгдвэл DB талд түүнийг барих
      хамгаалалт байхгүй.
- [ ] Хэрэв ийм дуудагч нэмэгдэх бол хамгийн багадаа `place_order` дотор
      бэлгийн мөрийг албадан 0₮ / 1мл болгоно (хоёр pass-д адилхан, эс тэгвэл
      нөөц зөрнө):
      ```sql
      if v_gift then v_unit := 0; v_ml := least(v_ml, 1); end if;
      ```
      Эрхийн бүтэн томьёог (max(багцын баталгаа, ⌊цэвэр дүн ÷ 200,000⌋))
      plpgsql руу хуулахгүй байхаар **зориуд** шийдсэн — нэг дүрэм хоёр хэлээр
      бичигдвэл хожим салах эрсдэлтэй. Эх сурвалж: `src/lib/gift.ts`.

## 7. Prod-ын дата цэвэрлэлт ба passcode pepper

Release-ийн өмнө production дээрх тестийн дата устгагдана. Тэр мөчид
`AUTH_PASSCODE_PEPPER`-ыг мөн **зөвхөн production дээр** солино.

### Яагаад pepper-ыг яг тэр үед солих вэ

4 оронтой passcode нь Supabase-ийн нууц үг **биш** — pepper-тэй HMAC хийсэн
үр дүн нь нууц үг болж DB-д хадгалагддаг
(`derivePassword`, `src/lib/auth/phone.ts:36`):

```ts
createHmac("sha256", pepper()).update(passcode).digest("hex")
```

Тиймээс pepper солих нь **байгаа бүх аккаунтыг нэвтэрч чадахгүй болгоно** —
хадгалагдсан hash нь хуучин pepper-ээр гарсан. Release-ийн өмнө буюу
хэрэглэгчийн дата устгагдах мөчид үүнийг хийвэл **зардалгүй**; release-ийн
дараа хийвэл бодит хэрэглэгчид түгжигдэж, verify.mn-ээр passcode reset
хийхээс өөр зам үлдэхгүй (дуудалт бүр төлбөртэй).

### Dev-ийг ХӨНДӨХГҮЙ

`.env.dev` ба Vercel **Preview** нь одоогийн утгаараа үлдэнэ. Хоёр шалтгаан:

1. Dev сан нь prod-оос хуулагдсан (`db-clone.ts`) тул тэнд байгаа тест
   аккаунтууд **ажилласаар** байна — dev дээр user дахин үүсгэх шаардлагагүй.
2. Prod шинэ утга авмагц хоёр орчны hash орон зай **салж**, dev-ийн
   passcode-оор prod руу нэвтрэх нүх хаагдана. Аюулгүй байдлын шаардлага нь
   «шинэ байх» биш, **«ижил байж болохгүй»** — тэр нь биелнэ.

> Локал `pnpm dev` ба Vercel Preview нь **нэг dev санг** хуваалцдаг тул
> тэдний pepper үргэлж **ижил** байх ёстой. Хэзээ нэгэн цагт dev-ийнхийг
> солих бол хоёуланг нь зэрэг сольно.

### 🔴 Дараалал — мартвал шинэ аккаунт ч эвдэрнэ

Vercel-ийн env өөрчлөлт нь **байгаа deploy-д хэрэгжихгүй**, шинэ deployment
дээр л уншигдана. Redeploy-ээс ӨМНӨ үүсгэсэн аккаунт хуучин pepper-ээр
hash-лагдаж, redeploy болмогц нэвтэрч чадахгүй болно.

- [ ] **1.** Prod-оос release-ийн өмнөх тестийн дата устгав.
      `auth.users` устгахад дараах нь **cascade**-ээр дагаж устана:
      `profiles`, `addresses`, `loyalty_ledger`, `newsletter_subscribers`,
      `collections`, `spin_*`. `orders.user_id` нь **`set null`** болж
      захиалга зочны захиалга шиг үлдэнэ (`0006_orders.sql:8`) — захиалгыг ч
      устгах бол тусад нь устгана.
- [ ] **2.** Үлдэх ёстой аккаунт **БАЙХГҮЙ** гэдгийг батлав (өөрийн
      аккаунтыг ч устгана — эс тэгвээс тэр нэвтэрч чадахгүй болно).
- [ ] **3.** `openssl rand -hex 32` → Vercel **Production** дээрх
      `AUTH_PASSCODE_PEPPER`, мөн локал `.env.prod`-д ижил утга.
      ⚠️ Хувьсагч «All Environments» гэж нэг утгаар тавигдсан бол эхлээд
      **салгана**: байгаа мөрийг Production-only болгоод, Preview-д одоогийн
      утгаар тусад нь нэмнэ.
- [ ] **4.** ⚠️ **Redeploy хийсэн** (Vercel → Deployments → Redeploy).
- [ ] **5.** Redeploy-ийн **ДАРАА** engineer + client аккаунтыг prod дээр
      шинээр үүсгэв.
- [ ] **6.** Dev-ийн passcode-оор prod руу нэвтрэх **БҮТЭХГҮЙ** гэдгийг
      шалгав.
- [ ] **7.** Dev дээрх хуучин тест аккаунт **нэвтэрсээр** байгааг шалгав
      (dev хөндөгдөөгүйг батална).

> `RATE_LIMIT_SALT` нь хоосон үед pepper руу унадаг (`src/lib/env.ts`) тул
> энэ солилтоор тэр ч мөн хоёр орчинд сална — нэмэлт үйлдэл шаардахгүй.

### 7.1 Env-ийн цэвэрлэлт (мөн release-ийн өмнө)

- [ ] **`R2_*` 5 мөрийг устгав** (`.env.dev`, `.env.prod`) — Cloudflare R2
      хэрэглэхээ больсон, кодод хаана ч лавлагаа байхгүй
      (`grep -rn "R2_" src scripts` → хоосон). `.env.example`-д ч байхгүй.
- [ ] **`DATABASE_PASS`** хэрэгтэй эсэхийг шийдэв — кодод хэрэглэгддэггүй,
      нууц үг нь `DATABASE_URL` дотор аль хэдийн байна. Хэрэгтэй бол
      `.env.example`-д тайлбартай нэм, эс бөгөөс устга.
- [ ] **`.env.prod`-ийн `NEXT_PUBLIC_SITE_URL` → `https://vonscent.mn`**
      (одоо `https://dev.vonscent.mn`). Локалд инерт — `.env.prod`-оор
      ажилладаг script (`db:migrate-prod`, `db:backup`, `check:*`) siteUrl
      уншдаггүй — гэхдээ «prod» файлд dev домэйн байх нь дараа нь апп-түвшний
      script ажиллуулахад заль болно.
- [ ] **Vercel Production `NEXT_PUBLIC_SITE_URL = https://vonscent.mn`**
      (домэйн холбогдсоны дараа). Бодитоор нөлөөлдөг цорын ганц газар:
      имэйлийн линк, QPay callback, Telegram-ийн админ линк, sitemap/robots.
- [ ] **`STORE_INBOX_EMAIL`** — хоосон орхих нь **зөв**. Код
      `vonscent.store@gmail.com`-оор өгөгдмөл авдаг
      (`src/lib/email/send.ts:65`), тэр нь PRODUCT.md-ийн хаягтай таарна.
- [ ] **`VERIFY_MN_API_KEY`** — dev/prod ижил байгаа нь release-ийн өмнө
      зөвшөөрөгдсөн (тест хэдхэн user). Release-д тусдаа key авах эсэхийг
      шийднэ — SMS квот, лог хольцолдож байгааг санах.
- [ ] **`TELEGRAM_BOT_TOKEN` + `TELEGRAM_ADMIN_CHAT_ID`** — одоо engineer-ийн
      bot, dev/prod ижил. **Release-д:** клиентийн утсан дээр bot үүсгээд
      зөвхөн **Vercel Production**-д солино. `.env.dev` ба Preview нь
      engineer-ийн bot-д хэвээр үлдэнэ.

## 8. Эцсийн шалгалт

- [ ] `pnpm build` алдаагүй, Vercel production deploy амжилттай.
- [ ] Бодит утсаар: бүртгүүлэх → сагслах → захиалах → төлөх → цуцлах бүтэн
      урсгалыг нэг удаа гараар туршина (development.md §7.7 critical flow).
- [ ] Имэйл бүртгүүлээд захиалга хийж баталгаажуулах имэйл + unsubscribe
      линк ажиллаж буйг шалгах.
- [ ] robots/sitemap production домэйнтэй гарч буйг шалгах
      (`https://vonscent.mn/sitemap.xml`).
