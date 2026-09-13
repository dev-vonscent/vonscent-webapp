import type { Metadata } from "next";
import { fetchBrands } from "@/features/taxonomy/api";
import { BrandManager } from "@/features/admin/components/brand-manager";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Брэнд" };

export default async function BrandsPage() {
  // Admin view includes hidden brands, so it reads the unfiltered list.
  const brands = await fetchBrands();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Брэнд"
        description="Барааны маягт энэ жагсаалтаас уншина. Нэр солиход тухайн брэндийн бүх бараан дээр шинэчлэгдэнэ."
      />
      <BrandManager brands={brands} />
    </div>
  );
}
