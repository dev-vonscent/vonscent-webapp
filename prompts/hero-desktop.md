# Нүүрний hero — desktop зураг

> Солих бүрэн дараалал: [hero.md](./hero.md).

**Model:** `gpt-image-2` · **edits** endpoint · size **3584×1280** (2.8:1 шууд) · quality high · `input_fidelity=high`
(хэмжээ 16-ын үржвэр, харьцаа ≤3:1, урт тал <3840. Артефакт гарвал **2688×960**.)
**Reference (input) images:** 1) Armani Stronger With You Intensely, 2) Parfums de Marly Layton, 3) Azzaro The Most Wanted Parfum — цэвэр бүтээгдэхүүний зураг (шошго тод), 4) өмнөх hero (`public/desktop.webp`).
**Output:** `public/desktop.webp` (3584×1280, тайраагүй) → sharp-аар 1600/2400/3200 өргөн, q80
→ `public/hero-desktop-v3-{w}.webp`; `HERO_PHOTO.srcSet`-ээр шууд өгнө (Next optimizer 1600-аар
хязгаарлагдсан тул ашиглахгүй).

v1-ийн сургамж: 3:2 (1536×1024) дээр барааг жижиг (босоо 30–70%) generate хийж
тайрсан тул бараа ~385px өндөртэй болж, 1616px карт (retina-д ~3200px) дээр
сунаж бүдгэрсэн. Шууд 2.8:1 + 3584px өргөнтэй бол бараа ~900px — ~2.4× тод.
Шошгоны жижиг бичиг AI зурагт ихэвчлэн утгагүй үсэг болдог — томсгох нь л тусална.
Дахин солихдоо **шинэ файлын нэр** өг (кэш ижил URL-д хуучин зургийг өгдөг).

## Яагаад 2.8:1 вэ (кодтой тохирох ёстой — `campaign-hero.tsx` PhotoHero)

Desktop карт нь `sm:aspect-*` боловч `sm:max-h-[58svh]` ба `min-h-64/80/88`-аар
хязгаарлагддаг тул бодит харьцаа нь дэлгэцээс хамаарч **≈2.2:1 (640–1024px) …
≈3.45:1 (1366×768, 1536×864 laptop)** хооронд хэлбэлздэг. `object-cover` тул:

- Карт зурагнаас өргөн бол → дээр/доороос тайрна (3.45 үед ~9.4% тус бүр).
- Карт зурагнаас өндөр бол → хоёр хажуугаас тайрна (2.2 үед ~10.7% тус бүр).

2.8:1 нь хоёр захын голд байх тул аль ч чиглэлд тайралт ~10%-иас хэтрэхгүй.
Хуучин `desktop.png` (2.5:1) дээр Replica-гийн таг дээд ирмэгээс ~6%-д байсан тул
Mac (≈2.96:1) дээр тасарч байсан.

## Аюулгүй бүс (2.8:1 тайрсны дараах хүрээний хувиар)

| Бүс | Агуулга |
|---|---|
| Зүүн 0–55% | **Хоосон** хана + тавцан — текст (`sm:w-[52%]`) сууна |
| Баруун 55–88% | Бүх бараа; баруун захаас **≥12%** зай |
| Босоо 12–88% | Барааны бүх хэсэг (хамгийн өндөр таг ≥12%, хамгийн доод цэг ≤88%) |
| Ирмэгүүд | Зөвхөн хана, тавцан, сүүдэр — тайрагдаж болно |

Шууд 2.8:1 generate хийх тул prompt дахь хувь = эцсийн хүрээний хувь.

## Prompt (2026-10-24, v4 — 3 бүтэн сав, шууд 2.8:1)

Images 1, 2 and 3 are the exact product references — reproduce each bottle's shape, cap, glass color and printed text faithfully, sharp and legible: image 1 is Emporio Armani "Stronger With You Intensely" (amber square glass bottle, dark gunmetal round cap), image 2 is Parfums de Marly "Layton" (deep navy blue rectangular bottle with embossed rearing horses and "1743" crest, silver cap) — show it standing upright and photographed straight from the front, ignore the angle and background of its reference photo, image 3 is Azzaro "The Most Wanted Parfum" (black ribbed metal top with revolver-cylinder cap, amber liquid, "AZZARO" lettering at the base). Image 4 is the scene reference for lighting, color and composition.

Recompose the scene from image 4 as an ultra-wide horizontal photograph with a 2.8:1 aspect ratio. Replace the bottles in image 4 with these three products; keep the same travertine stone blocks, materials, lighting, warm beige color palette and photographic style. The left 55% of the frame must be completely empty: only a smooth warm beige plaster wall with soft diagonal window-light shadows above a polished beige stone surface — no objects, no bottles, no props, no text in that area. Place all the products tightly grouped between 55% and 88% of the frame width, leaving a clear margin of empty wall on the right: on top of the travertine stone blocks stand three full-size bottles side by side, all upright and facing the camera — the Armani bottle on the left, the Parfums de Marly Layton bottle in the center and slightly taller, the Azzaro bottle on the right. One small glass decant spray vial stands on the surface in front, and one decant vial lies on the surface in front. Each full bottle is clearly visible, not hidden behind another. The tallest bottle top at about 14% from the top edge and the lowest point of any product at about 86% from the top edge. The wall and the stone surface continue to every edge of the frame. A faint leaf shadow in the upper right. Camera at product level, 50mm lens look, tack-sharp focus on the products, crisp legible bottle labels, natural soft shadows, realistic reflections, unretouched commercial product photograph. No added text, no logos other than what is printed on the original bottles, no watermark.

## Зураг солиход кодод

- `home-content.ts` → `HERO_PHOTO`: `src` = шинэ файл (одоо `hero-desktop-v4-{1600,2400,3200}.webp`), `width`/`height` = webp-ийн бодит хэмжээ.
- `campaign-hero.tsx` → `sm:aspect-1983/793`-ийг шинэ харьцаагаар; `getImageProps`-ийн
  fallback `1983`/`793`-ийг мөн.
- `sm:object-[65%_50%]`: v1 зурагт бараа баруун захаас ~8% (12% биш) тул 2.2:1 үед
  баруун талыг бага, зүүн хоосон ханыг илүү тайрна.
- `max-h-[58svh]`-ыг **хэвээр** үлдээнэ (fold дээр «Эрэлттэй» харагдана) — тайралтыг зураг даана.

## Шалгах

- Зургийн хэмжээ яг 2.8:1 эсэх (өөр бол тайр); таг дээд ирмэгээс ≥12%, хэвтээ флакон доод ирмэгээс ≥12%.
- Бараа баруун захаас ≥12% — 2.2:1 (640–1024px) дээр хажуугаасаа тайрагдахгүй.
- Зүүн 55%-д юу ч байхгүй (текст, товч тэнд).
- 1366×768, 1440×900, 1920×1080, 768px өргөн дээр нүүрийг screenshot-оор харах.
