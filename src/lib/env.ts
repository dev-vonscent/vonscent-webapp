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

  /** OpenAI (gpt-image-1) — server-only, AI product-image generation. */
  openaiKey: process.env.OPENAI_API_KEY ?? "",
} as const;

/** True when Supabase env is present — otherwise the app falls back to seed data. */
export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey,
);

/** True when an OpenAI key is set — otherwise AI image generation is disabled. */
export const isImageGenConfigured = Boolean(env.openaiKey);

/** Storage lives in Supabase, so it's ready whenever Supabase is configured. */
export const isStorageConfigured = isSupabaseConfigured;
