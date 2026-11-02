# Нүүрний hero — Эрт өвөл (2026-11 → 12-14)

> Солих бүрэн дараалал: [hero.md](./hero.md). Хэмжээ, тайралт: [hero-desktop.md](./hero-desktop.md), [hero-mobile.md](./hero-mobile.md).

v4 hero-гийн зохиомж, бараа, аюулгүй бүс **өөрчлөгдөхгүй** — зөвхөн улирлын уур
амьсгал солигдоно: хүйтэн тунгалаг өглөөний гэрэл, анхны хяруу, нимгэн цас.
Зүүн тал **цайвар** хэвээр тул текст бараан өнгөөрөө уншигдана → **код өөрчлөхгүй**
(зөвхөн `HERO_PHOTO`-гийн файлын нэр).

Зул сарын шинж (чимэглэл, улаан тууз, бэлэг) **оруулахгүй** — Шинэ жилийн hero-г
тусад нь хийнэ, энэ зураг түүнээс өмнө ба дараа (2-р сар хүртэл) ашиглагдана.

**Model:** `gpt-image-2` · **edits** endpoint · quality high · `input_fidelity=high`

| | Desktop | Mobile |
|---|---|---|
| Size | **3584×1280** (2.8:1) | **2048×1536** (4:3) |
| Image 1 (reference) | `public/desktop.webp` | `public/mobile.png` |
| Output | `public/hero-desktop-winter-{1600,2400,3200}.webp` | `public/hero-mobile-winter.webp` |

Шошго бүдгэрвэл барааны цэвэр зургуудыг (Armani, PdM Layton, Azzaro) image 2–4 болгон нэм.

---

## Desktop prompt

```text
Image 1 is the exact scene reference: keep the same three perfume bottles (Emporio Armani "Stronger With You Intensely", Parfums de Marly "Layton", Azzaro "The Most Wanted Parfum"), the two glass decant vials, the travertine stone blocks, the camera angle, the composition and the 2.8:1 ultra-wide framing exactly as they are. Reproduce every bottle's shape, cap, glass color and printed text faithfully, sharp and legible.

Restyle the scene for the very first days of winter in a cold northern steppe city — the morning after the first light snowfall, quiet, crisp and elegant, not festive and not Christmas. Shift the lighting to clear, low winter morning sun: cool, bright, slightly bluish daylight from the left with long soft shadows, while the amber liquid in the bottles still glows warmly as the only warm accent. Keep the diagonal window-light shadows on the wall, but the window-frame shadow now has soft, feathery frost-crystal patterns along its edges. The palette becomes pale ivory, soft stone grey, silver and icy blue, with the warm amber of the perfumes.

Add winter details only between 55% and 95% of the frame width, around and behind the bottles, never covering any bottle or label: a fine, delicate dusting of fresh powdery snow and tiny frost crystals on the top surfaces and edges of the travertine blocks, a few thin bare birch or larch twigs coated with white hoarfrost lying behind the bottles, one small sprig of frosted pine, and a softly folded corner of a cream-colored cashmere scarf on the stone at the far right. A few small cold condensation droplets on the decant vials only. Everything stays minimal and luxurious.

The left 55% of the frame must stay completely empty and light: only the smooth plaster wall, now in a pale cool ivory tone with the soft window-light and frost shadows, above the polished stone surface — light enough for dark text to be read on it, no objects, no props, no snow piles, no twigs, no text in that area. The tallest bottle top stays at about 14% from the top edge and the lowest point of any object at about 86%. Camera at product level, 50mm lens look, tack-sharp focus on the products, crisp legible bottle labels, realistic reflections in the polished stone, unretouched luxury commercial product photograph. No snowflakes falling in the air, no Christmas ornaments, no red, no gift boxes, no added text, no logos other than what is printed on the original bottles, no watermark.
```

## Mobile prompt

```text
Image 1 is the exact composition reference: keep its framing, camera angle, the size and the exact position of every object — the three perfume bottles (Emporio Armani "Stronger With You Intensely", Parfums de Marly "Layton", Azzaro "The Most Wanted Parfum"), the two glass decant vials and the travertine stone blocks — exactly where they are in image 1, in the 4:3 framing. Do not move, enlarge or shift anything to the left. Reproduce every bottle's shape, cap, glass color and printed text faithfully, sharp and legible.

Restyle the scene for the very first days of winter in a cold northern steppe city — the morning after the first light snowfall, quiet, crisp and elegant, not festive and not Christmas. Shift the lighting to clear, low winter morning sun: cool, bright, slightly bluish daylight from the left with long soft shadows, while the amber liquid in the bottles still glows warmly as the only warm accent. Keep the window-light shadows on the wall, with soft feathery frost-crystal patterns along the edges of the window-frame shadow. The palette becomes pale ivory, soft stone grey, silver and icy blue, with the warm amber of the perfumes.

Add small winter details only between 58% and 97% of the frame width, never covering any bottle or label: a fine dusting of fresh powdery snow and tiny frost crystals on the top surfaces and edges of the travertine blocks, two or three thin bare twigs coated with white hoarfrost behind the bottles, and a small folded corner of a cream cashmere scarf at the far right. A few small condensation droplets on the decant vials only. Keep the details small so everything fits inside this narrow area.

The left 58% of the frame, including the bottom-left corner, must stay completely empty and light: only the smooth plaster wall in a pale cool ivory tone with soft window-light shadows, above the polished stone surface — light enough for dark text to be read on it, no objects, no props, no snow, no twigs, no text in that area. Camera at product level, 50mm lens look, tack-sharp focus on the products, crisp legible bottle labels, realistic reflections, unretouched luxury commercial product photograph. No snowflakes falling in the air, no Christmas ornaments, no red, no gift boxes, no added text, no logos other than what is printed on the original bottles, no watermark.
```

---

## Шалгах

- Шошго (YOU INTENSELY, PARFUMS de MARLY, AZZARO) тод, үсэг зөв эсэх.
- Харангуут «анхны цас, хүйтэн өглөө» гэж мэдрэгдэх эсэх — хяруу, нимгэн цас тод, гэхдээ Зул сарын шинж байхгүй.
- Зүүн 55% (desktop) / 58% (mobile, доод булан оролцуулан) хоосон, цайвар — бараан текст уншигдах эсэх.
- Mobile: Armani-гийн зүүн ирмэг ≥54%; 390px ба 320px дээр тайлбар савтай давхцахгүй.
- Хэмжээ яг 2.8:1 / 4:3. Тайралт, screenshot шалгалт: [hero.md](./hero.md) §6.
