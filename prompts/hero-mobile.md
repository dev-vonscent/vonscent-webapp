# Нүүрний hero — утасны (mobile) зураг

> Солих бүрэн дараалал: [hero.md](./hero.md).

**Model:** `gpt-image-2` · **edits** endpoint · size **2048×1536** (4:3 шууд; артефакт гарвал 1536×1152) · quality high · `input_fidelity=high`
**Reference (input) images:** 1) барааны цэвэр бүтээгдэхүүний зураг (шошго тод), 2) `public/desktop.webp` — бараа, гэрэл, өнгө.
**Output:** `public/mobile.png` (эх, тайрахгүй) → `resize(1600)` webp q85 →
`public/hero-mobile-v<N>.webp`; `home-content.ts`-ийн `HERO_PHOTO.mobile` = бодит өргөн/өндөр (1600 / 1200).
Дахин солихдоо **шинэ файлын нэр** өг (кэш ижил URL-д хуучин зургийг өгдөг). Дэлгэрэнгүй: [hero.md](./hero.md) §4–5.

## Зохиомж (кодтой тохирох ёстой — `campaign-hero.tsx` PhotoHero)

Утсан дээр карт 4:3 (дэлгэцийн ~⅓), зураг `object-right`. Desktop-той ижил
«зүүн талд хоосон хана» зохиомж. Текст `w-[62%]`: eyebrow + гарчиг + тайлбар
дээд хэсэгт, товч **зүүн доод буланд**.

| Бүс (эцсийн 4:3 хүрээний хувиар) | Агуулга |
|---|---|
| Зүүн 0–58% (доод булан оролцуулан) | **Хоосон** хана + тавцан |
| Хэвтээ 58–95% | Бүх бараа; баруун захаас ≥5% |
| Босоо 15–85% | Барааны бүх хэсэг |

Шууд 4:3 generate хийх тул prompt дахь хувь = эцсийн хүрээний хувь.
360px-ээс нарийн утсанд `min-h-64` картыг 4:3-аас өндөр болгож зүүн талаас
тайрна (320px дээр ~16%) — бараа текст рүү ойртоно, гэхдээ товч, гарчиг давхцахгүй.

## Prompt (2026-10-24, v3 — шууд 4:3)

Image 1 is the exact product reference — reproduce the bottle labels faithfully, sharp and legible. Image 2 is the scene reference for lighting and color.

Recompose the scene from image 2 as a horizontal photograph with a 4:3 aspect ratio. Keep the same products, materials, lighting, warm beige color palette and photographic style. The left 58% of the frame must be completely empty: only a smooth warm beige plaster wall with soft diagonal window-light shadows above a polished beige stone surface — no objects, no bottles, no props, no text in that area, including the bottom-left corner. Place all the products tightly grouped between 58% and 95% of the frame width, leaving a small margin from the right edge: the travertine stone blocks with the large amber Maison Margiela Replica bottle and the dark brown rectangular Burberry Hero bottle side by side on top, two small glass decant spray vials standing in front, one decant vial lying on the surface in front. The tallest bottle top at about 15% from the top edge and the lowest point of any product at about 85% from the top edge. The wall and the stone surface continue to every edge of the frame. A faint leaf shadow in the top right corner. Camera at product level, 50mm lens look, tack-sharp focus on the products, crisp legible bottle labels, natural soft shadows, realistic reflections, unretouched commercial product photograph. No added text, no logos other than what is printed on the original bottles, no watermark.

## Шалгах

- Зүүн доод буланд (товч сууна) юу ч байхгүй эсэх.
- Бараа баруун захад наалдаагүй эсэх (≥5%).
- Хэмжээ яг 4:3 эсэх; 390px ба 320px өргөн дээр screenshot-оор харах.
