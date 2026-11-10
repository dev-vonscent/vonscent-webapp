import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { CACHE_TAG_FEATURE_FLAGS } from "@/lib/cache-tags";
import type { FeatureFlag } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFeatureFlag } from "@/lib/validators/feature-flag";

/**
 * Feature flag-ийн сервер тал (0133). Туг нь САНД байх тул dev ба prod тус
 * тусдаа утгатай: клиент dev дээр туршиж байхад prod унтраалттай хэвээр.
 *
 * Шалгах газар (гурвуулаа заавал):
 *   - Хуудас:  `if (!(await isFeatureEnabled("x"))) notFound();`
 *   - Route:   `if (!(await isFeatureEnabled("x"))) return 404`
 *   - SQL:     `feature_enabled('x')` — trigger, RPC, pg_cron
 * Client component нь `useFeatureFlag("x")` (`components/feature-flags.tsx`).
 *
 * Fail closed: сан уншигдахгүй бол бүх туг УНТРААЛТТАЙ гэж үзнэ.
 */

/**
 * Асаалттай түлхүүрүүд. Алдааг ДОТОР нь барихгүй — `unstable_cache` нь
 * шидэгдсэн алдааг кэшлэдэггүй тул түр зуурын алдаа «бүгд унтраалттай»
 * гэсэн хариуг кэшэнд гацаахгүй.
 *
 * service-role: `feature_flags` нь staff-only RLS-тэй (нээгдээгүй feature-ийн
 * нэр anon-д ил гарахгүй). Cookie уншдаггүй тул хуудас ISR хэвээр.
 */
const fetchEnabledKeys = unstable_cache(
  async (): Promise<{ key: string; since: string }[]> => {
    const supabase = createAdminClient();
    if (!supabase) return [];
    const { data, error } = await supabase
      .from("feature_flags")
      .select("key, updated_at")
      .eq("enabled", true);
    if (error) throw new Error(`feature_flags: ${error.message}`);
    return ((data as { key: string; updated_at: string }[] | null) ?? []).map(
      (r) => ({ key: r.key, since: r.updated_at }),
    );
  },
  // v2: утга `{ key, since }` болсон — хуучин кэш (string[]) уншигдахгүй.
  ["feature-flags-enabled-v2"],
  // `revalidate` ЗОРИУД өгөөгүй: root layout уншдаг тул энд өгсөн хугацаа
  // бүх хуудсын ISR-ийг (login, account, 404 …) тэр хэмжээнд буулгана.
  // Шинэчлэлт нь зөвхөн tag-аар — админы унтраалга `revalidateFeatureFlags()`
  // дууддаг. SQL-ээр шууд солибол админаас нэг удаа дахин хадгал.
  { tags: [CACHE_TAG_FEATURE_FLAGS] },
);

/** Асаалттай, кодонд бүртгэлтэй тугууд. */
export async function getEnabledFeatureFlags(): Promise<FeatureFlag[]> {
  return (await enabledRows()).map((r) => r.key);
}

/**
 * Асаалттай туг бүрийг хэзээ асаасан — `updated_at` (туг солих бүрт
 * шинэчлэгдэнэ, асаалттай үед = сүүлд асаасан цаг). «Шинэ» тэмдгийг
 * нээлтээс N хоног харуулахад (`NavNewBadge`).
 */
export async function getEnabledFeatureFlagSince(): Promise<
  Partial<Record<FeatureFlag, string>>
> {
  return Object.fromEntries((await enabledRows()).map((r) => [r.key, r.since]));
}

async function enabledRows(): Promise<{ key: FeatureFlag; since: string }[]> {
  try {
    return (await fetchEnabledKeys()).filter(
      (r): r is { key: FeatureFlag; since: string } => isFeatureFlag(r.key),
    );
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
}

export async function isFeatureEnabled(key: FeatureFlag): Promise<boolean> {
  return (await getEnabledFeatureFlags()).includes(key);
}

/** Туг солисны дараа — тугийн кэш ба түүнийг уншсан ISR хуудсууд. */
export function revalidateFeatureFlags() {
  revalidateTag(CACHE_TAG_FEATURE_FLAGS, "max");
}
