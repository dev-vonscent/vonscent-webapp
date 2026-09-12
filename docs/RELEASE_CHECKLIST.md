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
- [ ] **Vercel Pro** багц авах — $20/сар (1 deploy seat) + $20 credit, дотор нь
      1 TB Fast Data Transfer, 10 сая Edge Request. Hobby нь **арилжааны
      хэрэглээ хориотой**, Spend Management байхгүй, image квот давбал зураг
      402 алдаа буцаана. Fluid compute дээр функцийн хугацаа 300s (Pro 800s) —
      `after()` доторх OpenAI зураг үүсгэлтэд хүрэлцэнэ.
- [ ] **Supabase Pro** багц авах — $25/сар + $10 compute credit (Micro).
      Free project 1 долоо хоног идэвхгүй бол унтардаг; Pro-д өдрийн backup
      (7 хоног), лог 7 хоног, pg_cron найдвартай. Багтсан: 8 GB DB, 250 GB
      egress, 100 GB storage, 100k MAU.
- [ ] Pro орчинд **pg_cron ажиллаж буйг шалгах**: 11:00-д «хүргэгдэж буй»,
      23:00-д «хүргэгдсэн» авто шилжилт, reserve timeout, оноoны түгжээ
      (`select * from cron.job;` — 6 job идэвхтэй байх ёстой).

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

## 7. Эцсийн шалгалт

- [ ] `pnpm build` алдаагүй, Vercel production deploy амжилттай.
- [ ] Бодит утсаар: бүртгүүлэх → сагслах → захиалах → төлөх → цуцлах бүтэн
      урсгалыг нэг удаа гараар туршина (development.md §7.7 critical flow).
- [ ] Имэйл бүртгүүлээд захиалга хийж баталгаажуулах имэйл + unsubscribe
      линк ажиллаж буйг шалгах.
- [ ] robots/sitemap production домэйнтэй гарч буйг шалгах
      (`https://vonscent.mn/sitemap.xml`).
