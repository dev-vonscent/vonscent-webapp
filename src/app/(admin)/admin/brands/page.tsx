import type { Metadata } from "next";
import { fetchBrands } from "@/features/taxonomy/api";
import { BrandManager } from "@/features/admin/components/brand-manager";

export const metadata: Metadata = { title: "Брэнд" };

export default async function BrandsPage() {
  // Admin view includes hidden brands, so it reads the unfiltered list.
  const brands = await fetchBrands();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Брэнд</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Барааны маягт энэ жагсаалтаас уншина. Нэр солиход тухайн брэндийн бүх
          бараан дээр шинэчлэгдэнэ.
        </p>
      </div>
      <BrandManager brands={brands} />
    </div>
  );
}
