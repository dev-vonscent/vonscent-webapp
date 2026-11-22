/**
 * Имэйлд манай сайтаас ачаалагддаг зураг (бэлгийн картын зураг, QR)-ийн хаяг.
 *
 * Preview/dev (`dev.vonscent.mn`) нь Vercel Deployment Protection-оор
 * хамгаалагдсан тул Gmail-ийн зураг татагч SSO руу 302 авч зураг эвдэрдэг.
 * Vercel → Deployment Protection → «Protection Bypass for Automation» асаалттай
 * бол `VERCEL_AUTOMATION_BYPASS_SECRET` автоматаар тавигддаг — түүнийг query-д
 * залгаж хамгаалалтыг давна. Production-д хамгаалалт байхгүй тул хэзээ ч залгахгүй
 * (secret prod-ын имэйлд хэзээ ч гарахгүй).
 */
export function emailAssetUrl(
  siteUrl: string,
  path: string,
  envVars: Record<string, string | undefined> = process.env,
): string {
  const url = `${siteUrl.replace(/\/+$/u, "")}/${path.replace(/^\/+/u, "")}`;
  const secret = envVars.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (!secret || envVars.VERCEL_ENV === "production") return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}x-vercel-protection-bypass=${encodeURIComponent(secret)}`;
}
