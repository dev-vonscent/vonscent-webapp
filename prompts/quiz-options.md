# "Үнэрээ ол" quiz tiles + home widget side imagery

**Model:** `gpt-image-1`, size 1024×1536 (portrait), quality high → `public/quiz/{option-id}-v2.webp` (widgets: `public/quiz-side-v2.webp`, `public/bundle-side-v2.webp`)
**Style:** option tiles are bright, natural-color, subject-first — the tile shows the OPTION's meaning (a beach, a candle, a rose…), never a perfume product, and must read on both the dark and light theme (the tile's own bottom gradient keeps labels legible). Widget side images keep a brightened fragrance-editorial look.
**Script:** `node scripts/gen-quiz-images.mjs` (skips files that already exist; delete a file and rerun to regenerate it).
**Note:** хүйсийн асуулт одоо байгаа `public/gender-{male,female,unisex}.webp`-г шууд дахин ашигладаг тул шинээр гаргах шаардлагагүй. Улирлын асуулт өмнө нь нүүрний `season-*.jpg`-г (хэвтээ 3:2) ашигладаг байсан ч босоо tile дотор бүдэг харагдаж байсан тул одоо өөрийн босоо зурагтай болсон.

## Base prompt — option tiles

Beautiful atmospheric photograph of {SUBJECT}, the subject large, clearly visible and filling the frame, natural vibrant colors, bright cinematic lighting, professional editorial photography, shallow depth of field, premium minimalist composition, vertical format. Strictly no perfume bottles, no glass flasks, no cosmetic products, no people holding products, no text, no logos.

## Subjects per option

### Амралтын өдөр (weekend)

- `weekend-beach` — turquoise ocean waves rolling onto a sunlit sandy beach under a blue sky
- `weekend-forest` — a green pine forest path with morning sunrays streaming through the trees
- `weekend-cozy` — a warm lit candle and an open book on a knitted blanket, cozy golden interior light
- `weekend-garden` — a lush blooming flower garden in soft morning light, pink and white blossoms

### Өдрийн цаг (time)

- `time-morning` — golden sunrise light breaking over misty green hills
- `time-noon` — bright midday sun over fresh citrus fruits and green leaves
- `time-sunset` — a vivid orange and pink sunset sky over a calm horizon
- `time-night` — a starry night sky with a bright crescent moon over silhouetted mountains

### Зан чанар (character)

- `character-energetic` — a dynamic splash of orange juice and citrus slices frozen mid-air on a bright background
- `character-romantic` — a bouquet of deep red roses with soft warm light
- `character-warm` — glowing fireplace embers with cinnamon sticks and star anise, warm amber tones
- `character-calm` — smooth grey stones stacked in balance beside calm water, soft neutral light

### Улирал (season)

- `season-spring` — blooming pink cherry blossom branches against a soft blue spring sky
- `season-summer` — a sunlit green summer meadow full of colorful wildflowers under a clear blue sky
- `season-autumn` — vibrant golden and red maple leaves glowing in warm low autumn sunlight
- `season-winter` — snow-covered pine branches sparkling in soft winter sunlight, cool blue tones

### Сэтгэгдэл (impression)

- `impression-whisper` — a delicate wisp of white mist floating in soft pastel light
- `impression-balanced` — a serene zen composition of a leaf floating on still clear water
- `impression-bold` — a dramatic burst of colorful smoke swirling against a bright backdrop

## Widget side imagery

Base prompt: Luxury fragrance editorial photograph, {SUBJECT}, deep charcoal background, dramatic studio lighting with a warm golden glow from one side, subtle warm accents, generous negative space, premium fragrance advertisement aesthetic, cinematic, vertical composition, warm inviting lighting, rich visible detail, not dark.

- `quiz-side` (`public/quiz-side-v2.webp`, quiz intro, image right) — raw perfume ingredients on black stone — bergamot slices, vanilla pods, sandalwood shavings, a dark rose, amber resin — arranged loosely from above
- `bundle-side` (`public/bundle-side-v2.webp`, bundle promo, image left) — a neat row of small glass perfume decant vials in ascending sizes with minimal black labels on a reflective black surface, shallow depth of field
