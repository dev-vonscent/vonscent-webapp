/**
 * Search-text normalization shared by catalog / type-ahead matching.
 *
 * Perfume names are Latin ("Dior Sauvage") but customers type Cyrillic
 * ("диор саваж") and vice versa, so both sides of a comparison are folded to
 * the same space: lowercase, accents stripped, Cyrillic transliterated to
 * Latin. Matching stays in JS because the whole catalog is already cached
 * in memory (fetchProducts) — no SQL search path to extend with pg_trgm.
 */

/** Mongolian + Russian Cyrillic → Latin, longest-first where it matters. */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "j",
  з: "z",
  и: "i",
  й: "i",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  ө: "u",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ү: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ъ: "",
  ы: "i",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

/** Lowercase, strip diacritics, transliterate Cyrillic → Latin. */
export function normalizeSearchText(text: string): string {
  const folded = text
    .toLowerCase()
    // é → e, ï → i … (perfume names are full of them: Guerlain, Hermès)
    .normalize("NFKD")
    .replace(/\p{Mn}/gu, "");
  let out = "";
  for (const ch of folded) {
    out += CYRILLIC_TO_LATIN[ch] ?? ch;
  }
  return out;
}

/**
 * Loose containment: every whitespace-separated term of `query` must appear
 * somewhere in the normalized haystack, in any order.
 */
export function matchesSearch(haystack: string, query: string): boolean {
  const hay = normalizeSearchText(haystack);
  return normalizeSearchText(query)
    .split(/\s+/u)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}
