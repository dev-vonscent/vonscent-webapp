# Нүүрний hero — Halloween (2026-10-26 → 10-31)

> ClickUp: https://app.clickup.com/t/z8wf5rj6xk · Солих бүрэн дараалал: [hero.md](./hero.md).

Одоогийн v4 hero дээр Halloween-ий уур амьсгал нэмнэ. Бараа, зохиомж, аюулгүй бүс
**өөрчлөгдөхгүй**: зүүн талд хоосон хана (текст тэнд сууна), бараа баруун талд.
Хэмжээ, тайралт, кодын дүрэм: [hero-desktop.md](./hero-desktop.md), [hero-mobile.md](./hero-mobile.md).

**Model:** `gpt-image-2` · **edits** endpoint · quality high · `input_fidelity=high`

| | Desktop | Mobile |
|---|---|---|
| Size | **3584×1280** (2.8:1) | **2048×1536** (4:3) |
| Image 1 (reference) | `public/desktop.webp` | `public/mobile.png` |
| Output | `public/hero-desktop-halloween-{1600,2400,3200}.webp` | `public/hero-mobile-halloween.webp` |

Шошго бүдгэрвэл барааны цэвэр зургуудыг (Armani, PdM Layton, Azzaro) image 2–4 болгон нэм.

## Аль хувилбар вэ?

- **A — Лааны гэрэл (санал болгож буй):** зүүн тал нь цайвар хэвээр тул текст одоогийнх шиг бараан өнгөөр уншигдана. **Код өөрчлөхгүй**, зөвхөн зураг солино. 10/31-нд амжина.
- **B — Шөнийн бараан:** илүү тод Halloween мэдрэмжтэй. Гэхдээ бараан хана дээр бараан текст харагдахгүй тул `campaign-hero.tsx`-д цайвар текстийн сонголт болон дэвсгэрийн өнгө нэмэх шаардлагатай.

---

## A — Desktop prompt

```text
Image 1 is the exact scene reference: keep the same three perfume bottles (Emporio Armani "Stronger With You Intensely", Parfums de Marly "Layton", Azzaro "The Most Wanted Parfum"), the two glass decant vials, the travertine stone blocks, the camera angle, the composition and the 2.8:1 ultra-wide framing exactly as they are. Reproduce every bottle's shape, cap, glass color and printed text faithfully, sharp and legible.

Restyle the scene for Halloween with an elegant, premium, adult mood — not cartoonish, not kitsch. Shift the lighting from daylight to warm late-evening candlelight: a deep amber-orange glow with richer, softer shadows. Replace the diagonal window-light shadows on the wall with soft flickering candle glow, the shadow of bare, twisted branches and the clear silhouettes of four or five bats in flight cast as shadows on the wall in the upper right. Add Halloween props only between 55% and 95% of the frame width, around and behind the bottles, never covering any bottle or label: one carved jack-o'-lantern pumpkin with a classic grinning face glowing warmly from a candle inside — it must be instantly recognizable as Halloween — plus one small matte black pumpkin, a couple of lit black pillar candles with gentle dripping wax, a few dried dark autumn leaves scattered on the stone surface, and a clearly visible delicate spider web stretched across the right corner of the top travertine block. The palette reads as orange and black.

The left 55% of the frame must stay completely empty and light: only the smooth warm plaster wall, now in a soft candlelit amber-beige tone that stays light enough for dark text to be read on it, above the polished stone surface — no objects, no props, no pumpkins, no bats, no leaves, no text in that area. The tallest bottle top stays at about 14% from the top edge and the lowest point of any object at about 86%. Camera at product level, 50mm lens look, tack-sharp focus on the products, crisp legible bottle labels, realistic reflections in the polished stone, unretouched luxury commercial product photograph. No added text, no logos other than what is printed on the original bottles, no watermark.
```

## A — Mobile prompt

```text
Image 1 is the exact scene reference: keep the same three perfume bottles (Emporio Armani "Stronger With You Intensely", Parfums de Marly "Layton", Azzaro "The Most Wanted Parfum"), the two glass decant vials, the travertine stone blocks, the camera angle, the composition and the 4:3 framing exactly as they are. Reproduce every bottle's shape, cap, glass color and printed text faithfully, sharp and legible.

Restyle the scene for Halloween with an elegant, premium, adult mood — not cartoonish, not kitsch. Shift the lighting from daylight to warm late-evening candlelight: a deep amber-orange glow with richer, softer shadows. Replace the diagonal window-light shadows on the wall with soft flickering candle glow, the shadow of bare, twisted branches and the clear silhouettes of three or four bats in flight cast as shadows on the wall in the top right corner. Add small Halloween props only between 62% and 95% of the frame width, around and behind the bottles, never covering any bottle or label: one carved jack-o'-lantern pumpkin with a classic grinning face glowing warmly from a candle inside — it must be instantly recognizable as Halloween — plus one small matte black pumpkin, one lit black pillar candle with gentle dripping wax, a few dried dark autumn leaves on the stone surface, and a clearly visible delicate spider web on the right corner of the top travertine block. The palette reads as orange and black. Keep the props small so everything fits inside this narrow area.

The left 62% of the frame, including the bottom-left corner, must stay completely empty and light: only the smooth warm plaster wall, now in a soft candlelit amber-beige tone that stays light enough for dark text to be read on it, above the polished stone surface — no objects, no props, no pumpkins, no bats, no leaves, no text in that area. The tallest bottle top stays at about 30% from the top edge and the lowest point of any object at about 85%. Camera at product level, 50mm lens look, tack-sharp focus on the products, crisp legible bottle labels, realistic reflections in the polished stone, unretouched luxury commercial product photograph. No added text, no logos other than what is printed on the original bottles, no watermark.
```

---

## B — Desktop prompt (бараан, код өөрчлөлттэй)

```text
Image 1 is the exact scene reference: keep the same three perfume bottles (Emporio Armani "Stronger With You Intensely", Parfums de Marly "Layton", Azzaro "The Most Wanted Parfum"), the two glass decant vials, the travertine stone blocks, the camera angle, the composition and the 2.8:1 ultra-wide framing exactly as they are. Reproduce every bottle's shape, cap, glass color and printed text faithfully, sharp and legible.

Restyle the scene as a dark, moody, luxurious Halloween night — elegant and cinematic, not cartoonish. The wall becomes a deep charcoal-plum plaster in low light; the stone surface is dark and glossy. The products are lit by warm low candlelight from the right with a subtle orange rim light, so the amber liquid in the bottles glows. A soft cool moonlight haze on the left, and across the upper right of the wall the shadow of bare, twisted branches with the clear silhouettes of four or five bats in flight. Add Halloween props only between 55% and 95% of the frame width, never covering any bottle or label: one carved jack-o'-lantern pumpkin with a classic grinning face glowing bright orange from a candle inside — it must be instantly recognizable as Halloween — plus one or two matte black pumpkins, several lit black candles of different heights with dripping wax, scattered dark red and brown dried leaves, a clearly visible spider web stretched across the right corner of the top stone block, and a thin wisp of low fog drifting across the stone surface. The palette reads as orange and black.

The left 55% of the frame must stay completely empty, dark and smooth: only the charcoal wall with a gentle, even moonlit gradient above the dark stone surface, calm enough for white text to be read on it — no objects, no props, no candles, no bats, no fog bright spots, no text in that area. The tallest bottle top stays at about 14% from the top edge and the lowest point of any object at about 86%. Camera at product level, 50mm lens look, tack-sharp focus on the products, crisp legible bottle labels, realistic reflections, unretouched luxury commercial product photograph. No added text, no logos other than what is printed on the original bottles, no watermark.
```

## B — Mobile prompt

```text
Image 1 is the exact scene reference: keep the same three perfume bottles (Emporio Armani "Stronger With You Intensely", Parfums de Marly "Layton", Azzaro "The Most Wanted Parfum"), the two glass decant vials, the travertine stone blocks, the camera angle, the composition and the 4:3 framing exactly as they are. Reproduce every bottle's shape, cap, glass color and printed text faithfully, sharp and legible.

Restyle the scene as a dark, moody, luxurious Halloween night — elegant and cinematic, not cartoonish. The wall becomes a deep charcoal-plum plaster in low light; the stone surface is dark and glossy. The products are lit by warm low candlelight from the right with a subtle orange rim light, so the amber liquid in the bottles glows. In the top right corner of the wall, the shadow of bare, twisted branches with the clear silhouettes of three or four bats in flight. Add small Halloween props only between 62% and 95% of the frame width, never covering any bottle or label: one carved jack-o'-lantern pumpkin with a classic grinning face glowing bright orange from a candle inside — it must be instantly recognizable as Halloween — plus one small matte black pumpkin, one or two lit black candles with dripping wax, a few dark dried leaves, a clearly visible spider web on the right corner of the top stone block and a thin wisp of low fog on the stone surface. The palette reads as orange and black. Keep the props small so everything fits inside this narrow area.

The left 62% of the frame, including the bottom-left corner, must stay completely empty, dark and smooth: only the charcoal wall with a gentle, even moonlit gradient above the dark stone surface, calm enough for white text to be read on it — no objects, no props, no candles, no bats, no text in that area. The tallest bottle top stays at about 30% from the top edge and the lowest point of any object at about 85%. Camera at product level, 50mm lens look, tack-sharp focus on the products, crisp legible bottle labels, realistic reflections, unretouched luxury commercial product photograph. No added text, no logos other than what is printed on the original bottles, no watermark.
```

---

## B — Mobile засвар (2026-10-27)

Эхний B mobile зурагт (`public/mobile-halloween.webp`) бараа зүүн талаас ~37%-иас
(хулуу), Armani ~47%-иас эхэлсэн тул 390px дээр тайлбарын мөр Armani-тай давхацсан.
Зохиомжийг prompt-оор дахин зуулгахын оронд **v4-ийн зохиомжийг яг хуулна**:
v4 mobile-д бараа ~54%-иас эхэлдэг бөгөөд текст давхцдаггүй.

**Model:** `gpt-image-2` · **edits** · **2048×1536** · quality high · `input_fidelity=high`

| | |
|---|---|
| Image 1 (зохиомж) | `public/mobile.png` (v4 эх) |
| Image 2 (хэв маяг) | `public/mobile-halloween.webp` (эхний B) |
| Output | `public/mobile-halloween.webp`-ийг дарж хадгал → `hero-mobile-halloween.webp` дахин үүсгэнэ |

```text
Image 1 is the exact composition reference: keep its framing, camera angle, the size and the exact position of every object — the three perfume bottles (Emporio Armani "Stronger With You Intensely", Parfums de Marly "Layton", Azzaro "The Most Wanted Parfum"), the two glass decant vials and the travertine stone blocks — pixel-for-pixel where they are in image 1. Do not move, enlarge or shift anything to the left. Reproduce every bottle's shape, cap, glass color and printed text faithfully, sharp and legible.

Image 2 is the style reference only: restyle image 1 to match image 2's dark, moody Halloween night — deep charcoal-plum plaster wall in low light, dark glossy stone surface with warm reflections, warm low candlelight from the right with a subtle orange rim light so the amber liquid glows, bare twisted branch shadows with three or four bat silhouettes in the top right corner of the wall. Ignore the position and scale of objects in image 2.

Add small Halloween props only to the right of the Armani bottle's left edge, between 58% and 97% of the frame width, never covering any bottle or label: one carved jack-o'-lantern pumpkin glowing orange from a candle inside, placed behind and to the right of the Azzaro bottle; one or two short lit black candles with dripping wax at the far right; a few dark dried leaves and a delicate spider web on the right corner of the top stone block; a thin wisp of low fog on the stone surface to the right of 58%. No black pumpkin, leaves, fog or any prop to the left of the Armani bottle.

The left 58% of the frame, including the bottom-left corner, must stay completely empty, dark and smooth: only the charcoal wall with a gentle, even moonlit glow above the dark stone surface, calm enough for white text to be read on it — no objects, no props, no pumpkins, no bats, no fog, no text in that area. Camera at product level, 50mm lens look, tack-sharp focus on the products, crisp legible bottle labels, realistic reflections, unretouched luxury commercial product photograph. No added text, no logos other than what is printed on the original bottles, no watermark.
```

Шалгах: Armani-гийн зүүн ирмэг ≥54%, түүнээс зүүн тийш (хулуу, навч, утаа ч) юу ч
байхгүй; 390px болон 320px дээр тайлбар савтай давхцахгүй.

---

## Шалгах

- Шошго (YOU INTENSELY, PARFUMS de MARLY, AZZARO) тод, үсэг зөв эсэх.
- Харангуут Halloween гэж танигдах эсэх: сийлсэн гэрэлтэй хулуу, сарьсан багваахайн сүүдэр, аалзны тор тод харагдаж байна уу.
- Зүүн 55% (desktop) / 62% (mobile, доод булан оролцуулан) хоосон эсэх: хулуу, багваахайн сүүдэр, навч ч байх ёсгүй.
- A хувилбарт: зүүн талын хана дээр бараан текст уншигдахуйц цайвар эсэх.
- Хэмжээ яг 2.8:1 / 4:3 эсэх. Тайралт, screenshot шалгалт: [hero-desktop.md](./hero-desktop.md) §Шалгах.
