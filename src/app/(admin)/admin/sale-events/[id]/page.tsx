import { notFound } from "next/navigation";
import { z } from "zod";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getHeroesAdmin } from "@/features/heroes/api";
import {
  getSaleEventAdmin,
  getSaleEventProductOptions,
} from "@/features/sale-events/api";
import { EventStudio } from "@/features/sale-events/components/studio/event-studio";
import { studioBannerFor } from "@/features/sale-events/components/studio/studio-checklist";

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

  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const [row, products, heroes] = await Promise.all([
    getSaleEventAdmin(id.data),
    getSaleEventProductOptions(),
    (await isFeatureEnabled("hero_admin")) ? getHeroesAdmin() : [],
  ]);
  if (!row) notFound();

  return (
    // Зогсоох г.м. серверийн төлөв солигдоход студи шинэ мөрөөр дахин эхэлнэ.
    <EventStudio
      key={`${row.id}:${row.updatedAt}:${row.isActive}:${row.endsAt}`}
      row={row}
      products={products}
      banner={studioBannerFor(heroes, row.id)}
      initialStep={(await searchParams).step}
      // Хүсэлтийн цаг (force-dynamic) — төлөв эхний render-т хоёр талд ижил.
      now={new Date().getTime()}
    />
  );
}
