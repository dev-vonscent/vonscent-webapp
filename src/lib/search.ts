import { MIN_SEARCH_LENGTH } from "@/lib/constants";

/**
 * Search-text normalization shared by catalog / type-ahead matching.
 *
 * Perfume names are Latin ("Dior Sauvage") but customers type Cyrillic
 * ("диор саваж") and vice versa, so both sides of a comparison are folded to
 * the same space: lowercase, accents stripped, Cyrillic transliterated to
 * Latin.
 *
 * Шүүлт нь өөрөө Postgres дээр хийгддэг (0057_search.sql): энэ файл нь хайх
 * ҮГИЙГ хэвийн болгож `search_normalize()`-тэй нэг талбарт оруулах үүрэгтэй.
 * `matchesSearch()` нь зөвхөн demo/нөөц зам дээр үлдсэн.
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

/**
 * Strip diacritics, lowercase, transliterate Cyrillic → Latin.
 *
 * Decomposition runs BEFORE the lowercasing so that a compatibility character
 * which unfolds into letters (№ → "No", ﬁ → "fi") is lowercased afterwards
 * like any other text. Postgres' `search_normalize()` (0057_search.sql) is
 * built in exactly this order — `pnpm check:search-parity` proves the two
 * agree on live data, and a search only finds anything while they do.
 *
 * ⚠️ Энэ функцийг засвал: (1) 0057_search.sql-ийн `search_normalize()`-ийг мөн
 * зэрэг засах, (2) `pnpm check:search-parity` ажиллуулах, (3) `search.test.ts`
 * дэх «паритетын цоож» хүснэгтийг шинэчлэх. Аль нэгийг л засвал хайлт ямар ч
 * алдаа гаргалгүйгээр хагас ажиллана.
 */
export function normalizeSearchText(text: string): string {
  const folded = text
    // é → e, ï → i … (perfume names are full of them: Guerlain, Hermès)
    .normalize("NFKD")
    .replace(/\p{Mn}/gu, "")
    .toLowerCase();
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

/**
 * The query split into folded terms — the array `global_search()` expects.
 * Empty terms are dropped, so trailing spaces never make a search fail.
 */
export function searchTerms(query: string): string[] {
  return normalizeSearchText(query.trim()).split(/\s+/u).filter(Boolean);
}

/**
 * Is there enough typed to search at all (backlog H1.3)?
 *
 * Measured on the folded terms, not the raw string: "  a  " is one letter of
 * intent, and a single letter matches most of the catalogue while telling the
 * customer nothing.
 */
export function isSearchable(query: string): boolean {
  const terms = searchTerms(query);
  return terms.length > 0 && terms.join("").length >= MIN_SEARCH_LENGTH;
}
