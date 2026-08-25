# Release-ээс өмнө хийх зүйлс — vonscent.mn

Сүүлд шинэчилсэн: 2026-08-24. Хийсэн зүйл бүрийг `[x]` болгож тэмдэглэ.

---

## 1. Имэйл — Resend (бүх тохиргоо release-ийн өмнө)

Захиалга баталгаажих/цуцлагдах имэйл, contact формын дамжуулалт бүгд
Resend-ээр явна. `RESEND_API_KEY` байхгүй бол код чимээгүй алгасдаг тул
release хүртэл юу ч эвдрэхгүй — гэхдээ release дээр заавал асаана.

- [ ] **Бүртгүүлэх:** [resend.com](https://resend.com) → Sign up (GitHub эсвэл
      имэйл). Free багц: өдөрт 100, сард 3,000 имэйл — эхлэхэд хангалттай.
      Сарын 3,000-д ойртвол paid руу шилжинэ (development.md §9.5).
- [ ] **Домэйн баталгаажуулах:** Dashboard → Domains → Add Domain →
      `vonscent.mn` (Region: Tokyo ойр). Resend-ийн өгсөн DNS бичлэгүүдийг
      домэйны DNS самбарт нэмнэ:
      - MX + TXT (SPF) — `send.vonscent.mn` дээр
      - TXT (DKIM) — `resend._domainkey.vonscent.mn` дээр
      - DMARC санал болговол мөн нэмнэ
      Дараа нь Resend дээр **Verify** — минутаас хэдэн цаг хүлээнэ.
      ⚠ Домэйн баталгаажаагүй бол default `onboarding@resend.dev` илгээгч нь
      зөвхөн өөрийн бүртгэлтэй имэйл рүү явдаг — бодит хэрэглэгчид очихгүй.
- [ ] **API key:** Dashboard → API Keys → Create:
      Name `vonscent-production`, Permission **Sending access**, Domain
      `vonscent.mn`. `re_...` key-г нэг л удаа харуулна — шууд хуул.
- [ ] **Env:** `.env.local` + Vercel (Settings → Environment Variables,
      Production):
      ```
      RESEND_API_KEY=re_xxxxxxxxxx
      EMAIL_FROM=Vonscent <no-reply@vonscent.mn>
      ```
      `STORE_INBOX_EMAIL` default нь vonscent.store@gmail.com — өөрчлөх бол л нэмнэ.
- [ ] **Шалгах:** contact формоос мессеж илгээх + mock төлбөр баталгаажуулах →
      Resend Dashboard → Logs дээр илгээлтүүд харагдана. Хэрэглэгчийн имэйл
      очихын тулд тухайн данс footer-ийн формоор имэйлээ бүртгүүлсэн байх
      ёстойг санаарай.

## 2. Домэйн ба hosting

- [ ] **vonscent.mn** домэйныг Vercel project-д холбох (Vercel → Domains).
- [ ] Vercel env: `NEXT_PUBLIC_SITE_URL=https://vonscent.mn` (имэйл доторх
      линк, sitemap, OG бүгд үүнээс уншина).
- [ ] **Vercel Pro** багц авах (requirement_final.md: урт serverless, image
      optimization квот, аналитик).
- [ ] **Supabase Pro** багц авах (унтардаггүй — pg_cron найдвартай болно,
      өдрийн backup, storage/bandwidth).
- [ ] Pro орчинд **pg_cron ажиллаж буйг шалгах**: 11:00-д «хүргэгдэж буй»,
      23:00-д «хүргэгдсэн» авто шилжилт, reserve timeout, оноoны түгжээ
      (`select * from cron.job;` — 6 job идэвхтэй байх ёстой).

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
- [ ] Сарын бэлгийн 4–8 усаа сонгох (Админ → Бэлэг).
- [ ] Автомат урамшууллын купон хэрэгтэй бол асаах
      (Тохиргоо → Купон autoGrant — одоогоор унтраалттай).
- [ ] Popup, hero баннер, нүүрний хэсгүүд, About, FAQ, блогийн эхний
      контентоо оруулах.
- [ ] Custom tag-уудыг бараа бүр дээр оноох (хайлт, quiz, төстэй бараа
      бүгд үүнээс сайжирна).
- [ ] Барааны үнэ, үлдэгдэл, зургууд бүрэн эсэхийг шалгах.

## 6. Эцсийн шалгалт

- [ ] `pnpm build` алдаагүй, Vercel production deploy амжилттай.
- [ ] Бодит утсаар: бүртгүүлэх → сагслах → захиалах → төлөх → цуцлах бүтэн
      урсгалыг нэг удаа гараар туршина (development.md §7.7 critical flow).
- [ ] Имэйл бүртгүүлээд захиалга хийж баталгаажуулах имэйл + unsubscribe
      линк ажиллаж буйг шалгах.
- [ ] robots/sitemap production домэйнтэй гарч буйг шалгах
      (`https://vonscent.mn/sitemap.xml`).
