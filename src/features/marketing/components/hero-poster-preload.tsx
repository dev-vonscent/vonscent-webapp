import { POSTER_THEMES, posterUrl } from "@/features/marketing/vial-specs";
import type { MlSize } from "@/lib/constants";

/**
 * Hero poster-ийг HTML parse хийх үед preload хийнэ (P3).
 *
 * Poster нь CSS `background-image` тул браузерын preload scanner олдоггүй —
 * CSS ачаалагдаж, layout бодогдсоны дараа л, бас бага ач холбогдолтойгоор
 * татагдана. Theme нь next-themes-ийн localStorage-д байдаг тул сервер
 * мэдэхгүй: next-themes-ийн өөрийнх шиг жижиг inline script theme × өргөнийг
 * уншаад яг тэр НЭГ зургийг `fetchpriority=high`-аар preload хийнэ.
 * URL нь `VialPoster`-ийн CSS-тэй ижил (`posterUrl`) тул кэшээс авна.
 *
 * Сурталчилгааны popup хэрэглэгчийн анхны үйлдлийн дараа л нээгддэг тул
 * (promo-popup.tsx) poster нь нүүрний LCP элемент — 6–13KB тул өрсөлдөх
 * зүйл бараг үгүй.
 */
export function HeroPosterPreload({ ml }: { ml: MlSize }) {
  const urls: Record<string, string> = {};
  for (const t of POSTER_THEMES)
    for (const l of ["sm", "md"] as const)
      urls[`${t}-${l}`] = posterUrl(t, l, ml);

  // providers.tsx: storageKey "theme", default "black"; navy/white → light.
  const js = `(function(){try{var u=${JSON.stringify(urls)};var t=localStorage.getItem("theme")||"black";t=t==="black"||t==="pink"?t:"light";var l=matchMedia("(min-width: 48rem)").matches?"md":"sm";var k=document.createElement("link");k.rel="preload";k.as="image";k.href=u[t+"-"+l];k.setAttribute("fetchpriority","high");document.head.appendChild(k)}catch(e){}})()`;

  return <script dangerouslySetInnerHTML={{ __html: js }} />;
}
