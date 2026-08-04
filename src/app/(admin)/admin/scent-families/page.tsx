import type { Metadata } from "next";
import { fetchScentFamilies } from "@/features/taxonomy/api";
import { ScentFamilyManager } from "@/features/admin/components/scent-family-manager";

export const metadata: Metadata = { title: "Үнэрийн төрөл" };

export default async function ScentFamiliesPage() {
  // Admin view includes hidden families, so it reads the unfiltered list.
  const families = await fetchScentFamilies();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-semibold">Үнэрийн төрөл</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Барааны маягт болон каталогийн шүүлтүүр энэ жагсаалтаас уншина.
        </p>
      </div>
      <ScentFamilyManager families={families} />
    </div>
  );
}
