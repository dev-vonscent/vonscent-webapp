import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { StockScope } from "@/lib/cache";
import { isFeatureEnabled } from "@/lib/feature-flags";

type SlugRef = { slug: string | null } | { slug: string | null }[] | null;

function slugOf(ref: SlugRef): string | null {
  const row = Array.isArray(ref) ? ref[0] : ref;
  return row?.slug ?? null;
}

interface ItemRow {
  product_id: string | null;
  products: SlugRef;
  collections: SlugRef;
  /** Нэмэлт барааны мөр (0146) — `extra_products.id`. */
  extra_product_id: string | null;
  /** Сав (0149/0152) — үнэртний decant ба `shared_vial` нэмэлт бараа. */
  vial_id: string | null;
  qty: number;
}

/**
 * Захиалгын үлдэгдэл өөрчилсөн хуудсууд — `revalidateStock(scope)`-д.
 *
 *  - барааны slug: мөр бүрийн бараа. Багцын мөрүүд гишүүн ус бүрээр
 *    хадгалагддаг (0029b) тул гишүүдийн slug ч энд орно;
 *  - багцын slug: захиалсан багц + тэдгээр усыг агуулсан бүх багц (багцын
 *    хуудас гишүүн усны үлдэгдлээр «дууссан» болдог);
 *  - нэмэлт барааны slug (`/extras/[slug]`) ба түүний холбоотой үнэртэн
 *    (үлдэгдэлтэй шил г.м. — үнэртний хуудасны «Энэ үнэрийн шил»).
 *    `/bottles`, `/accessories`, нүүр нь `stock` tag-аар хамрагдана.
 *
 * Савны нөөц (`vial_inventory` туг, 0152): асаалттай үед сав нь ТУХАЙН
 * хэмжээ × өнгөний БҮХ үнэртний зарагдах эсэхийг шийднэ (`variant_sellable`).
 * Энэ захиалгын хөндсөн сав хил дээр (үлдэгдэл ≤ энэ захиалгын тоо — дуусах
 * эсвэл буцаж нээгдэх) байвал slug-аар нарийсгах нь хангалтгүй → `undefined`
 * (өргөн хүрээ). Туг хаалттай бол савыг асуухгүй.
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
      .select(
        "product_id, products(slug), collections(slug), extra_product_id, vial_id, qty",
      )
      .eq("order_id", orderId);
    if (error || !items) return undefined;

    const rows = items as unknown as ItemRow[];
    const ids = (pick: (r: ItemRow) => string | null) => [
      ...new Set(rows.map(pick).filter((x): x is string => !!x)),
    ];
    const productIds = ids((r) => r.product_id);
    const extraIds = ids((r) => r.extra_product_id);
    const vialIds = ids((r) => r.vial_id);

    const productSlugs = new Set<string>();
    const collectionSlugs = new Set<string>();
    const extraSlugs = new Set<string>();
    for (const r of rows) {
      const p = slugOf(r.products);
      if (p) productSlugs.add(p);
      const c = slugOf(r.collections);
      if (c) collectionSlugs.add(c);
    }

    if (vialIds.length > 0 && (await isFeatureEnabled("vial_inventory"))) {
      const { data: vials, error: vErr } = await supabase
        .from("vials")
        .select("id, on_hand, reserved, is_active")
        .in("id", vialIds);
      if (vErr || !vials) return undefined;
      const used = new Map<string, number>();
      for (const r of rows) {
        if (r.vial_id) used.set(r.vial_id, (used.get(r.vial_id) ?? 0) + r.qty);
      }
      const atBoundary = (
        vials as {
          id: string;
          on_hand: number | null;
          reserved: number;
          is_active: boolean;
        }[]
      ).some(
        (v) =>
          v.is_active &&
          v.on_hand != null &&
          v.on_hand - v.reserved <= (used.get(v.id) ?? 0),
      );
      if (atBoundary) return undefined;
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

    if (extraIds.length > 0) {
      const { data: extras, error: eErr } = await supabase
        .from("extra_products")
        .select("slug, products(slug)")
        .in("id", extraIds);
      if (eErr || !extras) return undefined;
      for (const e of extras as unknown as {
        slug: string | null;
        products: SlugRef;
      }[]) {
        if (e.slug) extraSlugs.add(e.slug);
        const p = slugOf(e.products);
        if (p) productSlugs.add(p);
      }
    }

    return {
      productSlugs: [...productSlugs],
      collectionSlugs: [...collectionSlugs],
      extraSlugs: [...extraSlugs],
    };
  } catch {
    return undefined;
  }
}
