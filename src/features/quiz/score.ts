import type { Concentration, Season } from "@/db/types";
import type { ProductDetail, ProductListItem } from "@/lib/types";
import {
  QUIZ_QUESTIONS,
  type Intensity,
  type QuizAnswers,
  type QuizWeights,
} from "./questions";

/**
 * Pure quiz scorer (mirrors the getRelated() approach in
 * src/features/products/api.ts: weighted attribute overlap, family heaviest).
 * Kept free of "server-only" so both the API route and unit tests can use it.
 */

export interface QuizProfile {
  families: Record<string, number>;
  seasons: Partial<Record<Season, number>>;
  intensity: Partial<Record<Intensity, number>>;
}

export interface QuizResult {
  items: ProductListItem[];
  fallback: boolean;
}

const RESULT_LIMIT = 6;

/** No sillage column exists — intensity is derived from concentration. */
const INTENSITY_BY_CONCENTRATION: Record<Concentration, Intensity> = {
  EDC: "light",
  EDT: "light",
  EDP: "medium",
  Parfum: "strong",
  Extrait: "strong",
  Elixir: "strong",
};

const OPTION_WEIGHTS = new Map<string, QuizWeights>(
  QUIZ_QUESTIONS.flatMap((q) => q.options.map((o) => [o.id, o.weights])),
);

/** Accumulate the weight vectors of the picked options; unknown ids are ignored. */
export function buildProfile(picks: string[]): QuizProfile {
  const profile: QuizProfile = { families: {}, seasons: {}, intensity: {} };
  for (const id of picks) {
    const w = OPTION_WEIGHTS.get(id);
    if (!w) continue;
    for (const [slug, n] of Object.entries(w.families ?? {}))
      profile.families[slug] = (profile.families[slug] ?? 0) + n;
    for (const [s, n] of Object.entries(w.seasons ?? {}))
      profile.seasons[s as Season] = (profile.seasons[s as Season] ?? 0) + n!;
    for (const [i, n] of Object.entries(w.intensity ?? {}))
      profile.intensity[i as Intensity] =
        (profile.intensity[i as Intensity] ?? 0) + n!;
  }
  return profile;
}

function matchesGender(
  p: ProductDetail,
  gender: QuizAnswers["gender"],
): boolean {
  if (gender === "any") return true;
  return p.gender === gender || p.gender === "unisex";
}

function scoreProduct(
  p: ProductDetail,
  profile: QuizProfile,
  gender: QuizAnswers["gender"],
): number {
  let n = 0;

  // Family is the strongest signal, matching getRelated's ordering.
  for (const slug of p.scentFamilies) n += 2 * (profile.families[slug] ?? 0);

  const seasonWeights = Object.values(profile.seasons).filter(
    (v): v is number => v != null,
  );
  const maxSeason = seasonWeights.length ? Math.max(...seasonWeights) : 0;
  for (const s of p.seasons) {
    // A year-round scent answers every season preference at half credit.
    n += s === "all" ? maxSeason / 2 : (profile.seasons[s] ?? 0);
  }

  n += profile.intensity[INTENSITY_BY_CONCENTRATION[p.concentration]] ?? 0;

  if (gender !== "any" && p.gender === gender) n += 1;

  return n;
}

/**
 * Best achievable score for this profile — used to decide whether a match is
 * "strong" (≥25% of it). A product could in theory carry every weighted family
 * and season at once, so this is a loose but stable upper bound.
 */
function maxScore(profile: QuizProfile, gender: QuizAnswers["gender"]): number {
  const sum = (rec: Record<string, number | undefined>) =>
    Object.values(rec).reduce<number>((a, b) => a + (b ?? 0), 0);
  const intensityValues = Object.values(profile.intensity).filter(
    (v): v is number => v != null,
  );
  return (
    2 * sum(profile.families) +
    sum(profile.seasons) +
    (intensityValues.length ? Math.max(...intensityValues) : 0) +
    (gender === "any" ? 0 : 1)
  );
}

function toListItem(p: ProductDetail): ProductListItem {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    brand: p.brand,
    gender: p.gender,
    concentration: p.concentration,
    scentFamilies: p.scentFamilies,
    seasons: p.seasons,
    image: p.image,
    startingPrice: p.startingPrice,
    tags: p.tags,
    soldOut: p.soldOut,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
    salePct: p.salePct,
    createdAt: p.createdAt,
  };
}

/** Rating dampened by count so one 5★ review can't outrank a proven scent. */
function popularity(p: ProductDetail): number {
  return p.ratingAvg * Math.min(p.ratingCount, 10);
}

function rank(a: { p: ProductDetail; s: number }, b: typeof a): number {
  return (
    b.s - a.s ||
    popularity(b.p) - popularity(a.p) ||
    b.p.createdAt.localeCompare(a.p.createdAt)
  );
}

export function scoreQuizMatches(
  all: ProductDetail[],
  answers: QuizAnswers,
): QuizResult {
  const profile = buildProfile(answers.picks);
  const pool = all.filter(
    (p) => !p.soldOut && matchesGender(p, answers.gender),
  );

  const best = maxScore(profile, answers.gender);
  const threshold = Math.max(1, best * 0.25);
  const scored = pool
    .map((p) => ({ p, s: scoreProduct(p, profile, answers.gender) }))
    .sort(rank);
  const hasStrong = scored.some((x) => best > 0 && x.s >= threshold);

  if (hasStrong) {
    // Lead with the strong matches; weaker positive scores pad the rail so a
    // small catalogue still fills it.
    return {
      items: scored
        .filter((x) => x.s > 0)
        .slice(0, RESULT_LIMIT)
        .map((x) => toListItem(x.p)),
      fallback: false,
    };
  }

  // Weak profile (everything skipped) or a thin catalogue: fall back to the
  // best sellers that still respect the gender pick.
  const hot = pool.filter((p) => p.tags.includes("hot"));
  const fallbackPool = (hot.length ? hot : pool)
    .map((p) => ({ p, s: 0 }))
    .sort(rank)
    .slice(0, RESULT_LIMIT)
    .map((x) => toListItem(x.p));
  return { items: fallbackPool, fallback: true };
}
