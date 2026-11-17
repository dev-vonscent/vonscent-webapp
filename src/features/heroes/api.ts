import "server-only";
import { unstable_cache } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { CACHE_TAG_CATALOG, CACHE_TAG_HERO } from "@/lib/cache-tags";
import { isSupabaseConfigured } from "@/lib/env";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { callRpc } from "@/lib/supabase/rpc";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { pickLiveHero } from "./lib";
import type {
  HeroAdminRow,
  HeroDesktopImage,
  HeroEventOption,
  HeroMobileImage,
  HeroTarget,
  LiveHero,
} from "./types";

/**
 * Нүүрний hero (0182, feature flag `hero_admin`) — дэлгүүрийн уншилт.
 *
 * Нэг жижиг RPC (`live_heroes`), 60с кэш + `CACHE_TAG_CATALOG` (админ бичилт
 * `revalidatePublic()`; эхлэх/дуусах, улирлын хилийг шөнийн
 * `/api/cron/midnight-revalidate` → `revalidateHero()`).
 * Нүүр хуудас үүнийг Suspense-гүй хүлээнэ (LCP, plan §7.5) — тиймээс кэш
 * заавал, алдаа гарвал кодын hero руу унана.
 */

interface Row {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  mobile_description: string | null;
  primary_label: string;
  primary_target: HeroTarget;
  secondary_label: string | null;
  secondary_target: HeroTarget | null;
  desktop_image: HeroDesktopImage;
  mobile_image: HeroMobileImage;
  image_alt: string;
  dark: boolean;
  starts_at: string;
  ends_at: string;
}

type CachedHero = LiveHero & { startsAt: string; endsAt: string };

/**
 * `live_heroes()` (0184) — одоо гарах ёстой hero-ууд эрэмбээр. Жагсаалтыг
 * кэшлэх нь: эхнийх нь кэшийн дотор дуусахад дараагийнх нь шууд гарна
 * (кодын hero руу унахгүй, fixes F5).
 */
const fetchLiveHeroes = unstable_cache(
  async (): Promise<CachedHero[]> => {
    const supabase = createPublicClient();
    if (!supabase) return [];
    const { data, error } = await callRpc<Row[]>(supabase, "live_heroes", {});
    if (error) throw new Error(`live_heroes: ${error.message}`);
    return (data ?? []).map((r) => ({
      id: r.id,
      eyebrow: r.eyebrow,
      title: r.title,
      description: r.description,
      mobileDescription: r.mobile_description,
      primaryLabel: r.primary_label,
      primaryTarget: r.primary_target,
      secondaryLabel: r.secondary_label,
      secondaryTarget: r.secondary_target,
      desktopImage: r.desktop_image,
      mobileImage: r.mobile_image,
      imageAlt: r.image_alt,
      dark: r.dark,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
    }));
  },
  ["live-heroes"],
  { revalidate: 60, tags: [CACHE_TAG_CATALOG, CACHE_TAG_HERO] },
);

/** Одоо гарах DB hero, эсвэл null (→ кодын hero). Хэзээ ч шидэхгүй. */
export async function getLiveHero(): Promise<LiveHero | null> {
  if (!isSupabaseConfigured) return null;
  if (!(await isFeatureEnabled("hero_admin"))) return null;
  try {
    // Кэш 60с хоцорч болно — дууссаныг алгасаж дараагийнхыг авна.
    return pickLiveHero(await fetchLiveHeroes(), Date.now());
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

// ── Админ ─────────────────────────────────────────────────────────────────

interface AdminRow extends Omit<Row, "desktop_image" | "mobile_image"> {
  name: string;
  sale_event_id: string | null;
  starts_at: string;
  ends_at: string;
  priority: number;
  is_active: boolean;
  desktop_image: HeroDesktopImage | null;
  mobile_image: HeroMobileImage | null;
  updated_at: string;
  season: HeroAdminRow["season"];
  season_start_md: string | null;
  product_ids: string[] | null;
}

/** Админы жагсаалт — session client (staff RLS). */
export async function getHeroesAdmin(): Promise<HeroAdminRow[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("heroes")
    .select("*")
    .order("is_active", { ascending: false })
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) {
    Sentry.captureException(new Error(`heroes admin: ${error.message}`));
    return [];
  }
  return ((data as AdminRow[] | null) ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    saleEventId: r.sale_event_id,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    priority: r.priority,
    isActive: r.is_active,
    eyebrow: r.eyebrow,
    title: r.title,
    description: r.description,
    mobileDescription: r.mobile_description,
    primaryLabel: r.primary_label,
    primaryTarget: r.primary_target,
    secondaryLabel: r.secondary_label,
    secondaryTarget: r.secondary_target,
    desktopImage: r.desktop_image,
    mobileImage: r.mobile_image,
    imageAlt: r.image_alt,
    dark: r.dark,
    updatedAt: r.updated_at,
    season: r.season ?? null,
    seasonStartMd: r.season_start_md ?? null,
    productIds: r.product_ids ?? [],
  }));
}

/**
 * Hero-той холбох / товчоор заах арга хэмжээнүүд. `sale_events` туг хаалттай
 * бол хоосон — hero бие даан ажиллана (зөвхөн өөрийн хугацаа).
 */
export async function getHeroEventOptions(): Promise<HeroEventOption[]> {
  if (!(await isFeatureEnabled("sale_events"))) return [];
  const supabase = await createClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("sale_events")
    .select("id, slug, name, starts_at, ends_at, is_active")
    .gt("ends_at", new Date().toISOString())
    .order("starts_at");
  return (
    (data as
      | {
          id: string;
          slug: string;
          name: string;
          starts_at: string;
          ends_at: string;
          is_active: boolean;
        }[]
      | null) ?? []
  ).map((e) => ({
    id: e.id,
    slug: e.slug,
    name: e.name,
    startsAt: e.starts_at,
    endsAt: e.ends_at,
    isActive: e.is_active,
  }));
}
