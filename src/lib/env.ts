/**
 * Typed environment access. Anything read here is optional at build time so the
 * app can boot (and the demo can run on seed data) before live services are
 * wired up. Server-only secrets must never be prefixed with NEXT_PUBLIC_.
 */

/**
 * Нийтийн үндсэн хаяг — имэйл, Telegram-ийн админ линк, QPay callback, sitemap.
 *
 * `NEXT_PUBLIC_*` нь build хийх мөчид кодонд шингэдэг. Тухайн Vercel scope-д
 * (Preview г.м.) тавиагүй байхад урьд нь чимээгүй `localhost` руу унаж,
 * Telegram-ийн линк `http://localhost:3000/admin/...` болж очдог байв.
 * Одоо Vercel дээр deploy-ийн өөрийн хаяг руу унана; `localhost` зөвхөн
 * локал ажилд. Төгсгөлийн `/`-ийг хасна — эс бөгөөс `//admin/...` болно.
 */
function resolveSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  /** Supabase Storage bucket for product/blog images (public bucket). */
  storageBucket:
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "product-images",

  siteUrl: resolveSiteUrl(),
  gaId: process.env.NEXT_PUBLIC_GA_ID ?? "",
  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "",

  /** OpenAI (gpt-image-2) — server-only, AI product-image generation. */
  openaiKey: process.env.OPENAI_API_KEY ?? "",

  /**
   * Salt for the rate-limit subject hash (src/lib/rate-limit.ts). Optional —
   * without it the hash is still one-way, the salt only stops an attacker who
   * reads the table from confirming a guessed IP. Reuses the passcode pepper
   * when no dedicated salt is set so a deploy is never silently unsalted.
   */
  rateLimitSalt:
    process.env.RATE_LIMIT_SALT ?? process.env.AUTH_PASSCODE_PEPPER ?? "",

  /**
   * Vercel Cron-ийн нууц. `/api/cron/*` бүр үүнийг шалгана — cron route нь
   * бүх төлөгдөөгүй захиалгыг QPay-ээс асуудаг тул нээлттэй байж болохгүй.
   * Тавигдаагүй бол route нь өөрийгөө бүрэн хаана (503), эс тэгвээс нэг
   * мартсан env нь эцэсгүй нээлттэй endpoint болно.
   */
  cronSecret: process.env.CRON_SECRET ?? "",

  /**
   * QPay-ийн callback замд шигтгэх нууц сегмент.
   *
   * QPay callback-даа **гарын үсэг өгдөггүй** (албан ёсны V2 баримт: ямар ч
   * HMAC/signature/IP allowlist байхгүй; онбординг захидал нь «callback-аар
   * хүлээн авсны дараа шалгаж баталгаажуулна уу» гэж заадаг). Тиймээс
   * дуудагчийг таних цорын ганц арга бол хуваалцсан нууц.
   *
   * Тавигдаагүй үед хуучин нууцгүй зам ажилласаар байна — эс тэгвээс нэг
   * мартсан env нь бүх төлбөрийн callback-ыг унагаана.
   */
  qpayCallbackSecret: process.env.QPAY_CALLBACK_SECRET ?? "",

  /**
   * tawk.to чат — embed хаягийн `embed.tawk.to/<property>/<widget>` хоёр
   * хэсэг. Тавигдаагүй бол чатын «Админтай холбогдох» товч Messenger руу
   * шилжүүлнэ (`ChatPanel`).
   */
  tawkPropertyId: process.env.NEXT_PUBLIC_TAWK_PROPERTY_ID ?? "",
  tawkWidgetId: process.env.NEXT_PUBLIC_TAWK_WIDGET_ID ?? "",

  /**
   * tawk.to-ийн API key (Admin → Property Settings) — server-only.
   * Нэвтэрсэн хэрэглэгчийн `userId`-г HMAC-аар гарын үсэглэж
   * (`/api/chat/tawk-identity`), өөр хүний нэрээр чатлахаас сэргийлнэ.
   * Тавигдаагүй бол хэрэглэгч бүр tawk-д зочноор орно.
   */
  tawkApiKey: process.env.TAWK_API_KEY ?? "",
} as const;

/** True when Supabase env is present — otherwise the app falls back to seed data. */
export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey,
);

/** True when an OpenAI key is set — otherwise AI image generation is disabled. */
export const isImageGenConfigured = Boolean(env.openaiKey);

/** True when the tawk.to widget is wired — otherwise chat falls back to Messenger. */
export const isTawkConfigured = Boolean(env.tawkPropertyId && env.tawkWidgetId);

/** Storage lives in Supabase, so it's ready whenever Supabase is configured. */
export const isStorageConfigured = isSupabaseConfigured;
