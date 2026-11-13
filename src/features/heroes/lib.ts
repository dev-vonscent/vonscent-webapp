import type { HomeCampaign } from "@/features/marketing/home-content";
import type {
  HeroAdminRow,
  HeroDesktopImage,
  HeroEventOption,
  HeroTarget,
  LiveHero,
} from "./types";

/**
 * Дотоод хаяг эсэх: `/`-ээр эхэлсэн, `//` (protocol-relative) ба `/\` биш,
 * хоосон зай, удирдах тэмдэгтгүй. Гадагш redirect / phishing-ээс сэргийлнэ.
 * SQL-ийн `hero_target_valid`-тай ижил дүрэм.
 */
export function isInternalPath(href: string): boolean {
  return href.length <= 300 && /^\/(?![/\\])\S*$/u.test(href);
}

/** Холбоос → URL (plan §7.3). */
export function heroTargetHref(t: HeroTarget): string {
  switch (t.type) {
    case "event":
      return `/sale/${t.slug}`;
    case "season":
      return `/catalog?kind=perfume&season=${t.value}`;
    case "catalog": {
      const q = t.query.replace(/^\?/u, "").trim();
      return q ? `/catalog?${q}` : "/catalog";
    }
    case "path":
      // Хадгалахад шалгагдсан ч уншихдаа дахин — гадаад хаяг хэзээ ч гарахгүй.
      return isInternalPath(t.href) ? t.href : "/";
  }
}

export function desktopSrc(img: HeroDesktopImage, w: number): string {
  return `${img.base}-${w}.webp`;
}

/** DB hero → нүүрний `CampaignHero`-гийн хэлбэр (кодын hero-тэй нэг компонент). */
export function heroToCampaign(
  h: Pick<
    LiveHero,
    | "id"
    | "eyebrow"
    | "title"
    | "description"
    | "mobileDescription"
    | "primaryLabel"
    | "primaryTarget"
    | "secondaryLabel"
    | "secondaryTarget"
    | "desktopImage"
    | "mobileImage"
    | "imageAlt"
    | "dark"
  >,
): HomeCampaign {
  const widths = [...h.desktopImage.widths].sort((a, b) => a - b);
  return {
    id: `db-${h.id}`,
    startsOn: null,
    endsOn: null,
    eyebrow: h.eyebrow,
    title: h.title,
    description: h.description,
    mobileDescription: h.mobileDescription ?? undefined,
    primary: { label: h.primaryLabel, href: heroTargetHref(h.primaryTarget) },
    secondary:
      h.secondaryLabel && h.secondaryTarget
        ? {
            label: h.secondaryLabel,
            href: heroTargetHref(h.secondaryTarget),
          }
        : undefined,
    image: {
      kind: "static",
      src: desktopSrc(h.desktopImage, 1600),
      width: 1600,
      height: h.desktopImage.height1600,
      srcSet: widths
        .map((w) => `${desktopSrc(h.desktopImage, w)} ${w}w`)
        .join(", "),
      alt: h.imageAlt || h.title,
      mobile: h.mobileImage,
      dark: h.dark,
    },
  };
}

/** Hero-гийн бодит хугацаа: холбоотой бол арга хэмжээнийх (plan §7.2). */
export function heroPeriod(
  h: Pick<HeroAdminRow, "saleEventId" | "startsAt" | "endsAt">,
  events: readonly HeroEventOption[],
): { startsAt: string; endsAt: string; eventActive: boolean } | null {
  if (h.saleEventId) {
    const e = events.find((x) => x.id === h.saleEventId);
    return e
      ? { startsAt: e.startsAt, endsAt: e.endsAt, eventActive: e.isActive }
      : null;
  }
  return h.startsAt && h.endsAt
    ? { startsAt: h.startsAt, endsAt: h.endsAt, eventActive: true }
    : null;
}

export interface ScheduleSegment {
  /** `YYYY-MM-DD` (УБ), хоёулаа хамааруулна. */
  from: string;
  to: string;
  /** null = DB hero байхгүй → кодын hero. */
  heroId: string | null;
  label: string;
}

const UB_OFFSET_MS = 8 * 3_600_000;

function dayKey(t: number): string {
  return new Date(t + UB_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Ирэх N хоногийн хуваарь (plan §9.2): өдөр бүрийн УБ 12:00-д аль hero гарах
 * вэ (`live_hero()`-ийн дүрэм: идэвхтэй, зурагтай, priority их нь, дараа нь
 * сүүлд эхэлсэн нь), дараалсан ижил өдрүүдийг нэг хэсэг болгоно. Товчны
 * арга хэмжээний шалгалтыг энд хийхгүй — тойм.
 */
export function heroSchedule(
  heroes: readonly HeroAdminRow[],
  events: readonly HeroEventOption[],
  now: number,
  days = 90,
): ScheduleSegment[] {
  const candidates = heroes
    .filter((h) => h.isActive && h.desktopImage && h.mobileImage)
    .map((h) => ({ h, p: heroPeriod(h, events) }))
    .filter(
      (x): x is { h: HeroAdminRow; p: NonNullable<typeof x.p> } =>
        x.p != null && x.p.eventActive,
    );
  const today = dayKey(now);
  const startNoon = Date.parse(`${today}T12:00:00+08:00`);
  const out: ScheduleSegment[] = [];
  for (let i = 0; i < days; i++) {
    const t = startNoon + i * 86_400_000;
    const live = candidates
      .filter(
        ({ p }) => Date.parse(p.startsAt) <= t && t < Date.parse(p.endsAt),
      )
      .sort(
        (a, b) =>
          b.h.priority - a.h.priority ||
          Date.parse(b.p.startsAt) - Date.parse(a.p.startsAt),
      )[0];
    const heroId = live?.h.id ?? null;
    const day = dayKey(t);
    const last = out[out.length - 1];
    if (last && last.heroId === heroId) last.to = day;
    else
      out.push({
        from: day,
        to: day,
        heroId,
        label: live?.h.name ?? "Кодын hero",
      });
  }
  return out;
}
