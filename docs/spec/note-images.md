# Үнэрийн нотын зураг

Бараа бүрд **хоёр дахь галерейн зураг**: тухайн барааны өөрийнх нь сав, ард нь
үнэрийн нотуудынх нь түүхий орц хөвж буй байдлаар, цул хар дэвсгэр дээр.

**Хоёр газар ашиглагдана:**

| | |
|---|---|
| Байгаа каталог (багц) | `scripts/gen-note-images.ts` · `pnpm db:gen-note-images` |
| Шинэ бараа нэмэх (авто) | `src/lib/ai/new-product-pipeline.ts` — §6 |

Prompt, нот→англи хөрвүүлэлт, хар дэвсгэрийн боловсруулалт нь **хуваалцсан
модулиудад** байна, тиймээс хоёр урсгал үргэлж ижил зураг гаргана:

- `src/lib/ai/note-image.ts` — nотын prompt + `finishNoteImage()`
- `src/lib/ai/packshot-prompt.ts` — `PACKSHOT_PROMPT`
- `src/lib/ai/notes-en.ts` — MN→EN хүснэгт + `pickNotes()`

> Энэ нь `ai-image-generation-requirement.md`-д тайлбарласан **админы нэг
> бүрчлэн үүсгэх** функцээс тусдаа. Энэ нь нэг удаагийн багц ажиллагаа: бүх
> барааг дамжуулж, галерейд нэг мөр **нэмнэ**. Каталогийн карт дээрх үндсэн
> зураг (`sort_order 0`) хөндөгдөхгүй.

---

## 1. Урсгал

```
products.product_images[sort_order 0]   ← лавлах зураг (DB дэх үндсэн зураг)
        ↓
gpt-image-1.5  /v1/images/edits   1024×1024, quality=high
        ↓
хар цэгийн хавчилт (BLACK_POINT)  → дэвсгэр яг #000000
        ↓
хүрээний гэрэлтэлт шалгах (MAX_BACKDROP_LUMA) → саарал бол алдаа, DB-д орохгүй
        ↓
webp (q82) → Supabase storage → product_images шинэ мөр (sort_order = max+1)
```

**Лавлах зураг нь заавал DB дэх одоогийн үндсэн зураг байна** — ингэснээр
үр дүн дээрх сав нь дэлгүүрийн үнэхээр зардаг сав болно, зохиомол сав биш.

---

## 2. Prompt

`${notes}` нь тухайн барааны нотуудын **англи** нэр, таслалаар (§3).

```
Edit the reference photo. Keep the perfume bottle exactly as it is — identical shape,
proportions, cap, glass, liquid color, label, logo, typography and reflections — and keep
its existing position, scale and framing. Do not move, resize, re-center or crop it.

Delete the original background completely. The pale grey studio sweep, its surface, its
horizon and the bottle's cast shadow must be gone entirely — not darkened, not tinted,
not left faintly visible. Replace them with empty black space: the bottle now stands in a
blacked-out studio against black velvet, photographed with no background light at all.
The background is unlit emptiness, pure #000000, RGB 0,0,0, flat and identical in every
corner of the frame.

The only lights in the scene are narrow spotlights aimed at the bottle and the
ingredients. Their beams are tight enough that no light falls past the subjects and
nothing at all illuminates the space behind them.

Directly behind the bottle, floating and suspended in mid-air, weightless, at varied
angles: ${notes}. Group them as one tight cluster pressed in close behind the glass, all
at roughly the same shallow distance behind it, never scattered or drifting into empty
space. They hide behind the bottle and only their outer parts emerge past its silhouette,
peeking out from behind its left and right edges and rising just past its shoulder. The
bottle overlaps and conceals whatever falls behind it, never the reverse, and nothing
passes in front of the glass. They must read as one connected arrangement growing out
from behind the bottle.

Render every ingredient in crisp razor-sharp focus with fine visible texture: deep focus,
no bokeh, no motion blur. Rim and edge highlights carve each one out of the darkness, and
their unlit sides fall away into the black. Dark ingredients — oud, black pepper, dark
berries, leather, roasted beans — must keep a bright enough lit edge to stay readable
against the black instead of disappearing into it.

Photorealistic cinematic luxury perfume product photography on a black background. No
text, no labels, no watermark, no hands, no smoke, no splashes.
```

### 2.1 Догол мөр бүр яагаад тэнд байна вэ

| Догол мөр | Зорилго |
|---|---|
| 1 | Савыг 100% хэвээр. Байрлал, хэмжээ, хүрээг ч бас — reference-ийнхийг хадгална |
| 2 | Дэвсгэрийг **устгах** (бараатгах биш). Edit-загвар эх зургаа хадгалах хандлагатай тул «not darkened, not tinted» гэж тодруулсан |
| 3 | Гэрлийг субъект дээр хорино. Дэвсгэр саарал болдгийн шалтгаан нь синематик гэрэл ард тийш асгардагт байсан |
| 4 | Орцууд ард нь **нягт бөөгнөрч цухуйна**. «Тарсан», «савнаас салангид» болохоос сэргийлнэ. Халхлалтын чиглэлийг зааж өгсөн — сав орцыг халхална, эсрэгээр биш |
| 5 | Хурц (bokeh биш), ирмэгийн гэрлээр харнаас сийлж гаргана. Бараан орц алга болохоос сэргийлнэ |

### 2.2 Хийхгүй зүйлс (туршиж үзээд бүтээгүй)

- **Ойролцоо hex-үүдийг нэрлэн хориглох** (`NOT #0A0A0A`, `NOT #111111`) — загвар
  үгүйсгэлийг муу боловсруулдаг тул тэр утгуудыг conditioning руу оруулж өгдөг.
- **Цагаанаар үүсгээд хар дээр буулгах** — яг хар өгдөг ч, цагаанд гэрэлтүүлсэн
  сав хар дээр хавтгай, «хайчилсан» мэт харагдана. Хар студид зурагдсан сав нь
  тухайн орчинд харьяалагдах ирмэгийн гэрэл, бараан тусгалтай болно.
- **Flood-fill background removal** — хүрээнээс дотогш дэвсгэрийн өнгөөр
  тархаж тайрдаг арга. Цагаан дэвсгэрт төгс ажилладаг ч хар дээр бараан
  пикселээр тархаж **хар савыг иднэ** (Bvlgari Man in Black бол харан дээрх хар
  хайрцаг). Тиймээс энэ pipeline-д огт хэрэглэхгүй, `git log`-д л үлдсэн.

---

## 3. Нот → англи

Каталог нотоо **монголоор** хадгалдаг (`products.notes_top/heart/base`), загвар
«Царсны хөвд»-ийг зурахгүй. `src/lib/ai/notes-en.ts`:

- `docs/import/enrichment/notes.mn.json` (импортын EN→MN хүснэгт) **урвуулсан**
  хүснэгт. Дахин орчуулга биш — эх нэрийг нь буцаан авдаг.
- Хүснэгт нь модуль дотор **шингээгдсэн**, файлаас уншдаггүй: энэ код Next
  серверт ч ажилладаг бөгөөд `docs/` deploy хийгддэггүй.
- Дээд тал нь **5 нот**, top → heart → base гэж ээлжлэн авна. Ингэснээр цитрус
  дүүрэн top-той үнэртэн ч гэсэн зүрхний цэцэг, суурийн модоо оруулна.
- **Зурагдах боломжгүй** нотыг хаяна: синтетик молекул (Ambroxan, Cashmeran,
  `Clearwood™`), хийсвэр аккорд (musk, amber, woody notes, mineral notes).

---

## 4. Хар өнгийг код баталгаажуулна

Загвар `#000000` гуйхад **ойролцоо** утга буцаадаг — `#0A0A0A`, бага зэргийн
vignette, субъектээс асгарсан гэрэл. Тиймээс prompt дангаараа хангалтгүй:

| Тогтмол | Утга | Үүрэг |
|---|---|---|
| `BLACK_POINT` | 16 | Үүнээс бараан бүх пикселийг яг `0,0,0` болгож татна (`sharp.linear`) |
| `MAX_BACKDROP_LUMA` | 12 | Хавчилтын дараа хүрээний гэрэлтэлт үүнээс их бол **алдаа** — саарал дэвсгэртэй зураг DB-д орохгүй |

---

## 5. Ажиллуулах

```bash
pnpm db:gen-note-images --dry            # төлөвлөгөө + бараа бүрийн нот
pnpm db:gen-note-images --limit=3        # дээж
pnpm db:gen-note-images tom-ford-oud-wood   # нэрлэсэн бараа
pnpm db:gen-note-images                  # бүгд
pnpm db:gen-note-images --rollback       # буцаах
```

- **Төлбөртэй** — бараа тутамд нэг генерац. Хоосон ажиллуулахад юу ч хийхгүй,
  `--dry` шаардана.
- Manifest-д (`docs/import/enrichment/note-images.json`) бүртгэгдсэн бараа
  **алгасагдана** — тасалдсан ажиллагаа үргэлжилнэ, давхар төлбөр гарахгүй.
  `--force` дарж давна.
- `--rollback` нь оруулсан мөр болон storage файлыг устгана. Үндсэн зураг
  (`sort_order 0`) огт хөндөгдөхгүй тул буцаалт бүрэн аюулгүй.
- Зэрэг ажиллах хүсэлт 4 (`--concurrency=`). Дээшлүүлэх нь ашиггүй: квот нь
  минутад орох зурагаар хэмжигддэг (энэ байгууллагад 5).

---

## 6. Шинэ бараа нэмэх үеийн урсгал

Багц скрипт нь **байгаа** каталогт зориулагдсан. Шинэ бараа нэмэхэд ижил хоёр
зураг **автоматаар** үүснэ — `src/lib/ai/new-product-pipeline.ts`.

```
админы оруулсан лавлах зураг (products.reference_image_url)
      │
      ├─ 1-р шат: PACKSHOT_PROMPT ─────────► үндсэн зураг  (sort_order 0)
      │                                            │
      └─ 2-р шат: нотын prompt, лавлах нь ◄────────┘
                  1-р шатны үр дүн ───────────────► нотын зураг (sort_order 1)
```

**2-р шат яагаад админы оруулсан зургийг биш, үүссэн packshot-ыг лавлах болгодог
вэ:** тэр үед сав аль хэдийн дэлгүүрийн стандарт дэвсгэр, стандарт хэмжээнд
тавигдсан байдаг. Ингэснээр нотын зураг тэр хүрээг өвлөнө — утасны зурагнаас
дахин гаргаж авахгүй. Багц скрипт ч яг үүнтэй ижил: тэнд лавлах нь бүтээгдэхүүн
бүрийн одоогийн үндсэн зураг.

Дэлгэрэнгүй:

- Зөвхөн **лавлах зураг оруулж, AI-г идэвхжүүлсэн үед** ажиллана (`aiMode`).
- Хоёр шат тус бүр `product_image_generations`-д мөр үүсгэнэ, тиймээс админы
  хүснэгтийн статус poll хэвээр ажиллана, алдаа шалтгаанаа хадгална.
- Хоёулаа `is_visible = true` — багц скриптээс ялгаатай нь энэ бол барааны
  **анхны** зураг, харуулах өөр зүйл байхгүй.
- 1-р шат унавал 2-р шат ажиллахгүй (лавлах зураг байхгүй).
- Ноот нь бүгд хийсвэр аккорд бол (musk, amber, woody notes) 2-р шат **чимээгүй
  алгасна** — packshot дангаараа хүрэлцэнэ, алдаа биш.
- Хэмжээ `1024x1024`, quality `high` — хоёр prompt хоёулаа дөрвөлжин хүрээнд
  бичигдсэн.
- `after()` дотор ажиллана: админ хариугаа шууд авч, хүснэгт рүү буцна.

---

## 7. Дэлгүүрт хаана харагдах вэ

- **Каталогийн карт** — өөрчлөгдөхгүй, `sort_order 0` packshot хэвээр.
- **Барааны хуудас** — зураг 2 болмогц `ProductGallery` карусель болж, 4 секунд
  тутам эргэнэ; доор цэг, дэсктоп дээр thumbnail мөр; дарвал lightbox.
- `is_visible = true` тул storefront-ын шүүлтүүрээр дамжина.
