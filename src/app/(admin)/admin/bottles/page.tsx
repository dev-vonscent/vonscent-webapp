import { getBottleStock } from "@/features/admin/api";
import { BottleStockManager } from "@/features/admin/components/bottle-stock-manager";
import { PageHeader } from "@/components/shared/page-header";

export const dynamic = "force-dynamic";

export const metadata = { title: "Савны нөөц" };

/**
 * Хоосон декант савны нөөц (0095).
 *
 * Сав нь ml бүрт гурван өнгөтэй ирдэг ба өнгө нь барааны хүйсээр
 * хуваарилагддаг. Нэг өнгө/хэмжээ дуусахад админ энд хааж, дэлгүүрийн бүх
 * холбогдох бараа тэр хэмжээгээрээ зарагдахаа болино. Захиалгын
 * «Түгжигдсэн мл» (reserved_ml)-ээс тусдаа ойлголт.
 */
export default async function AdminBottlesPage() {
  const { cells, overrides, migrated } = await getBottleStock();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Савны нөөц"
        description="Хоосон савны өнгө (хүйс) × хэмжээ. Хаасан хослол дэлгүүр дээр шууд идэвхгүй болно."
      />
      <BottleStockManager
        cells={cells}
        overrides={overrides}
        migrated={migrated}
      />
    </div>
  );
}
