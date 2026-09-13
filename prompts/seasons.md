# «Улирлаар» нүүрний зургууд

**Файл:** `public/season-{spring,summer,autumn,winter}.jpg` + `public/season-all.webp` — 1024×682/683 (**3:2 хэвтээ**), `page.tsx` → `aspect-3/2` tile, `object-cover`.
**Model:** `gpt-image-1.5` (эсвэл `gpt-image-2`), size 1536×1024 (landscape), quality high → 1024px өргөнтэй болгож JPEG q80 (~100–120 kB) болгон шахна.
**Ашиглалт:** нүүр хуудасны «Улирлаар» хэсэг (`src/app/(shop)/page.tsx`), `/catalog?season={slug}` руу холбогдоно. Slug-ууд `SEASONS` / `SEASON_LABEL` (`src/lib/constants.ts`) дотор — `all` = «Бүх улирал».

**Стиль (анхны дөрвөн зургаас задалсан):** энэ хэсэг нь quiz tile-уудаас **зориуд өөр** — энд үнэртэй усны сав **байх ёстой**. Нэг л сав, кадрын голд, босоо, өндрөөрөө кадрын ~70%; ард нь тухайн улирлыг заасан бүдгэрсэн орчин (маш богино fokus), саван дээр ямар ч шошго/бичиг байхгүй. Tile дээр доороос нь хар gradient орж цагаан монгол нэр буудаг тул **кадрын доод 1/3 нь нам гэгээтэй, нарийн дэлгэрэнгүйгүй** байх ёстой.

## Base prompt

> Luxury perfume advertisement photograph. A single unbranded perfume bottle standing upright in the exact center of the frame, filling about 70% of the frame height, {BOTTLE}, completely blank glass with absolutely no label, no text, no logo, no engraving. Behind it {SCENE}, thrown far out of focus into soft creamy bokeh. {LIGHT} Shot on a 85mm lens at f/1.8, photorealistic product photography, fine visible texture on the glass, natural true-to-life color, horizontal 3:2 composition, the lower third of the frame kept dark, plain and free of fine detail. Realistic photograph — not a 3D render, not CGI, not an illustration. No people, no hands, no other bottles, no text anywhere.

## Улирал бүрийн утгууд

| slug | BOTTLE | SCENE | LIGHT |
| --- | --- | --- | --- |
| `spring` | a tall slender clear-glass flacon with a golden amber liquid and a rounded glass stopper with a gold collar | branches of pale pink cherry blossom crowding in from both sides, a few fallen petals on the surface at the base | Soft diffused morning light, airy pale pink and cream palette, gentle and bright. |
| `summer` | a squat square frosted aqua-blue bottle beaded with fresh water droplets, chrome collar and a thick clear cap | a turquoise sea and clear blue sky horizon, the bottle resting on a cluster of wet black pebbles | Bright clean midday sunlight, cool turquoise and blue palette, crisp and fresh. |
| `autumn` | a rectangular matte black bottle with a fine copper shimmer in the glass and a glossy black cap | a bed of dry orange and rust-brown fallen leaves with scattered roasted coffee beans | Low warm amber side light, deep shadows, rich orange and brown palette. |
| `winter` | a rounded flat midnight-blue glass bottle with a gold collar and a dark navy cap | powdery fresh snow with a single deep-purple orchid bloom lying beside the bottle | Cold blue moonlit twilight with one warm golden rim light on the glass edge, dark navy palette. |

## «Бүх улирал» (`season-all`) — шинэ tile

Гол санаа: нөгөө дөрөв нь **нэг улирал = нэг орчин**, харин энэ нь **дөрвүүлээ нэг кадарт**. Тиймээс сав нь өнгөгүй, тунгалаг — өөрөө ямар ч улиралд хамаарахгүй, ард нь дөрвөн улирлын өнгө зөөлөн шилжинэ. «4 зургийн дунджаар» харагдахгүй, өөрөө нэг тусдаа дүр байх ёстой.

> Luxury perfume advertisement photograph. A single unbranded perfume bottle standing upright in the exact center of the frame, filling about 70% of the frame height, a simple clear faceted crystal flacon holding a pale neutral liquid, polished silver collar and a clear glass cap, completely blank glass with absolutely no label, no text, no logo, no engraving. Behind it one continuous out-of-focus landscape that transitions through all four seasons from left to right — pale pink cherry blossom, then sunlit fresh green foliage, then warm orange autumn leaves, then cool blue-white snow — the four blending smoothly into one another as soft creamy bokeh with no hard seam, no split screen, no grid, no dividing lines. On the surface around the base a few scattered hints of each season: one pink petal, one green leaf, one dry orange leaf, a dusting of snow, all small and low-contrast. Balanced neutral daylight, the bottle itself lit cleanly with a soft silver highlight down one edge so it stays colorless against the colorful background. Shot on a 85mm lens at f/1.8, photorealistic product photography, natural true-to-life color, horizontal 3:2 composition, the lower third of the frame kept dark, plain and free of fine detail. Realistic photograph — not a 3D render, not CGI, not an illustration. No people, no hands, no other bottles, no text anywhere.

**Хувилбар Б (илүү нам гүм)** — хэрэв дээрх нь алаг цоог гарвал: фонг бүхэлд нь саарал-мөнгөлөг бүдэг болгож, зөвхөн савны шилэн дотуур дөрвөн улирлын өнгө (ягаан/ногоон/улбар шар/цэнхэр) тусах байдлаар:

> …Behind it a plain soft grey studio haze, completely out of focus. The four seasons appear only as colored light refracted through the crystal — a pink, a green, an amber and an icy blue glow separating inside the glass like a prism — while everything around the bottle stays neutral grey. …

## Гаргасны дараа

1. 1024px өргөн болгож шахна — `node -e "require('sharp')('<эх>').resize(1024).webp({quality:82}).toFile('public/season-all.webp')"` (одоогийнх 31 kB).
2. Нүүрэн дээр нөгөө дөрвийн хажууд эгнээнд тавьж **нүдээр шалгах** — өнгөний эрч, савны хэмжээ, доод gradient дээрх нэр уншигдаж байгаа эсэх.
3. Layout: одоо `grid-cols-2 sm:grid-cols-5` — гар утсан дээр «Бүх улирал» нь `last:col-span-2`-оор бүтэн мөр эзэлнэ.
