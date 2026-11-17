import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import {
  SaleManager,
  isOnSale,
  type SaleProduct,
} from "@/features/admin/components/sale-manager";
import type { Gender } from "@/db/types";
import { SaleList } from "@/features/sales/components/sale-list";
import { summarizeSales } from "@/features/sales/lib";
import { getNamedSalesData } from "@/features/sales/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Хямдрал" };

interface Row {
  id: string;
  name: string;
  brand: string;
  gender: Gender;
  product_variants: {
    ml: number;
    price: number;
    sale_price: number | null;
    sale_starts_at: string | null;
    sale_ends_at: string | null;
    is_active: boolean;
  }[];
}

/**
 * Админ → Маркетинг → Хямдрал (0166, feature flag `sale_page`; `named_sales`
 * нээлттэй бол нэртэй хямдралын жагсаалт, 0188). Олон бараанд
 * нэг дор хугацаатай хямдрал тавих / цуцлах. Нуусан бараа орохгүй — зөвхөн
 * дэлгүүрт харагдаж буй («Идэвхтэй», «Тун удахгүй») бараа.
 */
export default async function AdminSalesPage() {
  if (!(await isFeatureEnabled("sale_page"))) notFound();

  // Нэртэй хямдрал (16.3, туг `named_sales`): жагсаалт + тусдаа шинэ/засах
  // хуудас. Хаалттай үед доорх хуучин нэг хуудасны менежер хэвээр.
  if (await isFeatureEnabled("named_sales")) {
    const { sales, products: rows } = await getNamedSalesData();
    return (
      <SaleList rows={summarizeSales(sales, rows, new Date().getTime())} />
    );
  }

  const eventsOn = await isFeatureEnabled("sale_events");

  let products: SaleProduct[] = [];
  const supabase = await createClient();
  if (supabase) {
    const { data } = await supabase
      .from("products")
      .select(
        "id, name, brand, gender, product_variants ( ml, price, sale_price, sale_starts_at, sale_ends_at, is_active )",
      )
      .in("status", ["active", "coming_soon"])
      .order("brand")
      .order("name");
    products = ((data as Row[] | null) ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      brand: r.brand,
      gender: r.gender,
      variants: [...r.product_variants]
        .sort((a, b) => a.ml - b.ml)
        .map((v) => ({
          ml: v.ml,
          price: v.price,
          salePrice: v.sale_price,
          saleStartsAt: v.sale_starts_at,
          saleEndsAt: v.sale_ends_at,
          isActive: v.is_active,
        })),
    }));
  }

  // Дууссан хямдралыг тоолохгүй (16.1). Хүсэлтийн цаг (force-dynamic) —
  // `Date.now()`-г lint хориглодог.
  const now = new Date().getTime();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Хямдрал"
        description={
          eventsOn
            ? "Олон бараанд нэг дор хэмжээ бүрийн хувиар хугацаатай хямдрал тавина. Нэрлэсэн, хугацаатай хямдралд (Black Friday г.м.) «Арга хэмжээ»-г ашиглана уу — энэ нь одоо байгаа хямдралыг дарахгүй."
            : "Олон бараанд нэг дор хэмжээ бүрийн хувиар хугацаатай хямдрал тавина."
        }
        count={products.filter((p) => isOnSale(p, now)).length}
      />
      <SaleManager products={products} />
    </div>
  );
}
