import "server-only";
import { getBaseCollections } from "@/features/collections/api";
import { getLiveHero } from "@/features/heroes/api";
import { heroToCampaign } from "@/features/heroes/lib";
import {
  EVERGREEN_HERO,
  liveCampaigns,
  type HomeCampaign,
} from "./home-content";
import {
  staticHero,
  type ResolvedHero,
} from "./components/home/campaign-hero";

/**
 * Нүүрний hero-гийн дараалал (plan §7.1):
 *
 *   hero_admin нээлттэй →  DB-ийн идэвхтэй hero (`live_hero()`)
 *                        →  HOME_CAMPAIGNS (кодын)  →  EVERGREEN_HERO
 *   hero_admin хаалттай →  HOME_CAMPAIGNS → EVERGREEN_HERO
 *
 * Кодын hero нь НӨӨЦ: DB хоосон / алдаатай, demo горим (CI e2e) — hero
 * хэзээ ч хоосрохгүй. `getLiveHero` туг, demo, алдааг өөрөө барина.
 */
export async function resolveHomeHero(
  now = new Date(),
): Promise<ResolvedHero> {
  const db = await getLiveHero();
  if (db) {
    const campaign = heroToCampaign(db);
    if (campaign.image.kind === "static")
      return staticHero(campaign, campaign.image);
  }
  return resolveStaticHero(now) ?? (await resolveHero(now));
}

/**
 * The first live campaign whose image actually resolves — a campaign that
 * points at a deleted/hidden bundle falls through to the next one, and in the
 * end to the evergreen hero, so the slot is never empty or broken.
 */
export async function resolveHero(now = new Date()): Promise<ResolvedHero> {
  const candidates: HomeCampaign[] = [...liveCampaigns(now), EVERGREEN_HERO];
  let collections: Awaited<ReturnType<typeof getBaseCollections>> | null = null;
  for (const campaign of candidates) {
    const img = campaign.image;
    if (img.kind === "static") return staticHero(campaign, img);
    collections ??= await getBaseCollections();
    const found = collections.find((c) => c.slug === img.slug);
    if (found?.image) {
      return {
        campaign,
        image: {
          src: found.image,
          alt: img.alt,
          position: img.position ?? "50% 50%",
        },
      };
    }
  }
  // EVERGREEN_HERO is static, so the loop always returns — this satisfies TS.
  throw new Error("unreachable: evergreen hero must be static");
}

/**
 * The code hero without any data fetch, when the first candidate is a static
 * photo; `null` when it needs a bundle cover (then `resolveHero`).
 *
 * The page renders the hero outside its own `<Suspense>`: a nested boundary
 * is revealed by React's batched `$RC` (rAF + 300ms steps), which a busy
 * phone main thread pushes past hydration — Lighthouse mobile LCP was ~11s
 * with the image itself downloaded in 0.3s.
 */
export function resolveStaticHero(now = new Date()): ResolvedHero | null {
  const campaign = liveCampaigns(now)[0] ?? EVERGREEN_HERO;
  const img = campaign.image;
  return img.kind === "static" ? staticHero(campaign, img) : null;
}
