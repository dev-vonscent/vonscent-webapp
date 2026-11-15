import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isImageGenConfigured } from "@/lib/env";
import { HERO_SEASONS, SEASON_HERO_STARTS, SEASON_LABEL, type HeroSeason } from "@/lib/constants";
import { getHeroEventOptions, getHeroesAdmin } from "@/features/heroes/api";
import { HeroPageEditor } from "@/features/heroes/components/hero-page-editor";
import { seasonPageDraft } from "@/features/heroes/hero-page-model";
import { heroAt } from "@/features/heroes/lib";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ season: string }> }) {
  const s = (await params).season as HeroSeason;
  return { title: SEASON_LABEL[s] ? `${SEASON_LABEL[s]} — улирлын баннер` : "Нүүрний баннер" };
}

/** Улирлын баннерын засвар (studio-ux.md §7, D9). */
export default async function SeasonHeroPage({ params }: { params: Promise<{ season: string }> }) {
  if (!(await isFeatureEnabled("hero_admin"))) notFound();
  const season = (await params).season;
  if (!HERO_SEASONS.includes(season as HeroSeason)) notFound();
  const s = season as HeroSeason;
  const [rows, events] = await Promise.all([getHeroesAdmin(), getHeroEventOptions()]);
  const row = rows.find((h) => h.season === s) ?? null;
  const live = row !== null && heroAt(rows, events, new Date().getTime())?.id === row.id;
  return (
    <HeroPageEditor
      key={row?.updatedAt ?? "new"}
      initial={seasonPageDraft(s, row, SEASON_HERO_STARTS[s])}
      id={row?.id ?? null}
      groupId={row?.id ?? crypto.randomUUID()}
      productIds={row?.productIds ?? []}
      live={live}
      published={row?.isActive ?? false}
      events={events}
      aiConfigured={isImageGenConfigured}
    />
  );
}
