import { notFound } from "next/navigation";
import { z } from "zod";
import { isFeatureEnabled } from "@/lib/feature-flags";
import {
  getSaleEventAdmin,
  getSaleEventProductOptions,
} from "@/features/sale-events/api";
import { EventStudio } from "@/features/sale-events/components/studio/event-studio";

export const dynamic = "force-dynamic";

export const metadata = { title: "Арга хэмжээ үүсгэх" };

/**
 * Арга хэмжээний студи — шинэ (studio-ux.md D1). `?copy=<id>`: өмнөх арга
 * хэмжээний бараа, хувь, каталогийн текстээр эхэлнэ, огноо хоосон (§4.1).
 */
export default async function NewSaleEventPage({
  searchParams,
}: {
  searchParams: Promise<{ copy?: string }>;
}) {
  if (!(await isFeatureEnabled("sale_events"))) notFound();

  const copyId = z.string().uuid().safeParse((await searchParams).copy);
  const [products, copyOf] = await Promise.all([
    getSaleEventProductOptions(),
    copyId.success ? getSaleEventAdmin(copyId.data) : null,
  ]);

  return (
    <EventStudio
      key={copyOf?.id ?? "new"}
      row={null}
      copyOf={copyOf}
      products={products}
      banner={null}
      // Хүсэлтийн цаг (force-dynamic) — төлөв эхний render-т хоёр талд ижил.
      now={new Date().getTime()}
    />
  );
}
