import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isImageGenConfigured } from "@/lib/env";
import { isoEndToDay, isoToDay } from "@/features/admin/lib/date-range";
import { getHeroEventOptions, getHeroesAdmin } from "@/features/heroes/api";
import { HeroPageEditor } from "@/features/heroes/components/hero-page-editor";
import { specialPageDraft } from "@/features/heroes/hero-page-model";
import { heroAt } from "@/features/heroes/lib";

export const dynamic = "force-dynamic";

export const metadata = { title: "Тусгай өдрийн баннер" };

/**
 * Тусгай өдрийн баннерын засвар (studio-ux.md §7). Улирлын баннер → улирлын
 * хуудас; арга хэмжээний баннер → студийн ④ (нэг баннерыг хоёр газраас засахгүй).
 */
export default async function HeroEditPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isFeatureEnabled("hero_admin"))) notFound();
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [rows, events] = await Promise.all([getHeroesAdmin(), getHeroEventOptions()]);
  const row = rows.find((h) => h.id === id.data);
  if (!row) notFound();
  if (row.season) redirect(`/admin/heroes/season/${row.season}`);
  if (row.saleEventId) redirect(`/admin/sale-events/${row.saleEventId}?step=banner`);
  const live = heroAt(rows, events, new Date().getTime())?.id === row.id;
  return (
    <HeroPageEditor
      key={row.updatedAt}
      initial={specialPageDraft(row, (iso) => isoToDay(iso), (iso) => isoEndToDay(iso))}
      id={row.id}
      groupId={row.id}
      productIds={row.productIds}
      live={live}
      published={row.isActive}
      events={events}
      aiConfigured={isImageGenConfigured}
    />
  );
}
