import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isImageGenConfigured } from "@/lib/env";
import { getHeroEventOptions, getHeroesAdmin } from "@/features/heroes/api";
import { HeroAdmin } from "@/features/heroes/components/hero-admin";

export const dynamic = "force-dynamic";

export const metadata = { title: "Нүүрний hero" };

/** Админ → Сайт → Нүүрний hero (0182, feature flag `hero_admin`). */
export default async function AdminHeroesPage() {
  if (!(await isFeatureEnabled("hero_admin"))) notFound();
  const [rows, events] = await Promise.all([
    getHeroesAdmin(),
    getHeroEventOptions(),
  ]);
  return (
    <HeroAdmin
      rows={rows}
      events={events}
      aiConfigured={isImageGenConfigured}
    />
  );
}
