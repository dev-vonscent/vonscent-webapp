import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getHeroesAdmin } from "@/features/heroes/api";
import { getSaleEventsAdmin } from "@/features/sale-events/api";
import { SaleEventList } from "@/features/sale-events/components/sale-event-list";
import {
  studioBannerFor,
  type StudioBanner,
} from "@/features/sale-events/components/studio/studio-checklist";

export const dynamic = "force-dynamic";

export const metadata = { title: "Арга хэмжээ" };

/**
 * Админ → Каталог → Арга хэмжээ (0181, feature flag `sale_events`) — жагсаалт.
 * Үүсгэх / засах нь студид: `/admin/sale-events/new`, `/[id]`.
 */
export default async function AdminSaleEventsPage() {
  if (!(await isFeatureEnabled("sale_events"))) notFound();

  const [rows, heroes] = await Promise.all([
    getSaleEventsAdmin(),
    (await isFeatureEnabled("hero_admin")) ? getHeroesAdmin() : [],
  ]);
  const banners: Record<string, StudioBanner> = {};
  for (const e of rows) {
    const banner = studioBannerFor(heroes, e.id);
    if (banner) banners[e.id] = banner;
  }

  return <SaleEventList rows={rows} banners={banners} />;
}
