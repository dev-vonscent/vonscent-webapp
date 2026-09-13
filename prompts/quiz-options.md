# "Үнэрээ ол" quiz tiles + home widget side imagery

**Файл:** `public/quiz/{option-id}.webp` (widgets: `public/quiz-side.webp`, `public/bundle-side.webp`). Зургууд эцсийн байдлаараа орсон — дахин гаргах бол доорх prompt-уудыг ашиглаад ижил нэрээр нь дарж бичнэ.
**Хэмжээ:** гаргасан файлыг өргөнөөр 1024px болгож webp q85-аар шахна (~20–400 kB). Tile нь `aspect-3/4` тул 3:4 эсвэл 2:3 хоёулаа тохирно.
**Style:** option tiles are bright, natural-color, subject-first — the tile shows the OPTION's meaning (a beach, a candle, a rose…), never a perfume product (сэтгэгдлийн асуулт нь цорын ганц үл хамаарах зүйл: доороос үз), and must read on both the dark and light theme (the tile's own bottom gradient keeps labels legible). Widget side images keep a brightened fragrance-editorial look.
**Гаргалт:** гадны зураг үүсгэгчээр (gpt-image-1 маягийн, босоо 1024×1536 эсвэл 3:4). Генератор script байхгүй — зураг бүр гараар шалгаж сонгогдсон.
**Note:** хүйсийн асуулт одоо байгаа `public/gender-{male,female,unisex}.webp`-г ашигладаг тул шинээр гаргах шаардлагагүй — гэхдээ quiz дотор `public/quiz/gender-*.webp` (эх зургийн дээд 80%) харагдана: эх зурагны доод ирмэг дээр брэндийн бичиг байдаг бөгөөд нүүр хуудас `object-top`-оор нуудаг ч tile-ийн голлосон 3:4 тайралтад үлдэж байсан. Улирлын асуулт өмнө нь нүүрний `season-*.jpg`-г (хэвтээ 3:2) ашигладаг байсан ч босоо tile дотор бүдэг харагдаж байсан тул одоо өөрийн босоо зурагтай болсон.

## Base prompt — option tiles

Beautiful atmospheric photograph of {SUBJECT}, the subject large, clearly visible and filling the frame, natural true-to-life colors, bright cinematic daylight, professional editorial photography shot on a 50mm lens, shallow depth of field, premium minimalist composition, vertical 3:4 format. Realistic photograph — not a 3D render, not CGI, not an illustration, no oversaturated plastic look. Strictly no perfume bottles, no glass flasks, no cosmetic products, no people, no text, no logos.

## Subjects per option

### Амралтын өдөр (weekend)

Дөрвүүлээ mergejliin photoshoot / cinematic төрхтэй.

- `weekend-beach` — turquoise ocean waves curling onto a golden sandy shore at golden hour, low camera angle close to the water, sunlight glittering on the wave crest, fine spray droplets caught in the light
- `weekend-forest` — a narrow path through a misty pine forest at early morning, strong volumetric sunrays cutting through the fog between the trunks, deep layered greens, atmospheric haze
- `weekend-cozy` — a single burning candle beside an open book on a chunky knitted wool blanket, warm tungsten glow lighting the pages, deep soft shadows, rich textures of paper and wool
- `weekend-garden` — a blooming garden of white and pink cosmos flowers at golden hour, warm low sun backlighting the petals so they glow translucent, dreamy creamy bokeh

### Өдрийн цаг (time)

- `time-morning` — golden sunrise light breaking over misty green hills
- `time-noon` — bright midday sunlight streaming down through a fresh green tree canopy, clear blue sky visible between the leaves, strong overhead light and crisp shadows
  <br>*(Өмнө нь macro жимсний натюрморт байсан — нар мандах/жаргах/шөнийн тэнгэртэй ижил цувралд харагдахгүй тул ландшафт болгов.)*
- `time-sunset` — a vivid orange and pink sunset sky over a calm horizon
- `time-night` — a starry night sky with a bright crescent moon over silhouetted mountains

### Зан чанар (character)

- `character-energetic` — a dynamic splash of orange juice and citrus slices frozen mid-air on a bright background
- `character-romantic` — a bouquet of deep red roses with soft warm light
- `character-warm` — glowing fireplace embers with cinnamon sticks and star anise, warm amber tones
- `character-calm` — smooth grey stones stacked in balance beside calm water, soft neutral light

### Улирал (season)

Дөрвүүлээ нэг цуврал — ойрын зураг, бүдгэрсэн фонтой.

- `season-spring` — blooming pink cherry blossom branches against a soft clear blue spring sky, gentle morning light
- `season-summer` — sunlit tall green grass blades and small yellow wildflowers in a summer meadow seen very close up, golden afternoon sunlight backlighting the stems, very shallow depth of field with a soft blurred blue sky behind
  <br>*(Өмнө нь өргөн уудам тал байсан — нөгөө гурав ойрын зураг тул эгнээнээс тусдаа харагдаж байв.)*
- `season-autumn` — golden and deep red autumn leaves on a birch and maple grove, glowing in warm low afternoon sunlight
- `season-winter` — snow-covered pine branches sparkling in soft winter sunlight, cool blue-and-white tones, clear crisp air

### Сэтгэгдэл (impression) — **хүнтэй зураг**

Энэ асуулт нь tile-ийн "хүнгүй" дүрмээс зориуд гардаг. Манан / торго / утаа зэрэг хийсвэр дүрслэл "үнэр чинь хэр хол мэдрэгдэх вэ" гэдгийг уншуулж чадаагүй; харин **хэр зайнаас анзаарагдаж байгаа** нь текст уншихгүйгээр ойлгогддог. Модел нь монгол төрхтэй — хүйсийн картуудтай (`prompts/by-gender.md`) ижил хэллэг.

Зайн шатлал нь кадрын өргөнөөр илэрнэ: шивнээ = гар сунгах зай → тэнцвэртэй = хажуугаар өнгөрөх зай → тод = танхимын нөгөө захаас.

Base prompt (хүнтэй tile): Cinematic photograph of {SUBJECT} Professional editorial photography, film-like grain, vertical 3:4 format. Realistic photograph — not a 3D render, not CGI. No text, no logos, no perfume bottles.

`impression-balanced` ба `impression-bold` нь **эрэгтэй/эмэгтэй хоёр хувилбартай** (`-{male,female}.webp`) — эхний асуултын хүйсийн хариултаар tile нь солигдоно; «Unisex» үед эмэгтэй хувилбар (`questions.ts` → `imagesByGender`). Whisper нь хос хүн харуулдаг тул нэг хувилбартай.

- `impression-whisper` — two young Mongolian people with distinct Mongolian East-Asian features sitting side by side at arm's length on a sofa in a quiet sunlit living room, leaning in toward each other in a soft private conversation, tight intimate framing with the two of them filling most of the frame and no one else visible, warm gentle window light, calm muted colors, shallow depth of field, shot on a 50mm lens.
- `impression-balanced-{female|male}` — a well-dressed young Mongolian woman/man with distinct Mongolian East-Asian features walking along a bright city street in daylight; one passer-by walking close beside her/him turns slightly and glances at her/him as they pass, everyone else around is unaware and looking ahead. Medium shot from the side, the two figures close to each other, relaxed everyday elegance, natural daylight, muted neutral color palette, shallow depth of field, shot on a 50mm lens.
- `impression-bold-{female|male}` — an elegant evening event hall, a striking young Mongolian woman/man with distinct Mongolian East-Asian features walking in through the open space, small to medium in the frame with visible empty floor around her/him, while five or six Mongolian guests standing several meters away across the room have all clearly turned their heads toward her/him. Sense of distance and open space, restrained natural evening lighting, muted neutral palette with soft warm accents, deep focus so the watching guests stay readable, shot on a 35mm lens.

## Widget side imagery

Base prompt: Luxury fragrance editorial photograph, {SUBJECT}, deep charcoal background, dramatic studio lighting with a warm golden glow from one side, subtle warm accents, generous negative space, premium fragrance advertisement aesthetic, cinematic, vertical composition, warm inviting lighting, rich visible detail, not dark.

- `quiz-side` (`public/quiz-side.webp`, quiz intro, image right) — raw perfume ingredients on black stone — bergamot slices, vanilla pods, sandalwood shavings, a dark rose, amber resin — arranged loosely from above
- `bundle-side` (`public/bundle-side.webp`, bundle promo, image left) — a neat row of small glass perfume decant vials in ascending sizes with minimal black labels on a reflective black surface, shallow depth of field
