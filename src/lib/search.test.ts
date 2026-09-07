import { describe, expect, it } from "vitest";
import {
  isSearchable,
  matchesSearch,
  normalizeSearchText,
  searchTerms,
} from "./search";

describe("normalizeSearchText", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeSearchText("Hermès Terre d'Hermès")).toBe(
      "hermes terre d'hermes",
    );
  });

  it("transliterates Mongolian Cyrillic to Latin", () => {
    expect(normalizeSearchText("Диор")).toBe("dior");
    expect(normalizeSearchText("Түмэн")).toBe("tumen");
  });
});

describe("matchesSearch", () => {
  it("matches Cyrillic queries against Latin names", () => {
    expect(matchesSearch("Dior Sauvage", "диор")).toBe(true);
    expect(matchesSearch("Tom Ford Oud Wood", "том форд")).toBe(true);
  });

  it("matches terms in any order", () => {
    expect(matchesSearch("Dior Sauvage", "sauvage dior")).toBe(true);
  });

  it("rejects when any term is missing", () => {
    expect(matchesSearch("Dior Sauvage", "диор хомм")).toBe(false);
  });

  it("still matches plain Latin and Cyrillic tags", () => {
    expect(matchesSearch("Bleu de Chanel оффис", "оффис")).toBe(true);
  });
});

describe("searchTerms", () => {
  it("folds and splits the query the way global_search() expects", () => {
    expect(searchTerms("  Диор   Соваж ")).toEqual(["dior", "sovaj"]);
  });

  it("drops empty terms", () => {
    expect(searchTerms("   ")).toEqual([]);
  });
});

describe("isSearchable", () => {
  it("needs at least MIN_SEARCH_LENGTH folded characters", () => {
    expect(isSearchable("t")).toBe(false);
    expect(isSearchable("  т  ")).toBe(false);
    expect(isSearchable("то")).toBe(true);
    expect(isSearchable("")).toBe(false);
  });

  it("counts the folded form, not the typed one", () => {
    // «ь» нь хэвийн болгоход алга болдог тул «ть» нь нэг л тэмдэгт.
    expect(isSearchable("ть")).toBe(false);
    // «ц» → "ts": нэг үсэг ч хангалттай урт болно.
    expect(isSearchable("ц")).toBe(true);
  });
});
