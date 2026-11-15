import { notFound } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { isImageGenConfigured } from "@/lib/env";
import { getHeroEventOptions } from "@/features/heroes/api";
import { HeroPageEditor } from "@/features/heroes/components/hero-page-editor";
import { specialPageDraft } from "@/features/heroes/hero-page-model";

export const dynamic = "force-dynamic";

export const metadata = { title: "Тусгай өдрийн баннер" };

/** Шинэ тусгай өдрийн баннер (studio-ux.md §7). */
export default async function NewHeroPage() {
  if (!(await isFeatureEnabled("hero_admin"))) notFound();
  const events = await getHeroEventOptions();
  return (
    <HeroPageEditor
      initial={specialPageDraft(null, () => "", () => "")}
      id={null}
      groupId={crypto.randomUUID()}
      productIds={[]}
      live={false}
      published={false}
      events={events}
      aiConfigured={isImageGenConfigured}
    />
  );
}
