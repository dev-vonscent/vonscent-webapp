import { HERO_LIMITS as L, type HeroSeason } from "@/lib/constants";
import type { HeroTarget } from "./types";

/**
 * Арга хэмжээний баннерын бэлэн текст (studio-ux.md §6.2). Баннер анх үүсэх
 * мөчид нэг удаа бөглөнө — дараа нь админы бичсэнийг дарахгүй.
 */
export interface HeroCopy {
  eyebrow: string;
  title: string;
  description: string;
  mobileDescription: string;
  primaryLabel: string;
  primaryTarget: HeroTarget;
  secondaryLabel: string;
  secondaryTarget: HeroTarget | null;
}

/** `2026-11-23` → «11/23». Хоосон бол "". */
export function monthDay(day: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})$/u.exec(day);
  return m ? `${Number(m[1])}/${Number(m[2])}` : "";
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max).trimEnd();
}

export function defaultHeroCopy(event: {
  name: string;
  headline: string;
  slug: string;
  startsOn: string;
  endsOn: string;
  /** Хамгийн их хувь; хувьгүй «сонголт» арга хэмжээнд null. */
  maxPct: number | null;
}): HeroCopy {
  const name = event.name.trim();
  const start = monthDay(event.startsOn);
  const end = monthDay(event.endsOn);
  const dates = start && end ? (start === end ? start : `${start}–${end}`) : "";
  const full = [name, dates].filter(Boolean).join(" · ");
  const eyebrow = full.length <= L.eyebrow ? full : clip(dates || name, L.eyebrow);
  const pct = event.maxPct;
  return {
    eyebrow,
    title: clip(event.headline.trim() || name, L.title),
    description: clip(
      pct
        ? `Сонгосон үнэртнүүд ${pct}% хүртэл хямдарлаа.${end ? ` ${end} хүртэл.` : ""}`
        : "Энэ удаагийн онцгой сонголттой танилцаарай.",
      L.description,
    ),
    mobileDescription: pct ? `${pct}% хүртэл хямдрал` : "",
    primaryLabel: pct ? "Хямдралыг үзэх" : "Сонголтыг үзэх",
    primaryTarget: { type: "event", slug: event.slug },
    secondaryLabel: "",
    secondaryTarget: null,
  };
}

const SEASON_ADJ: Record<HeroSeason, string> = {
  spring: "Хаврын",
  summer: "Зуны",
  autumn: "Намрын",
  winter: "Өвлийн",
};
const SEASON_DATIVE: Record<HeroSeason, string> = {
  spring: "Хаварт",
  summer: "Зунд",
  autumn: "Намарт",
  winter: "Өвөлд",
};

/**
 * Улирлын баннерын бэлэн текст (studio-ux.md D9) — одоогийн кодын улирлын
 * баннерын хэлбэрээр. Гол товч тухайн улирлын үнэртэн рүү.
 */
export function defaultSeasonCopy(season: HeroSeason): HeroCopy {
  return {
    eyebrow: "Энэ улирлын сонголт",
    title: `${SEASON_ADJ[season]} тансаг үнэртнүүд`,
    description: `${SEASON_DATIVE[season]} тохирох үнэртнүүдийг бүтнээр нь авалгүй хямд өртгөөр туршаад үзээрэй.`,
    mobileDescription: "Бүтнээр нь авалгүй хямд өртгөөр туршаарай.",
    primaryLabel: `${SEASON_ADJ[season]} үнэртэн`,
    primaryTarget: { type: "season", value: season },
    secondaryLabel: "Бүх үнэртэн",
    secondaryTarget: { type: "path", href: "/catalog" },
  };
}
