import type { Metadata } from "next";
import { fetchScentFamilies } from "@/features/taxonomy/api";
import { ScentFamilyManager } from "@/features/admin/components/scent-family-manager";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Үнэрийн төрөл" };

export default async function ScentFamiliesPage() {
  // Admin view includes hidden families, so it reads the unfiltered list.
  const families = await fetchScentFamilies();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Үнэрийн төрөл"
        description="Барааны маягт болон каталогийн шүүлтүүр энэ жагсаалтаас уншина."
      />
      <ScentFamilyManager families={families} />
    </div>
  );
}
