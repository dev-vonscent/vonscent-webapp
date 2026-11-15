import { HERO_THEMES, type HeroThemeKey } from "@/lib/ai/hero-prompt";

/** Нэрэн дэх түлхүүр үг → AI сэдэв (studio-ux.md §5.4: «Black Friday» → `black_friday`). */
const KEYWORDS: [RegExp, HeroThemeKey][] = [
  [/black\s*friday/iu, "black_friday"],
  [/цагаан\s*сар/iu, "tsagaan_sar"],
  [/наадам/iu, "naadam"],
  [/шинэ\s*жил/iu, "new_year"],
  [/эрэгтэй/iu, "mens_day"],
  [/эмэгтэй/iu, "womens_day"],
  [/хавар/iu, "spring"],
  [/зун/iu, "summer"],
  [/намар/iu, "autumn"],
  [/өвөл/iu, "winter"],
];

/**
 * Арга хэмжээний нэрээс сэдэв; таарахгүй бол эхлэх өдрийн улирал
 * (3–5 хавар, 6–8 зун, 9–11 намар, бусад өвөл).
 */
export function guessHeroTheme(name: string, startsOn: string): HeroThemeKey {
  const exact = (Object.keys(HERO_THEMES) as HeroThemeKey[]).find(
    (k) => k !== "custom" && HERO_THEMES[k].label.toLowerCase() === name.trim().toLowerCase(),
  );
  if (exact) return exact;
  for (const [re, key] of KEYWORDS) if (re.test(name)) return key;
  const month = Number(/^\d{4}-(\d{2})/u.exec(startsOn)?.[1] ?? 0);
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}
