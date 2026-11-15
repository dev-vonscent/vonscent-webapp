import { HERO_LINK_PRESETS } from "@/lib/constants";
import type { HeroTarget } from "./types";

/**
 * Баннерын товчны «Дарахад хаашаа очих вэ?» сонголтын цэвэр хэсэг
 * (studio-ux.md D5). Админд `HeroTarget`-ийн төрөл огт харагдахгүй.
 */
export interface HeroLinkOption {
  key: string;
  label: string;
  target: HeroTarget;
  group?: "season";
}

export const EVENT_LINK_KEY = "event";
export const CUSTOM_LINK_KEY = "custom";

/**
 * Сонголтын жагсаалт. `eventSlug` өгвөл эхэнд нь «Энэ арга хэмжээний
 * бараанууд» (санал болгосон). Өөр арга хэмжээ рүү заах сонголт студид
 * байхгүй (fixes.md F2-ийн урхи).
 */
export function heroLinkOptions(input: {
  eventSlug?: string | null;
  isEnabled: (flag: string) => boolean;
}): HeroLinkOption[] {
  const out: HeroLinkOption[] = [];
  if (input.eventSlug) {
    out.push({
      key: EVENT_LINK_KEY,
      label: "Энэ арга хэмжээний бараанууд",
      target: { type: "event", slug: input.eventSlug },
    });
  }
  for (const p of HERO_LINK_PRESETS) {
    if ("flag" in p && !input.isEnabled(p.flag)) continue;
    out.push({
      key: p.key,
      label: p.label,
      target: p.target as HeroTarget,
      ...("group" in p ? { group: p.group } : {}),
    });
  }
  return out;
}

export function sameTarget(a: HeroTarget, b: HeroTarget): boolean {
  switch (a.type) {
    case "event":
      return b.type === "event" && a.slug === b.slug;
    case "season":
      return b.type === "season" && a.value === b.value;
    case "catalog":
      return (
        b.type === "catalog" &&
        a.query.replace(/^\?/u, "") === b.query.replace(/^\?/u, "")
      );
    case "path":
      return b.type === "path" && a.href === b.href;
  }
}

/** Одоогийн зорилт аль сонголт вэ — таарахгүй бол «Өөр хуудас…». */
export function linkOptionKey(
  target: HeroTarget,
  options: readonly HeroLinkOption[],
): string {
  return options.find((o) => sameTarget(o.target, target))?.key ?? CUSTOM_LINK_KEY;
}

/**
 * ①-д холбоосоо өөрчилбөл энэ арга хэмжээ рүү заасан товч дагана (D5):
 * `fromSlugs`-ийн аль нэг рүү заасан event зорилтыг `toSlug` болгоно.
 */
export function rebindEventTarget<T extends HeroTarget | null>(
  target: T,
  fromSlugs: readonly string[],
  toSlug: string,
): T {
  if (target?.type === "event" && fromSlugs.includes(target.slug)) {
    return { type: "event", slug: toSlug } as T;
  }
  return target;
}
