# Google хайлтын thumbnail (1:1)

**Файл:** `public/og-image-square.jpg` — **1200×1200 (1:1)**, JPEG q85, < 200 kB.
**Ашиглалт:** вэб дээр хаана ч харагдахгүй. Нүүр хуудасны JSON-LD-д `primaryImageOfPage` + `image` болж, Google хайлтын үр дүнгийн баруун талын дөрвөлжин thumbnail-д гарна. Messenger/Facebook-ийн share зураг (`public/og-image.jpg`, 1.91:1) хэвээр үлдэнэ — энэ нь түүний дөрвөлжин хос.
**Model:** `gpt-image-1.5` (эсвэл `gpt-image-2`), size **1024×1024** (square), quality high → 1200×1200 болгож томруулна (доорх «Гаргасны дараа»).

## Зарчим

- **`og-image.jpg`-тэй нэг цуврал:** ижил 4 decant шил, хар дэвсгэр, ягаан rim light. Хайлт ба Messenger дээр нэг брэнд шиг харагдана.
- **Лого, текст давхарлахгүй.** Хайлтад thumbnail ~90px л харагдана — лого уншигдахгүй, жижиг толбо болно. Лого аль хэдийн зүүн талын favicon-д гарна, давхардуулахгүй.
- **Төвд, кадрыг дүүргэсэн:** Google зарим үед дугуйлж эсвэл захаас нь бага зэрэг тайрдаг → савнууд төвийн ~70%-д багтана, захад 15% орчим хоосон зай.
- **Хүчтэй силуэт:** 90px дээр ч «шат мэт өсөх 4 шил» гэдэг нь танигдах ёстой — цөөн объект, тод контраст, нарийн дэлгэрэнгүйгүй.
- Бүтэн сав **оруулахгүй** (одоогоор зардаггүй).

## Prompt

> Luxury perfume advertisement photograph, square 1:1 composition, centered. Four slim clear-glass decant spray vials standing in a row in the middle of the frame, ascending in height from left to right like a staircase — a tiny 2ml vial, a 5ml, a 10ml and a 20ml — each with a matte black atomizer cap, all holding the same pale golden liquid. The group is centered horizontally and fills the frame: the tallest vial reaches about 70% of the frame height, the row spans about 70% of the frame width, with even spacing and roughly 15% empty margin on every side. All glass completely blank — absolutely no label, no text, no logo, no engraving, no measurement markings. The vials stand on a glossy black surface in the lower third of the frame with a soft mirror reflection beneath them. A single deep magenta-pink (#c2245c) rim light from behind traces the edges of the glass and glows faintly through the liquid; everything else lit by one soft white key light from above-right. Background pure deep black falling off into darkness, plain with no detail. Minimal, quiet, premium, very high contrast, bold readable silhouette that still works as a tiny thumbnail. Shot on a 100mm macro lens at f/5.6, photorealistic studio product photography, crisp glass edges, true-to-life color. Realistic photograph — not a 3D render, not CGI, not an illustration. No large perfume bottle, no other bottles, no people, no hands, no flowers, no props, no text anywhere.

## Хувилбар

**Б — илүү ойрын кадр** (90px дээр илүү тод): `the tallest vial reaches about 70%` → `about 85%`, `about 15% empty margin` → `about 8% empty margin`. Шилнүүд томорч, ягаан гэрэл илүү тод харагдана.

## Гаргасны дараа

1. Томруулж хадгалах: `node -e "require('sharp')('<эх>.png').resize(1200,1200,{fit:'cover'}).jpeg({quality:85,mozjpeg:true}).toFile('public/og-image-square.jpg')"`
2. 90px болгож харж шалгах: `node -e "require('sharp')('public/og-image-square.jpg').resize(92).toFile('/tmp/thumb-92.png')"` → 4 шил шат мэт танигдаж байвал болно.
3. Код: `src/components/shared/json-ld.tsx`-д нүүр хуудасны `WebPage` entity нэмж `primaryImageOfPage` + `image: [square, og-image]` заана (Claude-д хэлбэл хийнэ).
4. Deploy-н дараа Search Console → URL Inspection → `https://www.vonscent.mn` → **Request indexing**. <https://search.google.com/test/rich-results> дээр JSON-LD зөв уншигдаж байгааг шалгана.
