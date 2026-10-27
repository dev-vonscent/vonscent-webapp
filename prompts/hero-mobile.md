# Нүүрний hero — утасны (mobile) зураг

> Солих бүрэн дараалал: [hero.md](./hero.md).

**Model:** `gpt-image-2` · **edits** endpoint · size **2048×1536** (4:3 шууд; артефакт гарвал 1536×1152) · quality high · `input_fidelity=high`
**Reference (input) images:** 1) Armani Stronger With You Intensely, 2) Parfums de Marly Layton, 3) Azzaro The Most Wanted Parfum — цэвэр бүтээгдэхүүний зураг (шошго тод), 4) `public/desktop.webp` — бараа, гэрэл, өнгө.
**Output:** `public/mobile.png` (эх, тайрахгүй) → `resize(1600)` webp q85 →
`public/hero-mobile-v<N>.webp`; `home-content.ts`-ийн `HERO_PHOTO.mobile` = бодит өргөн/өндөр (1600 / 1200).
Дахин солихдоо **шинэ файлын нэр** өг (кэш ижил URL-д хуучин зургийг өгдөг). Дэлгэрэнгүй: [hero.md](./hero.md) §4–5.

## Зохиомж (кодтой тохирох ёстой — `campaign-hero.tsx` PhotoHero)

Утсан дээр карт 4:3 (дэлгэцийн ~⅓), зураг `object-right`. Desktop-той ижил
«зүүн талд хоосон хана» зохиомж. Текст `w-[56%]` (Armani-гийн таг ~59%-аас эхэлдэг тул тайлбар түүнтэй наалдахгүй): eyebrow + гарчиг + тайлбар
дээд хэсэгт, товч **зүүн доод буланд**.

| Бүс (эцсийн 4:3 хүрээний хувиар) | Агуулга |
|---|---|
| Зүүн 0–58% (доод булан оролцуулан) | **Хоосон** хана + тавцан |
| Хэвтээ 58–95% | Бүх бараа; баруун захаас ≥5% |
| Босоо 15–85% | Барааны бүх хэсэг |

Шууд 4:3 generate хийх тул prompt дахь хувь = эцсийн хүрээний хувь.
360px-ээс нарийн утсанд `min-h-64` картыг 4:3-аас өндөр болгож зүүн талаас
тайрна (320px дээр ~16%) — бараа текст рүү ойртоно, гэхдээ товч, гарчиг давхцахгүй.

## Prompt (2026-10-24, v4 — 3 бүтэн сав, шууд 4:3)

Image 4 = шинэ desktop зураг (`public/desktop.webp`) — хоёр хувилбар ижил харагдана.
v4-ийн эхний оролдлогод бараа 47%-иас эхэлж 390px дээр тайлбарын текст Armani-тай
давхацсан тул бүсийг 62% болгож, савыг жижигрүүлэхийг тодорхой бичсэн.

Images 1, 2 and 3 are the exact product references — reproduce each bottle's shape, cap, glass color and printed text faithfully, sharp and legible: image 1 is Emporio Armani "Stronger With You Intensely" (amber square glass bottle, dark gunmetal round cap), image 2 is Parfums de Marly "Layton" (deep navy blue rectangular bottle with embossed rearing horses and "1743" crest, silver cap) — show it standing upright and photographed straight from the front, ignore the angle and background of its reference photo, image 3 is Azzaro "The Most Wanted Parfum" (black ribbed metal top with revolver-cylinder cap, amber liquid, "AZZARO" lettering at the base). Image 4 is the scene reference for lighting, color and product arrangement.

Recompose the scene from image 4 as a horizontal photograph with a 4:3 aspect ratio. Keep the same three bottles, decant vials, travertine stone blocks, materials, lighting, warm beige color palette and photographic style as image 4. The left 62% of the frame must be completely empty: only a smooth warm beige plaster wall with soft diagonal window-light shadows above a polished beige stone surface — no objects, no bottles, no props, no text in that area, including the bottom-left corner. Place all the products tightly grouped between 62% and 93% of the frame width — keep the bottles noticeably smaller than in the reference so they fit inside this narrow area; nothing may extend left of 62% or right of 93%. On top of the travertine stone blocks stand three full-size bottles side by side, all upright and facing the camera — the Armani bottle on the left, the Parfums de Marly Layton bottle in the center and slightly taller, the Azzaro bottle on the right. One small glass decant spray vial stands on the surface in front, and one decant vial lies on the surface in front. Each full bottle is clearly visible, not hidden behind another. The tallest bottle top at about 30% from the top edge and the lowest point of any product at about 85% from the top edge. The wall and the stone surface continue to every edge of the frame. A faint leaf shadow in the top right corner. Camera at product level, 50mm lens look, tack-sharp focus on the products, crisp legible bottle labels, natural soft shadows, realistic reflections, unretouched commercial product photograph. No added text, no logos other than what is printed on the original bottles, no watermark.

## Шалгах

- Зүүн доод буланд (товч сууна) юу ч байхгүй эсэх.
- Бараа баруун захад наалдаагүй эсэх (≥5%).
- Хэмжээ яг 4:3 эсэх; 390px ба 320px өргөн дээр screenshot-оор харах.
