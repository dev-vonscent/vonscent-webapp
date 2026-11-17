import * as Sentry from "@sentry/nextjs";

/**
 * Browser Sentry init. No-op until NEXT_PUBLIC_SENTRY_DSN is set.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  tracesSampleRate: 0.1,
  // Гадны шуугиан. Тус бүр нарийн мессежтэй — манай код эдгээр нэр/API-г
  // огт хэрэглэдэггүйг шалгасан (grep src + node_modules + .next/static).
  // Шинэ мөр нэмэхдээ ч ерөнхий хэв ("TypeError", "undefined") бүү оруул.
  ignoreErrors: [
    // Android in-app browser (Facebook/Instagram/TikTok WebView)-ийн
    // JS↔Java bridge хаагдсаны дараа дуудагдана. Манай код postMessage-ийг
    // зөвхөн BroadcastChannel дээр хэрэглэдэг (энэ мессеж гардаггүй).
    // JAVASCRIPT-NEXTJS-4
    /Error invoking postMessage: Java object is gone/,
    // iOS WKWebView (in-app browser)-ийн inject хийсэн script native
    // handler хайна. Манай кодонд `window.webkit` огт байхгүй.
    // JAVASCRIPT-NEXTJS-B, -7, -9
    /window\.webkit\.messageHandlers/,
    // `M_ID` нь src, node_modules, build-ийн chunk-д огт байхгүй — browser /
    // WebView-ийн inject хийсэн script. JAVASCRIPT-NEXTJS-P, -N
    /reading 'M_ID'/,
    // ld+json уншдаг гадны script (Safari / in-app). Манайх `@context`-ийг
    // уншдаггүй; массивыг салгаснаар (json-ld.tsx) ихэнх нь арилах ёстой,
    // үлдсэн нь гадных. JAVASCRIPT-NEXTJS-H
    /evaluating 'r\["@context"\]\.toLowerCase'/,
    // supabase-js `AuthError`-ийн constructor `this.__isAuthError = true`
    // онооход объект өргөтгөх боломжгүй — `Error`-ийг дарж бичсэн орчин
    // (event: Council Bluffs дата төв, timezone `Etc/Unknown`, өмнө нь React
    // #418 hydration — DOM өөрчилдөг bot). Манай код юу ч freeze хийдэггүй.
    // JAVASCRIPT-NEXTJS-M
    /Cannot add property __isAuthError, object is not extensible/,
  ],
  // Browser extension-ий файлаас гарсан алдаа (stack-ийн эхний frame).
  denyUrls: [
    /^chrome-extension:\/\//,
    /^moz-extension:\/\//,
    /^safari-(web-)?extension:\/\//,
    // Facebook-ийн Android in-app browser (FB4A)-ийн inject хийдэг script.
    // Stack-ийн цорын ганц frame нь `app://browser_declutter`; мессеж
    // («Unexpected end of input») ерөнхий тул ignoreErrors биш энд.
    // JAVASCRIPT-NEXTJS-8
    /browser_declutter/,
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
