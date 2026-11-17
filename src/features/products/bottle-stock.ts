import "server-only";
import { unstable_cache } from "next/cache";
import { CACHE_TAG_CATALOG } from "@/lib/cache-tags";
import { isSupabaseConfigured } from "@/lib/env";
import { createPublicClient } from "@/lib/supabase/public";
import type { Gender } from "@/db/types";

/**
 * Хоосон савны түгжээ (0095_bottle_stock.sql).
 *
 * Декант цутгах сав нь ml бүрт гурван өнгөтэй бөгөөд өнгө нь барааны хүйсээр
 * хуваарилагддаг. Нэг өнгө-хэмжээний сав дуусахад админ `bottle_stock`-оос
 * тэр хослолыг унтраадаг ба тэр хослолтой БҮХ бараа тэр хэмжээгээрээ
 * зарагдахаа болино.
 *
 * Энэ модуль нь SQL-ийн `bottle_active()`-ийн TS тал: `mapProduct()` нь
 * `catalog_items` VIEW-ийн толь тул хоёулаа ижил дүрэмтэй байх ёстой.
 */

/** «хүйс:хэмжээ» — Map/Set-ийн түлхүүр. */
export type BottleKey = `${Gender}:${number}`;

export interface BottleLockState {
  /** Хаагдсан «хүйс:хэмжээ» хослолууд. */
  locked: ReadonlySet<BottleKey>;
  /**
   * Түгжээнээс чөлөөлсөн `product_variants.id`-ууд: өөр өнгийн саванд
   * цутгахыг админ зөвшөөрсөн ганц бараа/хэмжээ.
   */
  exempt: ReadonlySet<string>;
}

export function bottleKey(gender: Gender, ml: number): BottleKey {
  return `${gender}:${ml}`;
}

/** Түгжээгүй орчин (demo, seed, тест). */
export const NO_BOTTLE_LOCKS: BottleLockState = {
  locked: new Set<BottleKey>(),
  exempt: new Set<string>(),
};

export function isBottleLocked(
  state: BottleLockState,
  gender: Gender,
  ml: number,
  /** Мэдэгдэж байвал чөлөөлөлтийг ч шалгана. */
  variantId?: string,
): boolean {
  if (variantId && state.exempt.has(variantId)) return false;
  return state.locked.has(bottleKey(gender, ml));
}

/**
 * ХААЛТТАЙ хослолууд ба чөлөөлсөн мөрүүд.
 *
 * Хоёулаа ТУСДАА хүсэлтээр явна (audit R2). Алдааг шиднэ — `unstable_cache`
 * шидэгдсэн алдааг кэшлэдэггүй.
 *
 * `unstable_cache` — хуудас бүрт дахин уншихгүй. Админ унтраалга дарахад
 * `revalidatePublic()` нь `CACHE_TAG_CATALOG`-ийг цэвэрлэж, дэлгүүр шууд
 * шинэчлэгдэнэ.
 */
const fetchLockState = unstable_cache(
  async (): Promise<{ locked: BottleKey[]; exempt: string[] }> => {
    const none = { locked: [], exempt: [] };
    if (!isSupabaseConfigured) return none;
    const supabase = createPublicClient();
    if (!supabase) return none;

    const [lockedRes, exemptRes] = await Promise.all([
      supabase.from("bottle_stock").select("gender, ml").eq("is_active", false),
      supabase
        .from("product_variants")
        .select("id")
        .eq("bottle_override", true),
    ]);

    // Шидэнэ: энэ кэш `revalidate`-гүй (зөвхөн tag) тул «түгжээгүй» гэсэн
    // хариу дараагийн админы өөрчлөлт хүртэл гацаж, хаалттай савыг зарна.
    const failed = lockedRes.error ?? exemptRes.error;
    if (failed) throw new Error(`bottle locks failed: ${failed.message}`);
    return {
      locked: ((lockedRes.data as { gender: Gender; ml: number }[] | null) ?? [])
        .map((r) => bottleKey(r.gender, r.ml)),
      exempt: ((exemptRes.data as { id: string }[] | null) ?? []).map(
        (r) => r.id,
      ),
    };
  },
  ["bottle-stock-locked"],
  { tags: [CACHE_TAG_CATALOG] },
);

export async function getBottleLocks(): Promise<BottleLockState> {
  const { locked, exempt } = await fetchLockState();
  return { locked: new Set(locked), exempt: new Set(exempt) };
}
