import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { getHeroEventOptions, getHeroesAdmin } from "@/features/heroes/api";
import { HeroBoard } from "@/features/heroes/components/hero-board";

export const dynamic = "force-dynamic";

export const metadata = { title: "Нүүрний баннер" };

/** Админ → Сайт → Нүүрний баннер — самбар (studio-ux.md §7, туг `hero_admin`). */
export default async function AdminHeroesPage() {
  if (!(await isFeatureEnabled("hero_admin"))) notFound();
  const [rows, events] = await Promise.all([getHeroesAdmin(), getHeroEventOptions()]);
  // Хүсэлтийн цаг (force-dynamic) — `Date.now()`-г lint хориглодог.
  return <HeroBoard heroes={rows} events={events} now={new Date().getTime()} />;
}
