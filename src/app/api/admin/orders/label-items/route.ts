import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/env";
import { getStaffUser } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { LABEL_PRINT_MAX, SHIPPING_ZONES } from "@/lib/constants";
import { UB_NAME, zoneKey } from "@/lib/geo/zone";
import type { PerfumeLabelItem } from "@/features/admin/lib/order-label";

const schema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(LABEL_PRINT_MAX),
});

/** Бэлгийн боодлын ангилал (extras, `getGiftOffers`-тэй ижил). */
const GIFT_BOX_CATEGORY = "gift-box";

/**
 * Шошгонд (`label_print`) сонгосон захиалгуудын өгөгдөл:
 *  - `items` — усны шошгонд үнэртний мөрүүд, сав бүрт нэг шошго тул `qty`.
 *    Нэмэлт бараа, бэлгийн карт (ml-гүй), бэлгийн ус ба сарын 1ml бэлгийн
 *    sample орохгүй (клиент, 2026-11); багцын гишүүн орно.
 *  - `giftWrapOrderIds` — төлбөртэй бэлгийн боодол (gift-box ангиллын
 *    нэмэлт бараа) авсан захиалгууд, хаягийн шошгон дээр 🎁. Үнэгүй
 *    «Бэлгийн боолт хийлгэх» chip нь тэмдэглэлд тул клиент тал өөрөө уншина.
 *  - `remoteOrderIds` — орон нутгийн хүргэлт (checkout-ийн `isRemoteAddress`
 *    дүрэм: Улаанбаатараас гадуур, эсвэл `remote` бүс) — «Хаяг:»-ийн оронд
 *    «Орон нутаг:».
 */
export async function POST(req: Request) {
  if (!(await isFeatureEnabled("label_print"))) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION" }, { status: 400 });
  }

  if (!isSupabaseConfigured) {
    return NextResponse.json({
      items: [],
      giftWrapOrderIds: [],
      remoteOrderIds: [],
    });
  }

  const staff = await getStaffUser();
  if (!staff) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });

  const supabase = createAdminClient();
  if (!supabase) return NextResponse.json({ error: "NO_DB" }, { status: 500 });

  const { ids } = parsed.data;
  const [{ data, error }, giftWrap, remote] = await Promise.all([
    supabase
      .from("order_items")
      .select("order_id, brand, product_name, qty, ml, line_kind, line_no, id")
      .in("order_id", ids)
      .not("ml", "is", null)
      .eq("is_gift", false)
      .eq("is_sample", false)
      .order("line_no", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true }),
    giftWrapOrderIds(supabase, ids),
    remoteOrderIds(supabase, ids),
  ]);
  const failed = error ?? giftWrap.error ?? remote.error;
  if (failed) {
    return NextResponse.json({ error: failed.message }, { status: 500 });
  }
  const items: PerfumeLabelItem[] = (
    (data as
      | {
          order_id: string;
          brand: string;
          product_name: string;
          qty: number;
          ml: number;
          line_kind: string | null;
        }[]
      | null) ?? []
  )
    .filter((r) => r.line_kind !== "extra" && r.line_kind !== "gift_card")
    .map((r) => ({
      order_id: r.order_id,
      brand: r.brand,
      name: r.product_name,
      ml: r.ml,
      qty: r.qty,
    }));
  return NextResponse.json({
    items,
    giftWrapOrderIds: giftWrap.ids,
    remoteOrderIds: remote.ids,
  });
}

async function remoteOrderIds(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  orderIds: string[],
): Promise<{ ids: string[]; error: { message: string } | null }> {
  const [{ data: orders, error }, { data: setting }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, ship_city, ship_zone")
      .in("id", orderIds),
    supabase
      .from("settings")
      .select("value")
      .eq("key", "shipping")
      .maybeSingle(),
  ]);
  if (error) return { ids: [], error };
  // Тохиргоонд хадгалсан бүс (админ засдаг); байхгүй бол seed.
  const saved = (setting as { value?: { zones?: unknown } } | null)?.value
    ?.zones;
  const zones = Array.isArray(saved)
    ? (saved as { code?: string; name?: string; remote?: boolean }[]).map(
        (z) => ({
          code: String(z.code ?? z.name ?? ""),
          name: String(z.name ?? ""),
          remote: z.remote === true,
        }),
      )
    : SHIPPING_ZONES;
  const remoteKeys = new Set(zones.filter((z) => z.remote).map(zoneKey));
  return {
    ids: (
      (orders as
        | { id: string; ship_city: string; ship_zone: string | null }[]
        | null) ?? []
    )
      .filter(
        (o) =>
          (o.ship_city && o.ship_city !== UB_NAME) ||
          (o.ship_zone != null && remoteKeys.has(o.ship_zone)),
      )
      .map((o) => o.id),
    error: null,
  };
}

async function giftWrapOrderIds(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  orderIds: string[],
): Promise<{ ids: string[]; error: { message: string } | null }> {
  const { data: cat, error: catError } = await supabase
    .from("extra_categories")
    .select("id")
    .eq("slug", GIFT_BOX_CATEGORY)
    .maybeSingle();
  if (catError) return { ids: [], error: catError };
  if (!cat) return { ids: [], error: null };
  const { data: products, error: prodError } = await supabase
    .from("extra_products")
    .select("id")
    .eq("category_id", (cat as { id: string }).id);
  if (prodError) return { ids: [], error: prodError };
  const productIds = ((products as { id: string }[] | null) ?? []).map(
    (p) => p.id,
  );
  if (productIds.length === 0) return { ids: [], error: null };
  const { data: rows, error } = await supabase
    .from("order_items")
    .select("order_id")
    .in("order_id", orderIds)
    .in("extra_product_id", productIds);
  if (error) return { ids: [], error };
  return {
    ids: [
      ...new Set(
        ((rows as { order_id: string }[] | null) ?? []).map((r) => r.order_id),
      ),
    ],
    error: null,
  };
}
