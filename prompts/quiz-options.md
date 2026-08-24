# "Үнэрээ ол" quiz tiles + home widget side imagery

**Model:** `gpt-image-1`, size 1024×1536 (portrait), quality high → `public/quiz/{option-id}.png` (widgets: `public/quiz-side.png`, `public/bundle-side.png`)
**Style:** dark moody luxury fragrance editorial to match the black/white/gray UI; deep black background.
**Script:** `node scripts/gen-quiz-images.mjs` (skips files that already exist).
**Note:** хүйсийн асуулт одоо байгаа `public/gender-{male,female,unisex}.png`-г, улирлын асуулт `public/season-{spring,summer,autumn,winter}.jpg`-г шууд дахин ашигладаг тул шинээр гаргах шаардлагагүй.

## Base prompt

Dark moody luxury fragrance editorial photograph, {SUBJECT}, deep black background, dramatic low-key studio lighting with a faint warm golden glow from one side, monochrome with subtle warm accents, generous negative space, premium fragrance advertisement aesthetic, cinematic, vertical composition.

## Subjects per option

### Амралтын өдөр (weekend)

- `weekend-beach` — sunlit ocean waves rolling onto dark wet sand, seen from above
- `weekend-forest` — a misty dark pine forest path with rays of light between the trees
- `weekend-cozy` — a lit candle beside an open book on dark linen sheets
- `weekend-garden` — night-blooming white flowers in a dark garden at dusk

### Өдрийн цаг (time)

- `time-morning` — soft dawn light breaking through fog over dark hills
- `time-noon` — a bright beam of sunlight falling on fresh citrus slices
- `time-sunset` — a warm golden sunset horizon fading into darkness
- `time-night` — a crescent moon reflected on dark rippled glass

### Зан чанар (character)

- `character-energetic` — a frozen splash of clear water with citrus zest bursting through it
- `character-romantic` — a single dark red rose with dew drops on its petals
- `character-warm` — glowing embers with cinnamon sticks and star anise
- `character-calm` — smooth dark river stones stacked in perfect balance

### Сэтгэгдэл (impression)

- `impression-whisper` — a barely visible wisp of perfume mist dissolving into darkness
- `impression-balanced` — a fine even veil of mist hanging in calm soft light
- `impression-bold` — dense swirling perfume mist caught in a dramatic beam of light

## Widget side imagery

- `quiz-side` (`public/quiz-side.png`, quiz intro, image right) — raw perfume ingredients on black stone — bergamot slices, vanilla pods, sandalwood shavings, a dark rose, amber resin — arranged loosely from above
- `bundle-side` (`public/bundle-side.png`, bundle promo, image left) — a neat row of small glass perfume decant vials in ascending sizes with minimal black labels on a reflective black surface, shallow depth of field
