import type { Season } from "@/db/types";
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
  /** Custom-tag slug affinities (0044 pool) — matched on customTagSlugs. */
  tags: Record<string, number>;
}

/** A match's list item plus how well it fit the profile (absent on fallback). */
export type QuizResultItem = ProductListItem & { matchPct?: number };

export interface QuizResult {
  items: QuizResultItem[];
  fallback: boolean;
}

const RESULT_LIMIT = 6;

/**
 * `products.sillage` (0078) IS the intensity axis: the admin sets it by hand
 * and its three values are the quiz's three, so the profile is indexed with it
 * directly. Deriving intensity from concentration (the previous rule) was wrong
 * for half the catalogue — concentration is the bottle's type, not its reach:
 * Sauvage EDT carries further than many an Extrait. Indexing the profile with
 * the column below is what keeps the two unions in step — a value the quiz
 * doesn't know would not compile.
 */

const OPTION_WEIGHTS = new Map<string, QuizWeights>(
  QUIZ_QUESTIONS.flatMap((q) => q.options.map((o) => [o.id, o.weights])),
);

/** Accumulate the weight vectors of the picked options; unknown ids are ignored. */
export function buildProfile(picks: string[]): QuizProfile {
  const profile: QuizProfile = {
    families: {},
    seasons: {},
    intensity: {},
    tags: {},
  };
  for (const id of picks) {
    const w = OPTION_WEIGHTS.get(id);
    if (!w) continue;
    for (const [slug, n] of Object.entries(w.families ?? {}))
      profile.families[slug] = (profile.families[slug] ?? 0) + n;
    for (const [slug, n] of Object.entries(w.tags ?? {}))
      profile.tags[slug] = (profile.tags[slug] ?? 0) + n;
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

/**
 * How many matched tags one product may cash in.
 *
 * Tag overlap used to be a plain sum, which measured how thoroughly the admin
 * had tagged a product rather than how well it answered the quiz: across every
 * possible answer combination, products carrying 11 tags were recommended 5.6×
 * as often as products carrying 3. Counting only the two heaviest matches keeps
 * the signal (a scent that hits the strongest tags still wins) while a long
 * tail of weak tags stops buying rank — the same sweep now reads 2.8×, and the
 * remainder is the tagging genuinely describing the scent.
 */
const TAG_MATCH_LIMIT = 2;

/**
 * What a scent keeps when it contradicts the season the visitor asked for.
 *
 * Season used to be additive only (max weight 3), so a heavily tagged
 * autumn/winter scent outscored a true summer one on a summer answer — 21.7%
 * of all recommendations contradicted the season picked. Season is a
 * condition, not a nudge: a scent that answers none of the wanted seasons
 * keeps a little over half its score and drops below any honest match, but
 * stays eligible so a thin catalogue still fills the rail. The sweep now reads
 * 1.1%, and those are tail positions under 50%.
 */
const SEASON_MISMATCH_KEEP = 0.55;

/** A year-round scent genuinely answers any season; it just isn't a specialist. */
const ALL_SEASON_CREDIT = 0.5;

/** The n heaviest matched weights — what one product may actually cash in. */
function topMatches(
  slugs: string[],
  weights: Record<string, number | undefined>,
  limit: number,
): number {
  return slugs
    .map((s) => weights[s] ?? 0)
    .filter((n) => n > 0)
    .sort((a, b) => b - a)
    .slice(0, limit)
    .reduce((a, b) => a + b, 0);
}

function scoreProduct(
  p: ProductDetail,
  profile: QuizProfile,
  gender: QuizAnswers["gender"],
): number {
  let n = 0;

  // Family is the strongest signal, matching getRelated's ordering.
  for (const slug of p.scentFamilies) n += 2 * (profile.families[slug] ?? 0);

  // Custom tags carry the use-case/character answers the family axis can't.
  n += topMatches(p.customTagSlugs, profile.tags, TAG_MATCH_LIMIT);

  const seasonWeights = Object.values(profile.seasons).filter(
    (v): v is number => v != null,
  );
  const maxSeason = seasonWeights.length ? Math.max(...seasonWeights) : 0;
  for (const s of p.seasons) {
    n +=
      s === "all"
        ? maxSeason * ALL_SEASON_CREDIT
        : (profile.seasons[s] ?? 0);
  }

  n += profile.intensity[p.sillage] ?? 0;

  if (gender !== "any" && p.gender === gender) n += 1;

  // The penalty lands on the whole score, so no amount of tag overlap can buy
  // a winter-only scent onto a summer answer.
  if (maxSeason > 0 && !answersSeason(p, profile)) n *= SEASON_MISMATCH_KEEP;

  return n;
}

/**
 * Does the scent cover the season the answers actually lean on?
 *
 * Measured against the DOMINANT season, not merely a positive one: the season
 * question weighs 3 and the weekend question 2, so "Ойгоор алхах" (autumn) with
 * "Зун" would otherwise let a summer-only scent pass on an autumn answer. A
 * season within a quarter of the top weight still counts, so two answers that
 * genuinely agree on two seasons keep both.
 */
function answersSeason(p: ProductDetail, profile: QuizProfile): boolean {
  // Missing season data is a gap in the catalogue, not a contradiction.
  if (!p.seasons.length) return true;
  const weights = Object.values(profile.seasons).filter(
    (v): v is number => v != null,
  );
  const max = weights.length ? Math.max(...weights) : 0;
  return p.seasons.some(
    (s) => s === "all" || (profile.seasons[s] ?? 0) >= max * 0.75,
  );
}

/** The n heaviest weights of a vector — what one product could carry of it. */
function topWeights(rec: Record<string, number | undefined>, n: number): number {
  if (n <= 0) return 0;
  return Object.values(rec)
    .filter((v): v is number => v != null)
    .sort((a, b) => b - a)
    .slice(0, n)
    .reduce((a, b) => a + b, 0);
}

/** How many families / seasons / tags the fattest product in the pool carries. */
interface PoolShape {
  families: number;
  seasons: number;
  tags: number;
}

function poolShape(pool: ProductDetail[]): PoolShape {
  const shape: PoolShape = { families: 0, seasons: 0, tags: 0 };
  for (const p of pool) {
    shape.families = Math.max(shape.families, p.scentFamilies.length);
    shape.seasons = Math.max(shape.seasons, p.seasons.length);
    shape.tags = Math.max(shape.tags, p.customTagSlugs.length);
  }
  return shape;
}

/**
 * Best achievable score for this profile — the yardstick for both the "strong
 * match" threshold (≥25% of it) and the displayed percentage.
 *
 * Bounded by what a single product can actually carry rather than by the whole
 * weight vector: no scent wears six families or a dozen tags at once, and a
 * vector-wide sum would make every percentage sag as soon as an option gains
 * another tag weight — a display that drifts with the content file rather than
 * with the match. `shape` comes from the live pool, so the yardstick tracks how
 * richly the catalogue is actually tagged.
 */
function maxScore(
  profile: QuizProfile,
  gender: QuizAnswers["gender"],
  shape: PoolShape,
): number {
  const intensityValues = Object.values(profile.intensity).filter(
    (v): v is number => v != null,
  );
  return (
    2 * topWeights(profile.families, shape.families) +
    topWeights(profile.seasons, shape.seasons) +
    // Mirrors TAG_MATCH_LIMIT: the yardstick must measure the same ceiling the
    // scorer allows, or every percentage sags as products gain tags.
    topWeights(profile.tags, Math.min(shape.tags, TAG_MATCH_LIMIT)) +
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
    startingBasePrice: p.startingBasePrice,
    tags: p.tags,
    isFeatured: p.isFeatured,
    soldOut: p.soldOut,
    ratingAvg: p.ratingAvg,
    ratingCount: p.ratingCount,
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

  const best = maxScore(profile, answers.gender, poolShape(pool));
  const threshold = Math.max(1, best * 0.25);
  const scored = pool
    .map((p) => ({ p, s: scoreProduct(p, profile, answers.gender) }))
    .sort(rank);
  const hasStrong = scored.some((x) => best > 0 && x.s >= threshold);

  if (hasStrong) {
    // Lead with the strong matches; weaker positive scores pad the rail so a
    // small catalogue still fills it. The percentage is a normalized display
    // score — 96% ceiling so nothing ever claims a perfect match.
    return {
      items: scored
        .filter((x) => x.s > 0)
        .slice(0, RESULT_LIMIT)
        .map((x) => ({
          ...toListItem(x.p),
          matchPct: Math.min(96, Math.round((90 * x.s) / best) + 6),
        })),
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
