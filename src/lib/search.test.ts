import { describe, expect, it } from "vitest";
import { matchesSearch, normalizeSearchText } from "./search";

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
