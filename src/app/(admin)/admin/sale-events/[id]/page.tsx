import { notFound } from "next/navigation";
import { z } from "zod";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isImageGenConfigured } from "@/lib/env";
import { getHeroEventOptions, getHeroesAdmin } from "@/features/heroes/api";
import {
  getSaleEventAdmin,
  getSaleEventBundleOptions,
  getSaleEventProductOptions,
} from "@/features/sale-events/api";
import { getCollectionSettings } from "@/features/collections/api";
import { EventStudio } from "@/features/sale-events/components/studio/event-studio";
import { linkedBannerRow } from "@/features/sale-events/components/studio/studio-banner";

export const dynamic = "force-dynamic";

export const metadata = { title: "Арга хэмжээ" };

/**
 * Арга хэмжээний студи — засах / тойм (studio-ux.md D1, §8.1). Баннер нь
 * `heroes.sale_event_id`-аар холбогдсон мөр (`hero_admin` нээлттэй үед).
 */
export default async function SaleEventStudioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  if (!(await isFeatureEnabled("sale_events"))) notFound();

  const id = z
    .string()
    .uuid()
    .safeParse((await params).id);
  if (!id.success) notFound();

  const heroAdmin = await isFeatureEnabled("hero_admin");
  // 16.7 — туг хаалттай бол багцын сонгогч огт уншигдахгүй.
  const bundlesOn = await isFeatureEnabled("sale_event_bundles");
  const [row, products, heroes, heroEvents, bundleOptions, collectionSettings] =
    await Promise.all([
      getSaleEventAdmin(id.data),
      getSaleEventProductOptions(),
      heroAdmin ? getHeroesAdmin() : [],
      heroAdmin ? getHeroEventOptions() : [],
      bundlesOn ? getSaleEventBundleOptions() : [],
      bundlesOn ? getCollectionSettings() : null,
    ]);
  if (!row) notFound();
  const linked = linkedBannerRow(heroes, row.id);

  return (
    // Зогсоох г.м. серверийн төлөв солигдоход студи шинэ мөрөөр дахин эхэлнэ.
    <EventStudio
      key={`${row.id}:${row.updatedAt}:${row.isActive}:${row.endsAt}:${linked.row?.updatedAt ?? ""}`}
      row={row}
      products={products}
      bundleOptions={bundleOptions}
      bundleStep={collectionSettings?.roundTo ?? 100}
      bannerRow={linked.row}
      bannerOthers={linked.others}
      heroes={heroes}
      heroEvents={heroEvents}
      aiConfigured={isImageGenConfigured}
      initialStep={(await searchParams).step}
      // Хүсэлтийн цаг (force-dynamic) — төлөв эхний render-т хоёр талд ижил.
      now={new Date().getTime()}
    />
  );
}
