# «Үнэрийн төрлөөр» (scent family) дүрсүүд

**Model:** `gpt-image-1.5` (апп болон batch script-ууд бүгд үүнийг хэрэглэдэг — `src/lib/ai/generate-image.ts`), size 1024×1024, quality high, `background: "transparent"`, `output_format: "png"` → 256px alpha-тай WebP болж Storage-ийн `families/` фолдерт орно

**Хаана:** админ `/admin/scent-families` дээр шинэ төрөл нэмэхэд дүрсээ оруулаагүй бол **автоматаар** үүснэ (`src/app/api/admin/scent-families/route.ts` → `src/lib/ai/family-icon.ts`, `after()` дотор). Үр дүн нь `scent_families.icon_url`, нүүрний «Үнэрийн төрлөөр» хэсэгт 64px-ээр буудаг.

**Гол зарчим — субьектийг загвар өөрөө сонгоно.** Prompt-д зөвхөн төрлийн НЭР (монгол нэр + латин slug) ба «энэ бол үнэртэй усны үнэрийн төрөл» гэдгийг өгнө; ямар эд зурахыг нь загвар өөрөө шийднэ. Тогтмол субьектийн жагсаалт байхгүй — админ ямар ч нэр («Утаат», «Нарны», «Гурмет») нэмсэн ажиллана.

**Гол хязгаарлалт — гурван загварт ажиллах ёстой:** дүрс хар (`.black`), цагаан (`.white`), ягаан (`.pink`) дэвсгэр дээр адилхан уншигдана. Тиймээс цэвэр цагаан ба бараг хар объект болохгүй, дэвсгэр нь **үнэхээр тунгалаг** (цагаан дөрвөлжин биш), ирмэг дээр цагаан хүрээ/halo үлдэхгүй байх ёстой.

## Prompt

`{LABEL}` — админы бичсэн нэр («Гурмет»), `{SLUG}` — латин slug («gourmand»).

> This picture is the icon of the "{LABEL}" (latin slug: "{SLUG}") fragrance family — one of the scent families a perfume shop sorts its perfumes into. Decide for yourself what to show: pick the single real object that a perfume shopper would most immediately read as that family — normally the raw ingredient the family is named after, or the material most characteristic of it — and photograph that one object. Exactly one subject in the frame; if the natural choice is several small pieces of the same material, arrange them as one tight group.
>
> Show it isolated as a clean product cut-out on a fully transparent background. Centered, filling about 80% of the square frame with even margins on all four sides. Photorealistic, natural vibrant color, fine visible surface texture, soft even studio lighting from the upper left, slight three-quarter view, and one subtle soft contact shadow directly beneath the object. Square 1:1 composition.

## Жишиг — одоо байгаа зургаан дүрс

Эдгээр нь `public/family-*.png` (гараар үүсгэсэн, 512×512). Шинэ дүрс эдгээрийн хажууд нэг иж бүрдэл шиг харагдах ёстой — загварт өгөх шаардлага биш, нүдээр шалгах жишиг:

| slug | нэр | зурагт юу байгаа |
| --- | --- | --- |
| `floral` | Цэцэгт | дээрээс харсан задгай ягаан сарнай |
| `woody` | Модлог | хуш модны блокууд, холтостой гуалин, буржгар үртэс |
| `fresh` | Сэргэг | шүүдэртэй ногоон гаа навч |
| `oriental` | Дорнын | доторооо гэрэлтсэн зөөлрүүлсэн амбер чулуу |
| `citrus` | Цитрус | нэг навчтай боловсорсон жүрж |
| `spicy` | Халуун | олсоор боосон шанцайны багц, дээр нь бадиан |

## Гаргасны дараа шалгах

1. Булангийн пиксел RGBA нь `0,0,0,0` — үгүй бол дэвсгэр нь цагаан дөрвөлжин, тунгалаг биш.
2. Хар/цагаан/ягаан гурван загварт нүүрэн дээр нь нүдээр шалгах.
3. Таарахгүй бол админ жагсаалтаас дүрсийг дараад гараар солино (upload нь AI-г дарж бичнэ).
