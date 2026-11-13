/**
 * Нүүрний hero-гийн AI prompt (docs/campaigns/plan.md §8.2).
 *
 * Суурь нь prompts/hero-desktop.md, hero-mobile.md, hero-winter.md: өмнөх
 * hero-г (image 1) RESTYLE хийнэ — бараа, зохиомж, хүрээ, аюулгүй бүс
 * ХУВИРШГҮЙ, зөвхөн уур амьсгал (гэрэл, өнгө, жижиг чимэглэл) солигдоно.
 * Ингэснээр нүүрний текст үргэлж зүүн талын хоосон хананд сууж, бараа
 * баруун талд тасрахгүй (prompts/hero.md §1).
 *
 * Сэдэв бүрийн хэсэг англиар — загвар англи prompt-ыг илүү тогтвортой дагадаг.
 * Соёлын нарийн зүйлс (Цагаан сар, Наадам)-ийг dev дээр 3–5 удаа туршиж
 * тохируулна (plan §8.4).
 */

export interface HeroTheme {
  label: string;
  /** Гэрэл, өнгө, уур амьсгал. */
  mood: string;
  /** Нэмэх чимэглэл — зөвхөн барааны бүсэд. */
  details: string;
  /** Хориглох зүйлс (загвар ихэвчлэн «хэтрүүлдэг»). */
  avoid: string;
  /**
   * Хана бараан болох уу — тэгвэл prompt «цайвар хана» гэж шаардахгүй,
   * текст цагаан болно (`dark`, upload-ийн санал үүнийг баталгаажуулна).
   */
  darkWall?: boolean;
}

export const HERO_THEMES = {
  black_friday: {
    label: "Black Friday",
    mood: "a sleek, premium late-evening shopping-night mood: deep charcoal and matte black tones with warm gold accents, dramatic low-key lighting with a soft spotlight on the bottles, glossy reflections in the polished stone",
    details: "a few thin strips of black satin ribbon and one or two small matte black gift boxes with thin gold edges placed behind the bottles; subtle warm golden bokeh lights far in the background on the right",
    avoid: "no price tags, no percentage signs, no 'SALE' or 'Black Friday' lettering, no shopping bags, no confetti, no red",
    darkWall: true,
  },
  tsagaan_sar: {
    label: "Цагаан сар",
    mood: "the Mongolian Lunar New Year (Tsagaan Sar) morning: clean, bright, festive yet calm, soft white winter daylight, a palette of pure white, silver and pale sky blue with the warm amber of the perfumes",
    details: "a softly folded light-blue silk khadag (Mongolian ceremonial scarf) draped on the stone behind the bottles, one small engraved silver bowl, a few tiny white felt or silver ornaments with traditional Mongolian ulzii knot patterns",
    avoid: "no food, no buuz, no stacked pastries (ul boov), no people, no Chinese red lanterns, no red-and-gold Chinese New Year decorations, no zodiac animals, no text",
  },
  naadam: {
    label: "Наадам",
    mood: "a bright Mongolian summer festival day (Naadam): clear high summer sun, vivid blue sky light, fresh and energetic, a palette of warm sand, sky blue and touches of the Mongolian national blue and red",
    details: "a small detail of a traditional horse-hair banner tassel or a miniature bow-and-arrow motif lying behind the bottles, a strip of colorful traditional Mongolian pattern fabric folded on the stone, a few blades of steppe grass",
    avoid: "no people, no wrestlers, no horses, no flags with text, no crowds, no tents, no text",
  },
  new_year: {
    label: "Шинэ жил",
    mood: "an elegant New Year's Eve evening: warm candle-like glow, festive but refined, a palette of champagne gold, deep midnight blue and soft silver",
    details: "a few small glass ornaments in gold and silver, thin sprigs of snowy fir, delicate warm fairy-light bokeh in the background on the right, a hint of gold ribbon behind the bottles",
    avoid: "no Santa Claus, no reindeer, no snowmen, no text, no numbers or year digits, no fireworks",
  },
  mens_day: {
    label: "Эрэгтэйчүүдийн баяр",
    mood: "a confident, refined masculine mood for Men's Day: cool steel and deep navy tones with warm leather brown accents, crisp directional light, strong but clean shadows",
    details: "a dark leather wallet or watch strap and a classic steel wristwatch lying on the stone behind the bottles, a folded dark-navy silk tie, a few cedar wood shavings",
    avoid: "no weapons, no military uniforms, no medals, no flags, no text",
  },
  womens_day: {
    label: "Эмэгтэйчүүдийн баяр",
    mood: "a soft, romantic early-spring mood for International Women's Day: delicate morning light, airy and feminine, a palette of blush pink, ivory and soft gold",
    details: "a small bouquet of pale pink tulips laid on the stone behind the bottles, a few loose petals, a thin satin ribbon in blush pink, a delicate pearl strand",
    avoid: "no red roses, no hearts, no text, no '8' numerals",
  },
  spring: {
    label: "Хавар",
    mood: "a fresh early-spring morning: soft, clear daylight with a hint of green, light and airy, a palette of pale ivory, fresh green and soft peach",
    details: "a few small budding branches with tiny fresh green leaves, a couple of white blossom sprigs and a little fresh moss on the stone behind the bottles",
    avoid: "no Easter eggs, no bunnies, no text",
  },
  summer: {
    label: "Зун",
    mood: "a bright high-summer afternoon: warm golden sunlight, crisp clear shadows of leaves, a palette of warm sand, sun-bleached stone and clear blue water reflections",
    details: "a few green leaves casting shadows, a small piece of citrus (lemon slice) and smooth white pebbles on the stone behind the bottles, subtle water-caustic light reflections on the wall near the bottles",
    avoid: "no beach umbrellas, no people, no sunglasses, no text",
  },
  autumn: {
    label: "Намар",
    mood: "a warm golden-hour autumn afternoon: low amber sunlight, cozy and rich, a palette of cognac, burnt orange, ochre and warm beige",
    details: "a few dried golden larch twigs and fallen yellow birch leaves, a small cinnamon stick bundle and a folded camel wool throw on the stone behind the bottles",
    avoid: "no pumpkins, no Halloween items, no text",
  },
  winter: {
    label: "Өвөл",
    mood: "the first days of winter in a cold northern steppe city, the morning after a light snowfall: clear, low, slightly bluish winter sun, crisp and elegant, a palette of pale ivory, stone grey, silver and icy blue with the warm amber of the perfumes",
    details: "a fine dusting of fresh powdery snow and tiny frost crystals on the stone edges, a few thin bare twigs coated with white hoarfrost behind the bottles, a folded corner of a cream cashmere scarf",
    avoid: "no snowflakes falling in the air, no Christmas ornaments, no red, no gift boxes, no text",
  },
  custom: {
    label: "Өөрөө бичих",
    mood: "",
    details: "",
    avoid: "no text",
  },
} as const satisfies Record<string, HeroTheme>;

export type HeroThemeKey = keyof typeof HERO_THEMES;

export const HERO_THEME_KEYS = Object.keys(HERO_THEMES) as HeroThemeKey[];

export function isHeroThemeKey(k: string): k is HeroThemeKey {
  return Object.hasOwn(HERO_THEMES, k);
}

/**
 * Хэмжээ (prompts/hero.md §2): 16-ын үржвэр, харьцаа ≤3:1, урт тал <3840.
 * `fast` — артефакт эсвэл `maxDuration`-д багтахгүй үеийн нөөц (plan §8.3).
 */
export const HERO_AI_SIZES = {
  desktop: { high: "3584x1280", fast: "2688x960" },
  mobile: { high: "2048x1536", fast: "1536x1152" },
} as const;

/** Бүсийн дүрэм — prompts/hero-desktop.md, hero-mobile.md (ХУВИРШГҮЙ). */
const ZONES = {
  desktop: {
    frame: "the 2.8:1 ultra-wide framing",
    empty: "The left 55% of the frame",
    productBand: "between 55% and 95% of the frame width",
    vertical:
      "The tallest bottle top stays at about 14% from the top edge and the lowest point of any object at about 86%.",
  },
  mobile: {
    frame: "the 4:3 framing",
    empty: "The left 58% of the frame, including the bottom-left corner,",
    productBand: "between 58% and 97% of the frame width",
    vertical:
      "Do not move, enlarge or shift anything to the left; keep every object exactly where it is in the composition reference.",
  },
} as const;

const PRODUCTS_FAITHFUL =
  "Reproduce every bottle's shape, cap, glass color and printed text faithfully, sharp and legible.";

const PHOTO_STYLE =
  "Camera at product level, 50mm lens look, tack-sharp focus on the products, crisp legible bottle labels, natural soft shadows, realistic reflections in the polished stone, unretouched luxury commercial product photograph.";

const NEVER =
  "No added text, no lettering, no logos other than what is printed on the original bottles, no watermark, no people.";

export interface HeroPromptInput {
  target: "desktop" | "mobile";
  theme: HeroThemeKey;
  /** Админы нэмэлт тайлбар (монголоор ч болно) — `Theme details:`. */
  extra?: string;
  /**
   * Mobile: image 1 = утасны зохиомжийн reference, image 2 = СОНГОСОН desktop
   * (уур амьсгалыг тэндээс хуулна) — хоёр хувилбар ижил харагдана.
   */
  withDesktopStyleRef?: boolean;
}

/**
 * Эцсийн prompt. Бүсийн дүрэм, барааны үнэнч байдал, хориглолт нь сэдвээс
 * үл хамааран ҮРГЭЛЖ орно (тест: hero-prompt.test.ts).
 */
export function buildHeroPrompt(input: HeroPromptInput): string {
  const theme: HeroTheme = HERO_THEMES[input.theme];
  const z = ZONES[input.target];
  const extra = input.extra?.trim();
  const custom = input.theme === "custom";

  const scene =
    input.target === "mobile"
      ? `Image 1 is the exact composition reference: keep its framing, camera angle, the size and the exact position of every object — the perfume bottles, the glass decant vials and the stone blocks — exactly where they are, in ${z.frame}. ${PRODUCTS_FAITHFUL}` +
        (input.withDesktopStyleRef
          ? " Image 2 is the approved wide version of the same scene: match its lighting, color palette, props and mood exactly, so both images look like one photo shoot."
          : "")
      : `Image 1 is the exact scene reference: keep the same perfume bottles, the glass decant vials, the stone blocks, the camera angle, the composition and ${z.frame} exactly as they are. ${PRODUCTS_FAITHFUL}`;

  const mood = custom
    ? `Restyle the scene according to the theme details below, keeping it minimal, elegant and luxurious.`
    : `Restyle the scene for this occasion: ${theme.mood}. The amber or colored liquid in the bottles keeps its natural color.`;

  const details = custom
    ? ""
    : `Add themed details only ${z.productBand}, around and behind the bottles, never covering any bottle or label: ${theme.details}. Keep the details small and refined.`;

  const wallTone = theme.darkWall
    ? "a smooth wall in the theme's tone with soft light, dark and even enough for white text to be read on it"
    : "the smooth plaster wall in a light tone with soft window-light shadows, light enough for dark text to be read on it";

  const empty = `${z.empty} must stay completely empty: only ${wallTone}, above the polished stone surface — no objects, no props, no decorations, no text in that area. The wall and the stone surface continue to every edge of the frame. ${z.vertical}`;

  return [
    scene,
    mood,
    details,
    extra ? `Theme details: ${extra}` : "",
    empty,
    PHOTO_STYLE,
    `${NEVER} Also: ${theme.avoid}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}
