import "server-only";
import { unstable_cache } from "next/cache";
import * as Sentry from "@sentry/nextjs";
import { CACHE_TAG_CATALOG } from "@/lib/cache-tags";
import { isSupabaseConfigured } from "@/lib/env";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { callRpc } from "@/lib/supabase/rpc";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
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
 * Нэг жижиг RPC, 60с кэш + `CACHE_TAG_CATALOG` (админ бичилт
 * `revalidatePublic()`, эхлэх/дуусах мөчийг `/api/cron/sale-events`).
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

const fetchLiveHero = unstable_cache(
  async (): Promise<(LiveHero & { endsAt: string }) | null> => {
    const supabase = createPublicClient();
    if (!supabase) return null;
    const { data, error } = await callRpc<Row[]>(supabase, "live_hero", {});
    if (error) throw new Error(`live_hero: ${error.message}`);
    const r = data?.[0];
    if (!r) return null;
    return {
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
      endsAt: r.ends_at,
    };
  },
  ["live-hero"],
  { revalidate: 60, tags: [CACHE_TAG_CATALOG] },
);

/** Одоо гарах DB hero, эсвэл null (→ кодын hero). Хэзээ ч шидэхгүй. */
export async function getLiveHero(): Promise<LiveHero | null> {
  if (!isSupabaseConfigured) return null;
  if (!(await isFeatureEnabled("hero_admin"))) return null;
  try {
    const h = await fetchLiveHero();
    // Кэш 60с хоцорч болно — дууссан hero-г дахин шалгана.
    if (!h || Date.parse(h.endsAt) <= Date.now()) return null;
    return h;
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
