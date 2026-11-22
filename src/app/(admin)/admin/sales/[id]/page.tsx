import { notFound } from "next/navigation";
import { SaleEditor } from "@/features/sales/components/sale-editor";
import { editorInitial } from "@/features/sales/editor-data";
import { getNamedSalesData, namedSalesEnabled } from "@/features/sales/server";

export const dynamic = "force-dynamic";

export const metadata = { title: "Хямдрал засах" };

/**
 * Админ → Хямдрал → засах (16.4), эсвэл `/admin/sales/unnamed` — хуучин
 * нэргүй хямдралыг нэрлэх (16.6). Туг `sale_page` + `named_sales`.
 */
export default async function EditSalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await namedSalesEnabled())) notFound();
  const { id } = await params;
  const { sales, products, eventSpans } = await getNamedSalesData();
  const data = editorInitial(id, sales, products, new Date().getTime());
  if (!data) notFound();
  return (
    <SaleEditor
      key={id}
      initial={data.initial}
      busy={data.busy}
      eventSpans={eventSpans}
      products={products}
    />
  );
}
