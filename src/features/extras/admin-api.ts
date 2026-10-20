import "server-only";
import { createClient } from "@/lib/supabase/server";
import { callRpc } from "@/lib/supabase/rpc";
import type {
  ExtraCategoryModeRow,
  ExtraCategoryRow,
  ExtraProductRow,
  ExtraVariantRow,
  LeftoverLiquidLockRow,
  VialRow,
} from "@/db/types";
import type {
  AdminExtra,
  AdminExtraVariant,
  ExtraCategory,
  ExtraMode,
  ExtraReadinessCode,
  VialOption,
} from "./types";

/**
 * Админы нэмэлт барааны уншилт (extras-shop-plan §7). Сессийн client —
 * хүснэгтүүд staff-only RLS-тэй (0145), тиймээс ажилтан биш бол хоосон.
 * Бичилт бүр `/api/admin/extras/*` → SQL RPC.
 */

type ServerClient = NonNullable<Awaited<ReturnType<typeof createClient>>>;

/** Горимын дараалал — tile, сонголтод ижил. */
const MODE_ORDER: ExtraMode[] = [
  "local_quantity",
  "shared_vial",
  "leftover_liquid",
];

export function toCategory(
  r: ExtraCategoryRow & {
    extra_category_modes?: ExtraCategoryModeRow[] | null;
  },
): ExtraCategory {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    modes: (r.extra_category_modes ?? [])
      .map((m) => ({
        mode: m.inventory_mode,
        notice: m.notice,
        requiresConsent: m.requires_consent,
      }))
      .sort((a, b) => MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode)),
    imageUrl: r.image_url,
    sort: r.sort,
  };
}

export function toVialOption(r: VialRow): VialOption {
  return {
    id: r.id,
    style: r.style,
    ml: r.ml,
    onHand: r.on_hand,
    reserved: r.reserved,
    available: !r.is_active
      ? 0
      : r.on_hand == null
        ? null
        : Math.max(r.on_hand - r.reserved, 0),
    lowThreshold: r.low_threshold,
    isActive: r.is_active,
    note: r.note,
    updatedAt: r.updated_at,
  };
}

export async function getExtraCategories(): Promise<ExtraCategory[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("extra_categories")
    .select("*, extra_category_modes(*)")
    .eq("is_active", true)
    .order("sort");
  return (
    (data as
      | (ExtraCategoryRow & { extra_category_modes: ExtraCategoryModeRow[] })[]
      | null) ?? []
  ).map(toCategory);
}

export async function getVialOptions(): Promise<VialOption[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("vials")
    .select("*")
    .order("ml")
    .order("style");
  return ((data as VialRow[] | null) ?? []).map(toVialOption);
}

function toVariant(
  r: ExtraVariantRow,
  vials: Map<string, VialOption>,
): AdminExtraVariant {
  if (r.inventory_mode === "shared_vial" && r.vial_id) {
    const v = vials.get(r.vial_id);
    return {
      id: r.id,
      label: r.label,
      price: r.price,
      onHand: v?.onHand ?? null,
      reserved: v?.reserved ?? 0,
      available: v ? v.available : 0,
      vialId: r.vial_id,
      isActive: r.is_active,
      sort: r.sort,
      updatedAt: r.updated_at,
    };
  }
  return {
    id: r.id,
    label: r.label,
    price: r.price,
    onHand: r.on_hand_qty,
    reserved: r.reserved_qty,
    available: Math.max(r.on_hand_qty - r.reserved_qty, 0),
    vialId: null,
    isActive: r.is_active,
    sort: r.sort,
    updatedAt: r.updated_at,
  };
}

async function loadExtras(
  supabase: ServerClient,
  filter: { id?: string },
): Promise<AdminExtra[]> {
  let q = supabase
    .from("extra_products")
    .select("*")
    .order("sort")
    .order("created_at", { ascending: false });
  if (filter.id) q = q.eq("id", filter.id);
  const { data } = await q;
  const products = (data as ExtraProductRow[] | null) ?? [];
  if (products.length === 0) return [];

  const ids = products.map((p) => p.id);
  const leftoverProductIds = [
    ...new Set(
      products.map((p) => p.product_id).filter((v): v is string => !!v),
    ),
  ];
  const [cats, variantRes, vialRes, lockRes, perfumeRes, readinessRes] =
    await Promise.all([
      supabase.from("extra_categories").select("*"),
      supabase
        .from("extra_variants")
        .select("*")
        .in("extra_id", ids)
        .order("sort")
        .order("label"),
      supabase.from("vials").select("*"),
      supabase
        .from("leftover_liquid_locks")
        .select("*")
        .in("extra_product_id", ids),
      leftoverProductIds.length
        ? supabase
            .from("products")
            .select(
              "id, name, brand, inventory(available_ml), product_images(url, sort_order, is_visible)",
            )
            .in("id", leftoverProductIds)
        : Promise.resolve({ data: [] }),
      // Нийтлэх бэлэн эсэх нь SQL-ийн нэг дүрэм — UI дахин таахгүй.
      callRpc<{ extra_id: string; missing: ExtraReadinessCode[] }[]>(
        supabase,
        "extras_readiness_all",
        {},
      ),
    ]);

  const catById = new Map(
    ((cats.data as ExtraCategoryRow[] | null) ?? []).map((c) => [c.id, c]),
  );
  const vials = new Map(
    ((vialRes.data as VialRow[] | null) ?? []).map((v) => [
      v.id,
      toVialOption(v),
    ]),
  );
  const locks = new Map(
    ((lockRes.data as LeftoverLiquidLockRow[] | null) ?? []).map((l) => [
      l.extra_product_id,
      l,
    ]),
  );
  const perfumes = new Map(
    (
      (perfumeRes.data as
        | {
            id: string;
            name: string;
            brand: string;
            inventory: { available_ml: number | null } | null;
            product_images:
              | { url: string; sort_order: number; is_visible: boolean }[]
              | null;
          }[]
        | null) ?? []
    ).map((p) => [p.id, p]),
  );
  const readiness = new Map(
    (readinessRes.data ?? []).map((r) => [r.extra_id, r.missing ?? []]),
  );
  const variantsByExtra = new Map<string, ExtraVariantRow[]>();
  for (const v of (variantRes.data as ExtraVariantRow[] | null) ?? []) {
    variantsByExtra.set(v.extra_id, [
      ...(variantsByExtra.get(v.extra_id) ?? []),
      v,
    ]);
  }

  return products.map((p): AdminExtra => {
    const cat = catById.get(p.category_id);
    const variants = (variantsByExtra.get(p.id) ?? []).map((v) =>
      toVariant(v, vials),
    );
    const active = variants.filter((v) => v.isActive);
    const perfume = p.product_id ? perfumes.get(p.product_id) : undefined;
    const lock = locks.get(p.id);
    const image =
      perfume?.product_images
        ?.filter((i) => i.is_visible)
        .sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null;
    return {
      id: p.id,
      categoryId: p.category_id,
      categoryName: cat?.name ?? "",
      categorySlug: cat?.slug ?? "",
      mode: p.inventory_mode,
      slug: p.slug,
      name: p.name,
      description: p.description,
      images: p.images,
      status: p.status,
      capacity: typeof p.attrs?.capacity === "number" ? p.attrs.capacity : null,
      sort: p.sort,
      variants,
      leftover:
        p.inventory_mode === "leftover_liquid" && p.product_id
          ? {
              productId: p.product_id,
              productName: perfume?.name ?? "",
              productBrand: perfume?.brand ?? "",
              productImage: image,
              productAvailableMl: perfume?.inventory?.available_ml ?? 0,
              remainingMl: p.remaining_ml ?? 0,
              fullMl: p.full_ml ?? 0,
              lockState: lock?.state ?? null,
              lockedMl: lock?.locked_ml ?? null,
            }
          : null,
      fromPrice: active.length ? Math.min(...active.map((v) => v.price)) : null,
      readiness: readiness.get(p.id) ?? [],
      updatedAt: p.updated_at,
    };
  });
}

export async function getAdminExtras(): Promise<AdminExtra[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  return loadExtras(supabase, {});
}

export async function getAdminExtra(id: string): Promise<AdminExtra | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const [row] = await loadExtras(supabase, { id });
  return row ?? null;
}
