/**
 * Mongolian Cyrillic → Latin transliteration.
 *
 * Convention: `х → kh`, `ө → u`, `ц → ts`. `у`, `ү` and `ө` all collapse to
 * "u", which is how these names are normally written in Mongolia — Өвөрхангай
 * is "Uvurkhangai", Сүхбаатар is "Sukhbaatar". The collapse is lossy on
 * purpose: it is a display spelling, not a reversible encoding, so never use it
 * as a key or an id.
 *
 * Used to generate the `nameEn` values in mn-locations.json
 * (scripts/translit-locations.ts) and available for any other Cyrillic string
 * that needs a Latin rendering (slugs, English address lines).
 */
const TABLE = new Map<string, string>([
  ["а", "a"],
  ["б", "b"],
  ["в", "v"],
  ["г", "g"],
  ["д", "d"],
  ["е", "e"],
  ["ё", "yo"],
  ["ж", "j"],
  ["з", "z"],
  ["и", "i"],
  ["й", "i"],
  ["к", "k"],
  ["л", "l"],
  ["м", "m"],
  ["н", "n"],
  ["о", "o"],
  ["ө", "u"],
  ["п", "p"],
  ["р", "r"],
  ["с", "s"],
  ["т", "t"],
  ["у", "u"],
  ["ү", "u"],
  ["ф", "f"],
  ["х", "kh"],
  ["ц", "ts"],
  ["ч", "ch"],
  ["ш", "sh"],
  ["щ", "sh"],
  ["ъ", ""],
  ["ы", "y"],
  ["ь", "i"],
  ["э", "e"],
  ["ю", "yu"],
  ["я", "ya"],
]);

/**
 * Transliterate a Cyrillic place name, title-casing every word.
 *
 * Words are title-cased rather than mirroring the source's case because the
 * official dataset is itself inconsistent — "Их тамир" and "Хишиг-өндөр" sit
 * beside "Баян-Өндөр" — and these are proper nouns in English.
 */
export function translit(name: string): string {
  let out = "";
  let startOfWord = true;
  for (const ch of name) {
    if (ch === " " || ch === "-") {
      out += ch;
      startOfWord = true;
      continue;
    }
    const lower = ch.toLowerCase();
    // Anything outside the table (digits, already-Latin letters) passes through.
    const hit = TABLE.get(lower) ?? ch;
    // "Х" → "Kh", never "KH": only the first letter is capitalised.
    out += startOfWord ? hit.charAt(0).toUpperCase() + hit.slice(1) : hit;
    if (hit !== "") startOfWord = false;
  }
  return out;
}
