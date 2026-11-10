import { getBottleStock } from "@/features/admin/api";
import { BottleStockManager } from "@/features/admin/components/bottle-stock-manager";
import { PageHeader } from "@/components/shared/page-header";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getVialOptions } from "@/features/extras/admin-api";
import { VialStockManager } from "@/features/extras/components/admin/vial-stock-manager";

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
  // Савны тоон нөөц (0145/0152, туг `vial_inventory`) — ширхэгээр тоолно.
  if (await isFeatureEnabled("vial_inventory")) {
    const vials = await getVialOptions();
    return (
      <div className="space-y-6">
        <PageHeader
          title="Савны нөөц"
          description="Нүдэнд зарах боломжтой тоо. Дарж нийт тоо, хязгаар, хөдөлгөөнийг харна. Тоо оруулаагүй сав хязгааргүй зарагдана."
        />
        <VialStockManager vials={vials} />
      </div>
    );
  }
  const { cells, overrides, migrated, countsReady } = await getBottleStock();
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
        countsReady={countsReady}
      />
    </div>
  );
}
