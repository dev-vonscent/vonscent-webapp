import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Allow remote images from Supabase Storage (when configured) plus a couple of
 * hosts used by seed/placeholder data so the demo renders without live storage.
 */
const remotePatterns: NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
> = [
  { protocol: "https", hostname: "images.unsplash.com" },
  { protocol: "https", hostname: "picsum.photos" },
  // Hardcoded fallback for the production Supabase project so image loading
  // never depends on env availability at config-evaluation time.
  {
    protocol: "https",
    hostname: "khrjllvayvazqkraeotc.supabase.co",
    pathname: "/storage/v1/object/public/**",
  },
];

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
    // Supabase public objects: <project>.supabase.co/storage/v1/object/public/...
    remotePatterns.push({
      protocol: "https",
      hostname: url.hostname,
      pathname: "/storage/v1/object/public/**",
    });
  } catch {
    // ignore malformed NEXT_PUBLIC_SUPABASE_URL
  }
}

const nextConfig: NextConfig = {
  /**
   * `sharp` is a native module (process-image.ts, ai/generate-image.ts). Next
   * must leave it out of the server bundle and load it from node_modules at
   * runtime — otherwise the whole upload route crashes on import.
   */
  serverExternalPackages: ["sharp"],
  /**
   * Vercel ships only the files its tracer can follow, and the tracer misses
   * libvips' `.so` behind pnpm's symlinks — the linux binary reached the
   * lambda without its shared library and every upload answered a bodyless
   * 500 (`libvips-cpp.so: cannot open shared object file`). Both globs are
   * listed because pnpm keeps the real files under `.pnpm/` and only links
   * them into `@img/`; only the routes that actually touch sharp are listed,
   * since libvips is tens of megabytes per function.
   */
  outputFileTracingIncludes: Object.fromEntries(
    [
      "/api/upload",
      "/api/admin/upload",
      "/api/admin/products",
      "/api/admin/products/[id]/images",
      "/api/admin/products/[id]/generate-image",
      "/api/admin/products/[id]/regenerate-image",
    ].map((route) => [
      route,
      ["./node_modules/@img/**/*", "./node_modules/.pnpm/@img+*/**/*"],
    ]),
  ),
  images: {
    remotePatterns,
    /**
     * Vercel bills a transformation on every cache MISS/STALE, so the knobs
     * below all aim at fewer variants and longer-lived cache entries.
     */
    // Product images live at UUID paths and never change in place, so a
    // month-long TTL is safe. (Default is 4 hours — each image would be
    // re-transformed ~180×/month.)
    minimumCacheTTL: 2678400, // 31 days
    // Uploads are normalised to a 1600px master (process-image.ts), so the
    // default list's 1920/2048/3840 entries all produce the same 1600px
    // output under three different cache keys. 1320 covers the 652px
    // gallery slot at 2× DPR, 1600 is the source bound.
    deviceSizes: [640, 750, 828, 1080, 1320, 1600],
    // One format, one quality — each extra value multiplies transformations.
    formats: ["image/webp"],
    qualities: [75],
  },
};

// Source-map upload runs only when SENTRY_AUTH_TOKEN + org/project env are set
// (CI/Vercel); local builds skip it silently.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  telemetry: false,
});
