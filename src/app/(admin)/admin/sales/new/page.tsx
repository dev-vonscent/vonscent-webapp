import { notFound } from "next/navigation";
import { SaleEditor } from "@/features/sales/components/sale-editor";
import { editorInitial } from "@/features/sales/editor-data";
import { getNamedSalesData, namedSalesEnabled } from "@/features/sales/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Шинэ хямдрал" };

/** Админ → Хямдрал → Шинэ (16.3, туг `sale_page` + `named_sales`). */
export default async function NewSalePage() {
  if (!(await namedSalesEnabled())) notFound();
  const { sales, products } = await getNamedSalesData();
  // Хүсэлтийн цаг (force-dynamic) — `Date.now()`-г lint хориглодог.
  const data = editorInitial(null, sales, products, new Date().getTime());
  if (!data) notFound();
  return <SaleEditor initial={data.initial} busy={data.busy} products={products} />;
}
