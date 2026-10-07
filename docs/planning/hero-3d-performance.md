# Hero 3D — гүйцэтгэлийн эрсдэл ба оновчлолын төлөвлөгөө

> 2026-10-07 · салбар `feat/hero-decant-visualizer` · prod руу оруулахаас өмнөх шинжилгээ.
> Холбогдох код: `src/features/marketing/components/{decant-playground,decant-vial-3d,vial-gltf,liquid-material}.tsx`

## Товч дүгнэлт

Эрсдэл **бий**, гэхдээ гол нь татах хэмжээ биш, **GPU ачаалал (ялангуяа утсан дээр)**.
Ачаалах дараалал аль хэдийн зөв хийгдсэн (SVG эхэлж → `dynamic` + idle үед 3D,
`frameloop="demand"`), тиймээс LCP/CLS-д бараг нөлөөгүй. Доорх засваруудыг хийвэл
харагдах чанарыг бууруулахгүйгээр утасны тасралтгүй GPU ачааллыг бараг тэглэж,
ачаалах хэмжээг ~2MB → ~0.4MB болгоно.

## Илэрсэн эрсдэлүүд (нөлөөллийн дарааллаар)

1. **Утсан дээр 3D зогсолтгүй 60fps рендерлэдэг.** `decant-vial-3d.tsx`-ийн `Lineup`-д
   touch төхөөрөмж дээр (`fine=false`) `sin()`-ээр найгадаг, frame бүрд `invalidate()`
   дууддаг. Ингэснээр `demand` горим утсан дээр ажиллахгүй, hero-гоос доош гүйлгэсэн ч
   рендер үргэлжилнэ → утас халах, батарей дуусах, scroll гацах.
2. **Frame бүрийн рендер pass их.** 4 шил × `MeshTransmissionMaterial` (`backside`,
   512px FBO) = frame бүрд үзэгдлийг **+8 удаа** зурна. Шингэний `transmission: 1` нь
   three.js-ийн transmission pass-ийг дахин нэмнэ. `dpr` 2 хүртэл.
3. **Эхний shader compile-ийн гацалт.** `MeshPhysicalMaterial` + transmission shader-үүд
   утсан дээр main thread-ийг 200мс–1с түгжиж болно → INP муудна.
4. **Файлын хэмжээ** (харьцангуй бага асуудал):

   | Файл | Одоо | Оновчилсны дараа |
   |---|---|---|
   | `public/models/vials.glb` | 637KB | **168KB** meshopt (gzip ~54KB), хэмжсэн |
   | `studio.hdr` / `studio_dark.hdr` | 0.7 / 0.87MB | gainmap `.jpg` ~100KB орчим |
   | three + r3f + drei JS | ~250KB gzip | lazy chunk — зөв хийгдсэн |

   `public/models/vial20.glb`, `shadow_*.png` — кодонд **ашиглагдаагүй**, deploy-д хэрэггүй.
   `/models/*`-д `Cache-Control: immutable` header алга.

## Хийх ажил

| # | Арга | Чанарт | Тайлбар / эх сурвалжийн баталгаа |
|---|---|---|---|
| 1 | Дэлгэцээс гарах / tab нуугдах үед рендер зогсоох (IntersectionObserver + `document.hidden` → `frameloop="never"`) | Нөлөөгүй | Тасралтгүй render loop нь утасны батарей иддэг гол шалтгаан; харагдахгүй канвасыг бүрэн зогсоох нь стандарт |
| 2 | Утасны найгалтыг хязгаарлах — хэдэн секунд тоглоод зогсох, эсвэл зөвхөн сонголтын үед | Нөлөөгүй | «$6 bug»: дуусдаггүй анимаци `demand`-ийг тасралтгүй рендер болгодог |
| 3 | GLB → `gltf-transform meshopt` | Нөлөөгүй | 2026 оны браузерын стандарт; Draco-оос 5–10× хурдан задална. `useGLTF` автоматаар задална |
| 4 | HDR → gainmap (UltraHDR) JPG | Нөлөөгүй | 10–30× жижиг. Сул тал (background болгоход ирмэг шүдлэх) манайд хамаарахгүй — дэвсгэр энгийн өнгө. drei дэмждэг |
| 5 | Shader урьдчилан бэлдэх — `compileAsync`, эсвэл бүх объектыг харагдуулж нэг `render()` хийгээд fade-in | Нөлөөгүй | `compileAsync` дангаараа хангалтгүй байж болно — гацалт texture/geometry upload-оос ч үүсдэг |
| 6 | `PerformanceMonitor` — FPS унавал DPR 2 → 1.5 | Хүчтэй төхөөрөмжид нөлөөгүй | MTM-ийн «GPU 100%, халдаг» асуудлыг DPR бууруулж шийдсэн; 1.5 нь тэнцвэртэй цэг |
| 7 | Save-Data / `deviceMemory ≤ 2` үед SVG fallback | — | reduced-motion, WebGL-гүй fallback аль хэдийн бий, нөхцөл нэмэхэд л болно |
| 8 | `next.config.ts`-д `/models/*` → `Cache-Control: public, max-age=31536000, immutable` (файлын нэрийг хувилбарлах) | Нөлөөгүй | Буцаж ирсэн хэрэглэгч дахин татахгүй |
| 9 | Ашиглагдаагүй `vial20.glb`, `shadow_*.png`-ийг `public/`-ээс хасах | Нөлөөгүй | — |

### Хийхгүй зүйлс (шалтгаантай)

- **Transmission buffer хуваалцах** (`transmissionSampler` / нийтлэг FBO) — `transmissionSampler`
  ашиглавал шил бусад тунгалаг объектыг харахгүй → **шилний цаана шингэн алга болно**.
  Нийтлэг FBO-ийг буцаан авсны дараа сайжирсан тохиолдол форум дээр бий.
- **MTM `resolution` / `samples` бууруулах** — шил `roughness: 0` (толь шиг) тул бүдгэрнэ.
  512 / 6 хэвээр.
- **WebGPURenderer** — drei-ийн shader засдаг компонентууд (`MeshTransmissionMaterial`)
  ажиллахгүй; жижиг scene дээр WebGL-ээс удаан тохиолдол бий.
- **OffscreenCanvas / `@react-three/offscreen`** — туршилтын шатанд; манай код DOM event
  (`trackRef`) ба theme-ийн `MutationObserver` ашигладаг тул worker руу шилжүүлэх төвөгтэй.
  1–5-ын дараа шаардлагагүй байх магадлалтай.

## Шалгах арга

Засварын өмнө/дараа Chrome DevTools → Performance (утасны эмуляц, CPU 4× slowdown):
idle үеийн GPU/CPU, scroll FPS, анх 3D гарах үеийн long task, Lighthouse-ийн TBT/INP.

## Эх сурвалж

- [MeshTransmissionMaterial — drei docs](https://drei.docs.pmnd.rs/shaders/mesh-transmission-material)
- [MeshTransmissionMaterial poor performances — three.js forum](https://discourse.threejs.org/t/meshtransmissionmaterial-poor-performances-urgent/68566)
- [Transmission effect pbr material performance — three.js forum](https://discourse.threejs.org/t/transmission-effect-pbr-material-performance/59274)
- [Scaling performance — React Three Fiber](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- [The $6 Bug (idle rendering)](https://campedersen.com/idle)
- [100 Three.js Tips That Actually Improve Performance (2026)](https://www.utsubo.com/blog/threejs-best-practices-100-tips)
- [Three.js in Production 2026: WebGPU, Perf & Fallback](https://appscale.blog/en/blog/threejs-production-3d-web-2026-webgpu-realtime-standards)
- [Migrate Three.js to WebGPU (2026)](https://www.utsubo.com/blog/webgpu-threejs-migration-guide)
- [Reduce first render lag — compileAsync — three.js forum](https://discourse.threejs.org/t/reduce-first-render-lag-renderer-compileasync-is-not-doing-anything/86191)
- [three.js PR #19752 (compileAsync)](https://github.com/mrdoob/three.js/pull/19752)
- [Draco vs meshopt](https://www.svilenkovic.com/3d/draco-vs-meshopt)
- [Optimize GLB for web](https://app.cinevva.com/guides/optimize-glb-for-web)
- [Can HDR be compressed? — three.js forum](https://discourse.threejs.org/t/can-hdr-be-compressed/62964)
- [FastHDR environment maps — Needle](https://cloud.needle.tools/articles/fasthdr-environment-maps)
- [react-three-offscreen](https://github.com/pmndrs/react-three-offscreen)
- [OffscreenCanvas + Web Workers — Evil Martians](https://evilmartians.com/chronicles/faster-webgl-three-js-3d-graphics-with-offscreencanvas-and-web-workers)
- [Core Web Vitals for animation-heavy sites](https://www.hontran.dev/blog/core-web-vitals-for-animation-heavy-sites)

## Poster (3D-ийн урьдчилсан рендер) — хийсэн, 2026-10-07

Хуучин хавтгай SVG-ийн оронд 3D-ийн **өөрийнх нь** screenshot (`public/hero/*.avif`,
`scripts/hero-posters.ts`) харагдана. 3 theme × 2 layout × 4 хэмжээ = 24 файл,
тус бүр 6–13KB. Theme × layout-ийг CSS (`background-image` + CSS хувьсагч) сонгодог
тул хэрэглэгч бүр **ганц л** зураг татна (шалгасан). Poster нь reduced-motion,
WebGL-гүй, Save-Data, `deviceMemory ≤ 2` үед байнгын хувилбар болно.

- `onReady` одоо GLB + HDR ачаалагдаж, `compileAsync` дуусч, 2 frame зурсны дараа
  л дуудагдана (`ReadySignal`) — poster → хоосон/түр загвар руу «үсрэх» алга.
- 3D гарч ирснээс 700мс-ийн дараа poster DOM-оос хасагдана (дахин татахгүй).
- **3D-ийн камер, материал, загвар, hero layout өөрчлөгдвөл poster-уудыг дахин гарга:**
  `pnpm dev` → `node --import tsx scripts/hero-posters.ts`.

### Үлдсэн ажил (poster хийх явцад илэрсэн)

Дээрх «Хийх ажил» хүснэгтээс **#5** (shader урьдчилан бэлдэх) ба **#7** (Save-Data /
`deviceMemory` fallback) хийгдсэн. (#1–3, #8, #9, P1, P2, P4, P8 — доорх «2-р шат»-д хийгдсэн.) Poster бодит
харагддаг болсон тул #1-ийг илүү хатуу хийж болно: утсан дээр 3D-г hero дэлгэцэнд
харагдах үед, эсвэл анхны хүрэлтийн дараа л ачаалах.

| # | Ажил | Яагаад |
|---|---|---|
| P1 | Кодоор хийсэн түр загварыг устгах: `decant-vial-3d.tsx`-ийн `GlassVial2`, `Atomizer`, `lathe` ба `GltfVial`-ийн Suspense fallback. Файлын толгойн «Загвар бүхэлдээ кодоор» гэсэн хуучирсан тайлбарыг засах | `ReadySignal` GLB-г хүлээдэг болсон тул fallback хэзээ ч харагдахгүй. 3D chunk багасна |
| P2 | Theme солиход хоосон канвас гарах эсэхийг шалгах. Хар ↔ цайвар theme солиход `Environment`-ийн HDR өөрчлөгдөж Suspense дахин идэвхжинэ. Энэ үед poster аль хэдийн DOM-оос хасагдсан байдаг | Шалгаагүй. Хэрэв хоосон харагдвал хоёр HDR-ийг `useEnvironment.preload`-оор урьдчилан ачаалах эсвэл өмнөх HDR-ийг шинэ нь бэлэн болтол хадгалах |
| P3 | Утсан дээр LCP хэмжих (Lighthouse, Moto G эмуляц) | Утсан дээр poster дээд хэсэгт байрладаг тул LCP элемент болж магадгүй. `background-image` тул урьдчилан ачаалагддаггүй. Server theme-ийг мэдэхгүй байна (next-themes localStorage). Шаардлагатай бол theme-ийг cookie-д хадгалж `<link rel="preload" fetchpriority="high">` гаргах |
| P4 | `/hero/*`, `/models/*`-д `Cache-Control: public, max-age=31536000, immutable` нэмэх | Хувилбаргүй файлын нэрэнд immutable тавьбал poster-уудыг дахин гаргасны дараа хуучин зураг үлдэнэ. Эхлээд script файлын нэрэнд hash нэмэх (`posterSrc`-ийг manifest-ээс уншуулах) |
| P5 | Fallback (3D-гүй) үед хэмжээ солиход хоосон анивчих эсэхийг шалгах | `background-image` солигдоход шинэ зураг ачаалагдтал хоосон харагдаж болно. Утсан дээр `pointerenter` нь click-ээс арай л өмнө ирдэг тул урьдчилан ачаалах хугацаа бага. Шийдэл: хуучин давхаргыг шинэ нь `decode()` хийгдтэл хадгалах |
| P6 | Жижиг утсан дээр (360 / 375px) poster ба 3D таарч байгааг шалгах | Poster зөвхөн 430px өргөнөөр авагдсан, бусад өргөнд `bg-cover` тайрдаг. 3D-ийн `fitToBox` харьцаандаа тааруулдаг тул ирмэг дээр бага зэрэг зөрж болно |
| P7 | E2E тест (`e2e/home.spec.ts`): `data-hero-3d` төлөв, reduced-motion үед poster харагдах, зөвхөн 1 poster татагдах | Theme × layout-ийн CSS дараалал (`in-[.black]:` ба `md:` хоёрын specificity) эвдэрвэл 2 зураг татагдах эсвэл буруу theme харагдана. Одоо зөвхөн гараар шалгасан |
| P8 | `package.json`-д `"hero:posters": "node --import tsx scripts/hero-posters.ts"` нэмэх, README-д тэмдэглэх | 3D өөрчлөгдсөний дараа poster дахин гаргахаа мартвал poster ба 3D зөрж «үсэрнэ». Тушаал олоход хялбар байх ёстой |

## Хэрэгжүүлэлт ба баталгаажуулалт — 2026-10-07 (2-р шат)

Ажил бүрийг хэрэгжүүлэхээс өмнө вэб (албан ёсны docs) болон **суулгасан
сангийн эх код** (`node_modules/@react-three/{fiber,drei}`)-оор шалгав.

### Хийсэн

| # | Юу хийсэн | Баталгаа |
|---|---|---|
| 1 | `useOnScreen` (IntersectionObserver, hero = `trackRef`) → харагдахгүй үед `frameloop="never"`; буцаж харагдахад `ResumeOnShow` нэг frame хүснэ. `document.hidden`-ийг нэмээгүй — нуугдсан tab-д браузер rAF-ыг өөрөө зогсоодог | r3f эх код: `invalidate()` нь `frameloop === 'never'` үед шууд буцна → утасны найгалт ч, шингэний цалгилт ч frame хүсэхгүй |
| 2 | Утасны найгалт ачаалах ба хэмжээ/theme солих бүрд 6с тоглоод 2с-д намжиж зогсоно (`swayAmount`) | Дуусдаггүй анимаци `demand`-ийг тасралтгүй рендер болгодог |
| 3 | `vials.glb` 637KB → **188KB** (gzip ~64KB), `gltf-transform meshopt --level medium`. Дахин гаргах: `pnpm hero:glb` | drei `useGLTF` meshopt decoder-ийг өгөгдмөлөөр асаадаг (эх код). Рендерийг 6 poster-той харьцуулахад пикселийн дундаж зөрүү 0.1–0.7/255 |
| 8, P4 | `next.config.ts` → `/hero/*`, `/models/*`: `public, max-age=31536000, immutable`. URL бүр агуулгын hash-тай (`heroAsset()` → `?v=`, `hero-assets.json`). Файл солигдоод manifest шинэчлэгдээгүй бол `hero-assets.test.ts` унана | Next docs: hash-гүй `public/` файлд `headers()`-ээр Cache-Control өгч болно. Dev server дээр header ирж байгааг шалгасан |
| 9 | `vial20.glb`, `shadow_*.png` + шахаагүй `vials.glb`-ийг `Claude outputs/unused-models/` руу зөөв (устгаагүй — Blender script-ээр дахин гардаг) | `src/`-д ашиглагдаагүй (grep) |
| P1 | `GlassVial2`, `Atomizer`, `FilledTube`, `lathe` г.м. түр загвар ба дотоод Suspense fallback-ийг хасав; файлын толгойн тайлбарыг засав | GLB-г `ReadySignal` гаднах Suspense-д хүлээдэг тул fallback хэзээ ч харагддаггүй байв |
| P2 | `StudioEnvironment`: шинэ HDR ачаалагдтал өмнөх HDR-ийг Suspense fallback болгон харуулна. Анхны ачаалалтад fallback өөрөө suspend → гаднах Suspense (ReadySignal) хүлээнэ | React: аль хэдийн харагдсан агуулга дахин suspend болбол нуугддаг. Playwright: цайвар → хар солиод 30/150/600мс-д канвас хоосон биш |
| P8 | `pnpm hero:posters`, `pnpm hero:assets`, `pnpm hero:glb` | — |

**meshopt-ийн анхаарах зүйл:** quantization нь mesh бүрийн node-д translation/scale
нэмдэг. Тиймээс `vial-gltf.tsx` нь (а) шингэний `fill`-ийг mesh-ийн local руу хөрвүүлнэ,
(б) шилний node transform-ыг хуулна, (в) тагийн анхны Y-ийг `userData.baseY`-д
хадгална. `--level high` (168KB) нь нормалийг ~8 бит болгодог — толь шиг металлын
тусгалд анзаарагдаж болзошгүй тул `medium` (10 бит) сонгов. Шахсан файлыг **дахин
бүү шах** (vials.py-ийн толгойд тэмдэглэсэн).

### Хийгээгүй (шалтгаантай)

- **#4 HDR → gainmap JPG.** drei дэмждэг (`HDRJPGLoader`), гэхдээ `useEnvironment.preload`
  gainmap-д ажилладаггүй, encode хийх хэрэгсэл pipeline-д нэмэгдэнэ, металлын
  тусгалын чанарыг харьцуулж баталгаажуулаагүй. Буцаж ирсэн хэрэглэгч immutable
  кэшийн (#8) ачаар HDR-ийг дахин татахгүй болсон. Дараа нь тусад нь туршина.
- **#6 `PerformanceMonitor`.** drei эх код: FPS-ийг зөвхөн `useFrame` дотор хэмждэг —
  `demand` горимд хөдөлгөөнгүй хугацааны завсар «бага FPS» гэж тооцогдож хүчтэй
  төхөөрөмж дээр ч DPR-ийг дэмий бууруулна. Манай тохиргоонд буруу дохио өгнө.
- **P3** (утсан дээр LCP хэмжих), **P5** (fallback үед хэмжээ солиход анивчих),
  **P6** (360/375px дээр poster↔3D таарах) — хэмжилт/гар шалгалт, кодоор шийдэх
  зүйл тодорхой болоогүй.
- **P7** E2E тест — хэрэгтэй хэвээр, Playwright орчинд ажиллуулж шалгах шаардлагатай.
