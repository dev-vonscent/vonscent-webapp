import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StockScope } from "@/lib/cache";

type SlugRef = { slug: string | null } | { slug: string | null }[] | null;

function slugOf(ref: SlugRef): string | null {
  const row = Array.isArray(ref) ? ref[0] : ref;
  return row?.slug ?? null;
}

/**
 * Захиалгын үлдэгдэл өөрчилсөн хуудсууд — `revalidateStock(scope)`-д.
 *
 *  - барааны slug: мөр бүрийн бараа. Багцын мөрүүд гишүүн ус бүрээр
 *    хадгалагддаг (0029b) тул гишүүдийн slug ч энд орно;
 *  - багцын slug: захиалсан багц + тэдгээр усыг агуулсан бүх багц (багцын
 *    хуудас гишүүн усны үлдэгдлээр «дууссан» болдог).
 *
 * Алдаа гарвал `undefined` — дуудагч нь өргөн хүрээ рүү (бүх барааны
 * хуудас) унана. Кэш цэвэрлэх алхам захиалгыг хэзээ ч унагахгүй.
 */
export async function stockScopeForOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<StockScope | undefined> {
  try {
    const { data: items, error } = await supabase
      .from("order_items")
      .select("product_id, products(slug), collections(slug)")
      .eq("order_id", orderId);
    if (error || !items) return undefined;

    const rows = items as unknown as {
      product_id: string | null;
      products: SlugRef;
      collections: SlugRef;
    }[];
    const productIds = [
      ...new Set(rows.map((r) => r.product_id).filter((x): x is string => !!x)),
    ];
    const productSlugs = new Set<string>();
    const collectionSlugs = new Set<string>();
    for (const r of rows) {
      const p = slugOf(r.products);
      if (p) productSlugs.add(p);
      const c = slugOf(r.collections);
      if (c) collectionSlugs.add(c);
    }

    if (productIds.length > 0) {
      const { data: members, error: mErr } = await supabase
        .from("collection_items")
        .select("collections(slug)")
        .in("product_id", productIds);
      if (mErr || !members) return undefined;
      for (const m of members as unknown as { collections: SlugRef }[]) {
        const c = slugOf(m.collections);
        if (c) collectionSlugs.add(c);
      }
    }

    return {
      productSlugs: [...productSlugs],
      collectionSlugs: [...collectionSlugs],
    };
  } catch {
    return undefined;
  }
}
