import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { getSaleEventsAdmin } from "@/features/sale-events/api";
import {
  SaleEventAdmin,
  type SaleEventProduct,
} from "@/features/sale-events/components/sale-event-admin";
import type { Gender } from "@/db/types";

export const dynamic = "force-dynamic";

export const metadata = { title: "Арга хэмжээ" };

interface Row {
  id: string;
  name: string;
  brand: string;
  gender: Gender;
  product_variants: { ml: number; price: number; is_active: boolean }[];
}

/**
 * Админ → Каталог → Арга хэмжээ (0181, feature flag `sale_events`).
 * Сонгогчид зөвхөн дэлгүүрт харагдаж буй («Идэвхтэй», «Тун удахгүй») бараа.
 */
export default async function AdminSaleEventsPage() {
  if (!(await isFeatureEnabled("sale_events"))) notFound();

  const supabase = await createClient();
  const [rows, productRows] = await Promise.all([
    getSaleEventsAdmin(),
    supabase
      ? supabase
          .from("products")
          .select(
            "id, name, brand, gender, product_variants ( ml, price, is_active )",
          )
          .in("status", ["active", "coming_soon"])
          .order("brand")
          .order("name")
          .then(({ data }) => (data as Row[] | null) ?? [])
      : Promise.resolve([] as Row[]),
  ]);

  const products: SaleEventProduct[] = productRows.map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand,
    gender: r.gender,
    prices: Object.fromEntries(
      r.product_variants
        .filter((v) => v.is_active && v.price > 0)
        .map((v) => [v.ml, v.price]),
    ),
  }));

  return <SaleEventAdmin rows={rows} products={products} />;
}
