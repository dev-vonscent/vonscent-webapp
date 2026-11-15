import { notFound } from "next/navigation";
import { z } from "zod";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isImageGenConfigured } from "@/lib/env";
import { getHeroesAdmin } from "@/features/heroes/api";
import {
  getSaleEventAdmin,
  getSaleEventProductOptions,
} from "@/features/sale-events/api";
import { EventStudio } from "@/features/sale-events/components/studio/event-studio";
import { linkedBannerRow } from "@/features/sale-events/components/studio/studio-banner";

export const dynamic = "force-dynamic";

export const metadata = { title: "Арга хэмжээ үүсгэх" };

/**
 * Арга хэмжээний студи — шинэ (studio-ux.md D1). `?copy=<id>`: өмнөх арга
 * хэмжээний бараа, хувь, каталогийн текст, баннераар эхэлнэ, огноо хоосон (§4.1).
 */
export default async function NewSaleEventPage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string }>;
}) {
  if (!(await isFeatureEnabled("sale_events"))) notFound();

  const copyId = z.string().uuid().safeParse((await searchParams).copy);
  const heroAdmin = copyId.success && (await isFeatureEnabled("hero_admin"));
  const [products, copyOf, heroes] = await Promise.all([
    getSaleEventProductOptions(),
    copyId.success ? getSaleEventAdmin(copyId.data) : null,
    heroAdmin ? getHeroesAdmin() : [],
  ]);

  return (
    <EventStudio
      key={copyOf?.id ?? "new"}
      row={null}
      copyOf={copyOf}
      products={products}
      // Хуулахад баннер ч хуулагдана (studio-ux.md §10 S3).
      copyBanner={copyOf ? linkedBannerRow(heroes, copyOf.id).row : null}
      aiConfigured={isImageGenConfigured}
      // Хүсэлтийн цаг (force-dynamic) — төлөв эхний render-т хоёр талд ижил.
      now={new Date().getTime()}
    />
  );
}
