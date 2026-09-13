import { describe, it, expect } from "vitest";
import type { ProductDetail } from "@/lib/types";
import { buildProfile, scoreQuizMatches } from "./score";

/** Minimal product fixture — only the fields the scorer reads matter. */
function product(
  overrides: Partial<ProductDetail> & { id: string },
): ProductDetail {
  return {
    slug: overrides.id,
    name: overrides.id,
    brand: "Test",
    gender: "unisex",
    concentration: "EDP",
    sillage: "medium",
    scentFamilies: [],
    seasons: [],
    image: null,
    startingPrice: 50000,
    tags: [],
    isFeatured: false,
    soldOut: false,
    ratingAvg: 0,
    ratingCount: 0,
    startingBasePrice: 50000,
    createdAt: "2026-01-01T00:00:00Z",
    description: "",
    notesDescription: "",
    usageDescription: "",
    notesTop: [],
    notesHeart: [],
    notesBase: [],
    originCountry: null,
    releaseYear: null,
    images: [],
    variants: [],
    availableMl: 100,
    bottleMl: 100,
    customTags: [],
    customTagSlugs: [],
    ...overrides,
  };
}

describe("buildProfile", () => {
  it("accumulates weights across picks", () => {
    // weekend-forest: woody+2 fresh+1 autumn+2; character-calm: woody+2
    const p = buildProfile(["weekend-forest", "character-calm"]);
    expect(p.families.woody).toBe(4);
    expect(p.families.fresh).toBe(1);
    expect(p.seasons.autumn).toBe(2);
  });

  it("ignores unknown option ids", () => {
    const p = buildProfile(["nonsense", "weekend-beach"]);
    expect(p.families.citrus).toBe(2);
    expect(Object.keys(p.families)).not.toContain("nonsense");
  });
});

describe("scoreQuizMatches", () => {
  const woodyMan = product({
    id: "woody-man",
    gender: "male",
    concentration: "Parfum",
    scentFamilies: ["woody"],
    seasons: ["autumn", "winter"],
  });
  const floralWoman = product({
    id: "floral-woman",
    gender: "female",
    scentFamilies: ["floral"],
    seasons: ["spring"],
  });
  const freshUnisex = product({
    id: "fresh-unisex",
    concentration: "EDT",
    scentFamilies: ["fresh", "citrus"],
    seasons: ["summer"],
  });
  const allSeason = product({
    id: "all-season",
    scentFamilies: ["woody"],
    seasons: ["all"],
  });
  const catalogue = [woodyMan, floralWoman, freshUnisex, allSeason];

  const woodyAnswers = {
    gender: "male" as const,
    picks: ["weekend-forest", "character-calm", "impression-bold"],
  };

  it("filters by gender but keeps unisex", () => {
    const { items } = scoreQuizMatches(catalogue, woodyAnswers);
    const ids = items.map((i) => i.id);
    expect(ids).not.toContain("floral-woman");
    expect(ids).toContain("all-season"); // unisex survives a male pick
  });

  it("ranks the family match first", () => {
    const { items, fallback } = scoreQuizMatches(catalogue, woodyAnswers);
    expect(fallback).toBe(false);
    expect(items[0].id).toBe("woody-man");
  });

  it("gives year-round scents season credit", () => {
    const onlyWoody = [
      product({ id: "a", scentFamilies: ["woody"], seasons: ["summer"] }),
      product({ id: "b", scentFamilies: ["woody"], seasons: ["all"] }),
      product({ id: "c", scentFamilies: ["woody"], seasons: [] }),
    ];
    const { items } = scoreQuizMatches(onlyWoody, {
      gender: "any",
      picks: ["weekend-forest"], // autumn+2
    });
    const pos = (id: string) => items.findIndex((i) => i.id === id);
    expect(pos("b")).toBeLessThan(pos("a"));
    expect(pos("b")).toBeLessThan(pos("c"));
  });

  it("excludes sold-out products", () => {
    const withSoldOut = [
      ...catalogue,
      product({ id: "gone", scentFamilies: ["woody"], soldOut: true }),
    ];
    const { items } = scoreQuizMatches(withSoldOut, woodyAnswers);
    expect(items.map((i) => i.id)).not.toContain("gone");
  });

  it("falls back to best sellers when everything is skipped", () => {
    const withHot = [
      ...catalogue,
      product({
        id: "hot-one",
        tags: ["hot"],
        ratingAvg: 4.8,
        ratingCount: 20,
      }),
    ];
    const { items, fallback } = scoreQuizMatches(withHot, {
      gender: "any",
      picks: [],
    });
    expect(fallback).toBe(true);
    expect(items[0].id).toBe("hot-one");
  });

  it("scales the percentage by what a product can carry, not by the vector", () => {
    // Products wear one tag each, so a fat weight vector must not deflate the
    // display: a leader that matches everything it possibly could reads high.
    const oneTagEach = [
      product({ id: "match", customTagSlugs: ["oud"] }),
      product({ id: "other", customTagSlugs: ["rose"] }),
    ];
    const { items } = scoreQuizMatches(oneTagEach, {
      gender: "any",
      picks: ["time-night"], // oud+2 smoky+1 party+1 luxurious+1, oriental/woody
    });
    expect(items[0].id).toBe("match");
    expect(items[0].matchPct).toBeGreaterThan(50);
  });

  it("keeps a season contradiction off the top, however well tagged", () => {
    // «Зун» + далай: a winter-only scent wearing every tag the answers touch
    // must still lose to an honest summer match (audit: 21.7% of results used
    // to contradict the season picked).
    const summerAnswers = {
      gender: "any" as const,
      picks: ["weekend-beach", "season-summer"],
    };
    const items = scoreQuizMatches(
      [
        product({
          id: "winter-overtagged",
          scentFamilies: ["citrus", "fresh"],
          seasons: ["winter"],
          customTagSlugs: ["marine", "sport", "fruity", "clean", "daily"],
        }),
        product({
          id: "honest-summer",
          scentFamilies: ["citrus"],
          seasons: ["summer"],
          customTagSlugs: ["marine"],
        }),
      ],
      summerAnswers,
    ).items;
    expect(items[0].id).toBe("honest-summer");
  });

  it("does not let a long tag list buy rank", () => {
    // Both wear the two heaviest tags of the answer; the difference is only
    // how many further weak tags the admin happened to add.
    const { items } = scoreQuizMatches(
      [
        product({
          id: "many-tags",
          customTagSlugs: ["oud", "smoky", "party", "luxurious"],
        }),
        product({
          id: "few-tags",
          customTagSlugs: ["oud", "smoky"],
          ratingAvg: 4.5,
          ratingCount: 20,
        }),
      ],
      { gender: "any", picks: ["time-night"] },
    );
    // Equal capped tag scores, so the proven scent wins the tie-break instead
    // of being buried by the extra tags.
    expect(items[0].id).toBe("few-tags");
  });

  it("reads intensity from sillage, not from the bottle type", () => {
    // 0078: an EDT can carry a room and an Extrait can sit on the skin, so the
    // admin's sillage decides — the concentration is deliberately inverted here.
    const { items } = scoreQuizMatches(
      [
        product({
          id: "loud-edt",
          concentration: "EDT",
          sillage: "strong",
        }),
        product({
          id: "quiet-extrait",
          concentration: "Extrait",
          sillage: "light",
        }),
      ],
      { gender: "any", picks: ["impression-bold"] }, // intensity.strong + 3
    );
    expect(items[0].id).toBe("loud-edt");
  });

  it("returns an empty fallback for an empty catalogue", () => {
    const result = scoreQuizMatches([], woodyAnswers);
    expect(result).toEqual({ items: [], fallback: true });
  });

  it("breaks score ties deterministically by damped popularity", () => {
    const twins = [
      product({
        id: "loved",
        scentFamilies: ["woody"],
        ratingAvg: 4.5,
        ratingCount: 50,
      }),
      product({
        id: "one-review",
        scentFamilies: ["woody"],
        ratingAvg: 5,
        ratingCount: 1,
      }),
    ];
    const { items } = scoreQuizMatches(twins, {
      gender: "any",
      picks: ["character-calm"],
    });
    // 4.5×10 beats 5×1 — a proven scent outranks a single 5★ review.
    expect(items[0].id).toBe("loved");
  });
});
