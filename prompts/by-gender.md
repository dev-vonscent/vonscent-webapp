# "Хүйсээр" (By gender) cards — model imagery

**Model:** `gpt-image-2`, size 1024×1536 (portrait), quality high → `public/gender-{male,female,unisex}.webp`
**Style:** monochrome (grayscale) luxury fragrance editorial to match the black/white/gray UI; dark black background.
**No text:** model өөрөө зохиомол брэнд нэр (SHAMBALA, KHAN, CHINGGIS KHAN) нэмж байсан тул prompt бүр текст/лого хориглоно.

## male

Elegant black-and-white high-fashion editorial portrait of a handsome Mongolian man in his late twenties with distinct Mongolian East-Asian features, confident and refined, wearing a sleek dark tailored outfit, posed with a luxury perfume bottle, dramatic moody studio lighting, deep black background, premium fragrance advertisement aesthetic, grayscale, cinematic, vertical composition. The perfume bottle is completely plain and unlabeled — smooth blank black glass with no label, no letters. Absolutely no text, no typography, no logos, no brand names, no watermark anywhere in the image.

## female

Elegant black-and-white high-fashion editorial portrait of a beautiful Mongolian woman in her twenties with distinct Mongolian East-Asian features, graceful and confident, wearing a refined dark dress, posed with a luxury perfume bottle, dramatic moody studio lighting, deep black background, premium fragrance advertisement aesthetic, grayscale, cinematic, vertical composition. The perfume bottle is completely plain and unlabeled — smooth blank black glass with no label, no letters. Absolutely no text, no typography, no logos, no brand names, no watermark anywhere in the image.

## unisex

Elegant black-and-white high-fashion editorial portrait of a stylish young Mongolian man and woman together, both with distinct Mongolian East-Asian features, modern and refined, wearing sleek dark outfits, posed with a luxury perfume bottle, dramatic moody studio lighting, deep black background, premium unisex fragrance advertisement aesthetic, grayscale, cinematic, vertical composition. The perfume bottle is completely plain and unlabeled — smooth blank black glass with no label, no letters. Absolutely no text, no typography, no logos, no brand names, no watermark anywhere in the image.

---

## Өнгөт хувилбар — каталог цэсний hover (2026-10-23)

Каталог цэсний хүйсний карт нь зургийг `grayscale` filter-ээр харуулж, hover дээр өнгө
рүү шилжүүлдэг тул эх зураг **өнгөт** байх ёстой. Карт нарийн босоо (~100×208px,
center crop) тул нүүр төвд, head-and-shoulders. Гаргасан файл → `public/gender-{male,female,unisex}.webp`
(бүтэн хар цагаан хувилбарыг орлоно). gpt-image-2, 1024×1536, high.

### male (color)

Luxury fragrance editorial portrait in rich natural color of a handsome Mongolian man in his late twenties with distinct Mongolian East-Asian features, confident and refined, head-and-shoulders close-up with the face centered in the frame, wearing a sleek charcoal tailored jacket, holding a plain perfume bottle near his collarbone, warm soft studio lighting with gentle amber and deep teal tones, dark moody background, realistic skin tones, cinematic, vertical composition. The perfume bottle is completely plain and unlabeled — smooth blank glass with no label, no letters. Absolutely no text, no typography, no logos, no brand names, no watermark anywhere in the image.

### female (color)

Luxury fragrance editorial portrait in rich natural color of a beautiful Mongolian woman in her twenties with distinct Mongolian East-Asian features, graceful and confident, head-and-shoulders close-up with the face centered in the frame, wearing a refined deep burgundy silk dress, holding a plain perfume bottle near her collarbone, warm soft studio lighting with gentle rose-gold tones, dark moody background, realistic skin tones, cinematic, vertical composition. The perfume bottle is completely plain and unlabeled — smooth blank glass with no label, no letters. Absolutely no text, no typography, no logos, no brand names, no watermark anywhere in the image.

### unisex (color)

Luxury fragrance editorial portrait in rich natural color of a stylish young Mongolian man and woman together, both with distinct Mongolian East-Asian features, cheek to cheek, both faces close together and centered in the frame, head-and-shoulders close-up, wearing sleek dark navy and black outfits, one plain perfume bottle held between them, warm soft studio lighting with gentle amber tones, dark moody background, realistic skin tones, cinematic, vertical composition. The perfume bottle is completely plain and unlabeled — smooth blank glass with no label, no letters. Absolutely no text, no typography, no logos, no brand names, no watermark anywhere in the image.

## Өнгөт хувилбар v2 — одоогийн хар цагаан зургийг edit (2026-10-23)

Шинээр generate хийсэн өнгөт хувилбар хэт «AI» харагдсан тул одоогийн
`public/gender-*.webp` (хар цагаан, бодит харагддаг) зургийг **input** болгож
edit endpoint-оор: бичиг/лого арилгаж, өнгөтэй болгоно. Хүн, поз, гэрэл хэвээр.
gpt-image-2 · edits · 1024×1536 · quality high · `input_fidelity=high`.

### edit prompt (гурвуулаа ижил)

Colorize this black-and-white photograph into a natural, realistic color photograph, as if it was originally shot in color on a real camera. Keep the exact same person(s), face, identity, expression, pose, hands, hair, clothing, lighting direction, framing and composition — change nothing else. Realistic true-to-life skin tones with natural variation, visible pores and texture, no airbrushing, no glow, no orange or golden cast. Clothing stays dark (black / charcoal), background stays deep near-black with a very subtle warm tone. Muted, understated color grading, slight film grain. Remove ALL text, typography, logos and brand names everywhere: erase the large wordmark at the bottom and fill that area with the same seamless dark background; make the perfume bottle completely plain and unlabeled — smooth blank dark glass with no label and no letters. No text, no logos, no watermark anywhere.
