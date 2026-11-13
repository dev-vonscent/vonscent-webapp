import { SALE_EVENT_MAX_PCT } from "@/lib/constants";
import { SALE_EVENT_SLUG_RE } from "@/lib/validators/sale-event";
import type { OverlapConflict } from "../../lib";
import type { SaleEventPhase } from "../../types";
import {
  discountRange,
  pctSpan,
  type StudioDraft,
  type StudioStep,
} from "./studio-model";

/**
 * ⑤-р алхмын «Шалгах зүйлс» ба stepper-ийн төлөв (studio-ux.md §5.5, D2).
 * Цэвэр функц: ноорог → жагсаалт. `error` нь нийтлэхийг хориглоно, `warn`
 * нь асууж байж зөвшөөрнө, `note` нь зөвхөн мэдээлэл.
 */
export type ChecklistLevel = "ok" | "note" | "warn" | "error";

export interface ChecklistItem {
  step: StudioStep;
  level: ChecklistLevel;
  text: string;
  /** Алхам руу үсрэх товчны бичиг. */
  action: "Засах" | "Харах";
}

/**
 * Арга хэмжээтэй холбоотой баннерын (`heroes.sale_event_id`) тойм — хуудас
 * серверээс өгнө. Студи нэг арга хэмжээнд нэг баннер удирдана (D6);
 * `others` нь хуучин өгөгдөлд үлдсэн нэмэлт мөрийн тоо.
 */
export interface StudioBanner {
  id: string;
  thumb: string | null;
  hasDesktop: boolean;
  hasMobile: boolean;
  hasTitle: boolean;
  hasPrimaryLabel: boolean;
  isActive: boolean;
  others: number;
}

/** `getHeroesAdmin()`-ийн мөрөөс хэрэгтэй хэсэг. */
interface BannerRow {
  id: string;
  saleEventId: string | null;
  title: string;
  primaryLabel: string;
  isActive: boolean;
  desktopImage: { base: string } | null;
  mobileImage: { src: string } | null;
  updatedAt: string;
}

/** Арга хэмжээний баннер: хамгийн сүүлд шинэчлэгдсэн мөр (D6). */
export function studioBannerFor(
  heroes: readonly BannerRow[],
  eventId: string,
): StudioBanner | null {
  const linked = heroes
    .filter((h) => h.saleEventId === eventId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const h = linked[0];
  if (!h) return null;
  return {
    id: h.id,
    thumb: h.desktopImage ? `${h.desktopImage.base}-1600.webp` : null,
    hasDesktop: h.desktopImage !== null,
    hasMobile: h.mobileImage !== null,
    hasTitle: h.title.trim() !== "",
    hasPrimaryLabel: h.primaryLabel.trim() !== "",
    isActive: h.isActive,
    others: linked.length - 1,
  };
}

/** Баннерт юу дутуу байна (D6: хоёр зураг + гарчиг + гол товчны бичиг). */
export function bannerGaps(b: StudioBanner): string[] {
  const gaps: string[] = [];
  if (!b.hasDesktop) gaps.push("компьютерын зураг");
  if (!b.hasMobile) gaps.push("утасны зураг");
  if (!b.hasTitle) gaps.push("гарчиг");
  if (!b.hasPrimaryLabel) gaps.push("гол товчны бичиг");
  return gaps;
}

/** Дэлгүүрт гарахад бэлэн: бүрэн ба идэвхтэй. */
export function bannerReady(b: StudioBanner | null): boolean {
  return b !== null && b.isActive && bannerGaps(b).length === 0;
}

export function studioChecklist(input: {
  draft: StudioDraft;
  /** Өнөөдөр (УБ) `YYYY-MM-DD`. */
  today: string;
  /** Сүүлийн хадгалалтаас ирсэн давхцал (0181 `EVENT_OVERLAP`). */
  conflicts?: readonly OverlapConflict[];
  banner?: StudioBanner | null;
  /** `hero_admin` туг — хаалттай бол баннерын мөр гарахгүй. */
  bannerEnabled?: boolean;
}): ChecklistItem[] {
  const { draft: d, today, conflicts = [], banner = null } = input;
  const out: ChecklistItem[] = [];

  // ① Үндсэн
  const basics: string[] = [];
  if (!d.name.trim()) basics.push("Нэр оруулаагүй");
  if (!d.startsOn || !d.endsOn) {
    basics.push("Хугацаа сонгоогүй");
  } else if (d.endsOn < d.startsOn) {
    basics.push("Дуусах өдөр эхлэхээс өмнө байна");
  } else if (d.endsOn < today) {
    basics.push("Дуусах өдөр өнгөрсөн байна");
  }
  if (!SALE_EVENT_SLUG_RE.test(d.slug)) {
    basics.push("Холбоос буруу — латин жижиг үсэг, тоо, зураас");
  }
  if (basics.length) {
    for (const text of basics) {
      out.push({ step: "basics", level: "error", text, action: "Засах" });
    }
  } else {
    out.push({
      step: "basics",
      level: "ok",
      text: "Нэр, хугацаа",
      action: "Засах",
    });
  }

  // ② Бараа, хямдрал
  const r = discountRange(d.items);
  if (r.count === 0) {
    out.push({
      step: "products",
      level: "error",
      text: "Бараа сонгоогүй — дор хаяж нэг бараа хэрэгтэй",
      action: "Засах",
    });
  } else if (r.invalid > 0) {
    out.push({
      step: "products",
      level: "error",
      text: `${r.invalid} барааны хувь буруу — 1–${SALE_EVENT_MAX_PCT} бүхэл тоо`,
      action: "Засах",
    });
  } else {
    const span = pctSpan(r);
    out.push({
      step: "products",
      level: "ok",
      text: `${r.count} бараа, ${span ? `хямдрал ${span}` : "хувьгүй"}`,
      action: "Засах",
    });
  }
  const byEvent = new Map<string, number>();
  for (const c of conflicts) {
    byEvent.set(c.event, (byEvent.get(c.event) ?? 0) + 1);
  }
  for (const [event, n] of byEvent) {
    out.push({
      step: "products",
      level: "error",
      text: `${n} бараа «${event}» арга хэмжээтэй давхцаж байна`,
      action: "Харах",
    });
  }

  // ③ Каталогт харагдах — өгөгдмөл нь бэлэн, заавал биш.
  out.push({
    step: "catalog",
    level: "ok",
    text: "Каталогийн текст",
    action: "Засах",
  });

  // ④ Нүүрний баннер
  if (input.bannerEnabled) {
    if (!banner) {
      out.push({
        step: "banner",
        level: "note",
        text: "Нүүрний баннер байхгүй — нүүр хуудасны баннер солигдохгүй",
        action: "Харах",
      });
    } else {
      const gaps = bannerGaps(banner);
      out.push(
        gaps.length
          ? {
              step: "banner",
              level: "warn",
              text: `Нүүрний баннер — ${gaps.join(", ")} дутуу`,
              action: "Харах",
            }
          : banner.isActive
            ? {
                step: "banner",
                level: "ok",
                text: "Нүүрний баннер бэлэн",
                action: "Харах",
              }
            : {
                step: "banner",
                level: "warn",
                text: "Нүүрний баннер идэвхгүй — нүүр хуудсанд гарахгүй",
                action: "Харах",
              },
      );
    }
  }
  return out;
}

/** Нийтлэхийг хориглох зүйл байна уу. */
export function hasBlocking(items: readonly ChecklistItem[]): boolean {
  return items.some((i) => i.level === "error");
}

/** Жагсаалтын картын нэг мөр анхааруулга: эхний улаан, эс бөгөөс улбар. */
export function firstProblem(
  items: readonly ChecklistItem[],
): ChecklistItem | null {
  return (
    items.find((i) => i.level === "error") ??
    items.find((i) => i.level === "warn") ??
    null
  );
}

/** Stepper-ийн төлөв: ✓ бэлэн · ○ хийгээгүй · ! анхаарах зүйлтэй (D2). */
export type StepStatus = "done" | "todo" | "attention";

export function stepStatus(
  step: StudioStep,
  items: readonly ChecklistItem[],
  /** null = мөр хараахан үүсээгүй: бүгд «хийгээгүй». */
  phase: SaleEventPhase | null,
): StepStatus {
  if (phase === null) return "todo";
  if (step === "review") return phase === "draft" ? "todo" : "done";
  const own = items.filter((i) => i.step === step);
  if (own.some((i) => i.level === "error" || i.level === "warn")) {
    return "attention";
  }
  if (own.some((i) => i.level === "note")) return "todo";
  return "done";
}

/**
 * Нээгдэх алхам (D2): URL-д хүчинтэй алхам байвал тэр; шинэ бол ①; засах үед
 * ⑤ — зөвхөн ноорог нь дутуу бол эхний дутуу алхам.
 */
export function openingStep(input: {
  requested: StudioStep | null;
  phase: SaleEventPhase | null;
  items: readonly ChecklistItem[];
  steps: readonly StudioStep[];
}): StudioStep {
  const { requested, phase, items, steps } = input;
  if (phase === null) return "basics";
  if (requested) return requested;
  if (phase === "draft") {
    const missing = steps.find((s) =>
      items.some((i) => i.step === s && i.level === "error"),
    );
    if (missing) return missing;
  }
  return "review";
}
