import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { CustomLabelPrint } from "@/features/admin/components/custom-label-print";

export const dynamic = "force-dynamic";
export const metadata = { title: "Шошго хэвлэх" };

/**
 * Захиалгагүй шошго (`label_print`) — Facebook, Instagram, утсаар ирсэн
 * захиалгын хаяг, усны шошгыг гараар эсвэл Excel-ээр оруулж хэвлэнэ. Санд
 * юу ч хадгалахгүй (клиент, 2026-11).
 */
export default async function AdminCustomLabelsPage() {
  if (!(await isFeatureEnabled("label_print"))) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Шошго хэвлэх"
        description="Вэбээс бус (Facebook, Instagram, утсаар) ирсэн захиалгын шошго. Мэдээлэл хадгалагдахгүй — хуудсыг хаахад арилна."
      />
      <CustomLabelPrint />
    </div>
  );
}
