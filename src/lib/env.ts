/**
 * Typed environment access. Anything read here is optional at build time so the
 * app can boot (and the demo can run on seed data) before live services are
 * wired up. Server-only secrets must never be prefixed with NEXT_PUBLIC_.
 */

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",

  /** Supabase Storage bucket for product/blog images (public bucket). */
  storageBucket:
    process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ?? "product-images",

  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
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
} as const;

/** True when Supabase env is present — otherwise the app falls back to seed data. */
export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey,
);

/** True when an OpenAI key is set — otherwise AI image generation is disabled. */
export const isImageGenConfigured = Boolean(env.openaiKey);

/** Storage lives in Supabase, so it's ready whenever Supabase is configured. */
export const isStorageConfigured = isSupabaseConfigured;
