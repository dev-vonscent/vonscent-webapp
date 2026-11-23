import type { HomeCampaign } from "@/features/marketing/home-content";
import { seasonHeroAt } from "./season";
import type {
  HeroAdminRow,
  HeroDesktopImage,
  HeroEventOption,
  HeroTarget,
  LiveHero,
} from "./types";

/**
 * Баннерын зураг аль AI ажлаас «Ашиглах»-аар ирсэн бэ — `processHeroImage`
 * замд `gen-<jobId>-` гэж бичдэг. Өөрөө оруулсан / хуучин зураг → null.
 */
export function generationIdOf(url: string | null | undefined): string | null {
  return (
    /\/gen-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-/u.exec(
      url ?? "",
    )?.[1] ?? null
  );
}

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
      // Шууд каталог руу: `/sale/[slug]` нь 307 (илүү хүсэлт, Link prefetch
      // хийгдэхгүй) — тэр богино хаяг сошиалд л үлдэнэ (fixes F3).
      return `/catalog?event=${t.slug}`;
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

/** Арга хэмжээ `at` мөчид LIVE эсэх — `live_hero()`-ийн `live_events`. */
export function eventLiveAt(e: HeroEventOption, at: number): boolean {
  return (
    e.isActive && Date.parse(e.startsAt) <= at && at < Date.parse(e.endsAt)
  );
}

export type HeroTargetBlockReason = "draft" | "scheduled" | "ended" | "missing";

export interface HeroTargetBlock {
  slug: string;
  /** null = арга хэмжээ олдсонгүй (дууссан эсвэл `sale_events` туг хаалттай). */
  name: string | null;
  reason: HeroTargetBlockReason;
  startsAt: string | null;
}

/**
 * Hero-гийн товч (primary, secondary) LIVE биш арга хэмжээ рүү заавал hero
 * дэлгүүрт ГАРАХГҮЙ — `live_hero()`-ийн `exists (… live_events x where
 * x.slug = …)`-тэй ижил дүрэм. Шалтгааныг буцаана; гарах бол null.
 * `events` — `getHeroEventOptions()` (дууссан болон туг хаалттай бол хоосон
 * → `missing`).
 */
export function heroTargetBlock(
  h: Pick<HeroAdminRow, "primaryTarget" | "secondaryTarget">,
  events: readonly HeroEventOption[],
  at: number,
): HeroTargetBlock | null {
  for (const t of [h.primaryTarget, h.secondaryTarget]) {
    if (!t || t.type !== "event") continue;
    const e = events.find((x) => x.slug === t.slug);
    if (!e) return { slug: t.slug, name: null, reason: "missing", startsAt: null };
    const base = { slug: e.slug, name: e.name, startsAt: e.startsAt };
    if (!e.isActive) return { ...base, reason: "draft" };
    if (at < Date.parse(e.startsAt)) return { ...base, reason: "scheduled" };
    if (at >= Date.parse(e.endsAt)) return { ...base, reason: "ended" };
  }
  return null;
}

/**
 * Маягтын анхааруулга: hero-гийн хугацааны зарим хэсэгт товчны арга хэмжээ
 * LIVE биш бол (эхлэхээс өмнө, дууссаны дараа, ноорог) тэр арга хэмжээг
 * буцаана — hero тэр хэсэгт гарахгүй. Хадгалахыг хориглохгүй.
 */
export function targetOutsidePeriod(
  period: { startsAt: string; endsAt: string } | null,
  target: HeroTarget | null,
  events: readonly HeroEventOption[],
): HeroEventOption | null {
  if (!target || target.type !== "event") return null;
  const e = events.find((x) => x.slug === target.slug);
  if (!e) return null;
  if (!e.isActive) return e;
  if (!period) return null;
  return Date.parse(period.startsAt) < Date.parse(e.startsAt) ||
    Date.parse(period.endsAt) > Date.parse(e.endsAt)
    ? e
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
 * `t` мөчид дэлгүүрт гарах DB hero — `live_hero()`-ийн дүрэм: идэвхтэй,
 * зурагтай, хугацаандаа (холбоотой бол арга хэмжээ нь LIVE), товчны арга
 * хэмжээ LIVE (`heroTargetBlock`), priority их нь, дараа нь сүүлд эхэлсэн нь.
 * Аль нь ч үгүй бол тэр мөчийн улирлын баннер (0185, `seasonHeroAt`).
 */
export function heroAt(
  heroes: readonly HeroAdminRow[],
  events: readonly HeroEventOption[],
  t: number,
): HeroAdminRow | null {
  let best: { h: HeroAdminRow; start: number } | null = null;
  for (const h of heroes) {
    if (h.season) continue;
    if (!h.isActive || !h.desktopImage || !h.mobileImage) continue;
    const p = heroPeriod(h, events);
    if (!p || !p.eventActive) continue;
    const start = Date.parse(p.startsAt);
    if (!(start <= t && t < Date.parse(p.endsAt))) continue;
    if (heroTargetBlock(h, events, t)) continue;
    if (
      !best ||
      h.priority > best.h.priority ||
      (h.priority === best.h.priority &&
        (start > best.start || (start === best.start && h.id < best.h.id)))
    )
      best = { h, start };
  }
  if (best) return best.h;
  const season = seasonHeroAt(heroes, t);
  if (!season || heroTargetBlock(season.row, events, t)) return null;
  return season.row;
}

/**
 * Ирэх N хоногийн хуваарь (plan §9.2): өдөр бүрийн УБ 12:00-д аль hero гарах
 * вэ (`heroAt` — `live_hero()`-тэй ижил дүрэм, товчны арга хэмжээ ч орно),
 * дараалсан ижил өдрүүдийг нэг хэсэг болгоно.
 */
export function heroSchedule(
  heroes: readonly HeroAdminRow[],
  events: readonly HeroEventOption[],
  now: number,
  days = 90,
): ScheduleSegment[] {
  const today = dayKey(now);
  const startNoon = Date.parse(`${today}T12:00:00+08:00`);
  const out: ScheduleSegment[] = [];
  for (let i = 0; i < days; i++) {
    const t = startNoon + i * 86_400_000;
    const live = heroAt(heroes, events, t);
    const heroId = live?.id ?? null;
    const day = dayKey(t);
    const last = out[out.length - 1];
    if (last && last.heroId === heroId) last.to = day;
    else
      out.push({
        from: day,
        to: day,
        heroId,
        label: live?.name ?? "Кодын hero",
      });
  }
  return out;
}

/** `live_heroes()`-ийн кэшээс одоо гарах эхний hero (fixes F5). */
export function pickLiveHero<T extends { startsAt: string; endsAt: string }>(
  rows: readonly T[],
  now: number,
): T | null {
  return (
    rows.find(
      (r) => Date.parse(r.startsAt) <= now && now < Date.parse(r.endsAt),
    ) ?? null
  );
}
