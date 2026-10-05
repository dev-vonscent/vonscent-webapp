# Release-ийн үлдсэн зүйлс — vonscent.mn

Release хийгдсэн (2026-10-05). Энд зөвхөн **хийгдээгүй** зүйлс үлдсэн; хийгдсэн
алхмууд, тохиргооны заавар (Resend, Firewall, Spend Management, QPay/cron нууц,
pepper солилт) git түүхэд (`git log -- docs/RELEASE_CHECKLIST.md`).

---

## 1. Зардлын хяналт — release-ээс 2 долоо хоногийн дараа

- [ ] **ISR — өгөгдлөөр шийдэх (заавал биш).** Vercel → Usage → ISR Writes-ийг
      харж, Pro-гийн багтсан хэмжээнээс хэтэрвэл л өөрчилнө. ISR нь хуудас
      тутамд минутад дээд тал нь 1 дахин үүсгэдэг тул жижиг урсгалд зардал бага.
      ⚠ Home / catalog / products / collections-ыг **3600 болгохгүй**: админ,
      захиалга, цуцлалт `revalidatePublic()` дууддаг ч pg_cron-ийн
      `release-expired-reserves` (5 мин) ба `refresh-sold-out` (15 мин) кэш
      цэвэрлэдэггүй — 3600 үед буцаж ирсэн бараа 1 цаг «Дууссан», дууссан бараа
      1 цаг «Байгаа» харагдана. Үлдэгдэлгүй хуудсууд (faq, contact, about, blog)
      л 3600 болгож болно.
- [ ] **Supabase compute:** Micro-оор эхэлсэн ($10 credit-д багтана) — metric
      харж Small ($15) шаардлагатай эсэхийг шийдэх. Spend cap эхлээд ON
      (тасрах эрсдэлтэй) — амьд болсны дараа OFF болгоод Vercel-ийн
      threshold-той хослуулж хянана.
- [ ] **Авахгүй байх add-on-ууд:** Supabase PITR ($100/сар), Custom domain
      ($10/сар), Advanced MFA Phone ($75/сар — утасны баталгаажуулалт verify.mn
      дээр байгаа тул хэрэггүй). Supabase Storage image transformation
      ($5/1000 зураг) бүү асаа — next/image Vercel дээр аль хэдийн хийж байна.

## 2. Analytics

- [ ] Meta Pixel үүсгэж `NEXT_PUBLIC_META_PIXEL_ID`. Код бэлэн
      (`src/components/shared/analytics.tsx`) — ID хоосон бол pixel ачаалагдахгүй.

## 3. Env

- [ ] Локал `.env.prod`-ийн `AUTH_PASSCODE_PEPPER` хуучин (dev-тэй ижил) —
      ямар ч script уншдаггүй тул хоргүй, гэхдээ Vercel Production-ийн утгаар
      шинэчлэх эсвэл мөрийг устга. ⚠ Vercel Production-ийн pepper-ийг **бүү
      соль** — бүх аккаунт нэвтэрч чадахгүй болно (`src/lib/auth/phone.ts`).

## 4. Мэдэж байх зүйл — бэлгийн хамгаалалт ⚠

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
