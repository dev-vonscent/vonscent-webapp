/**
 * Багцын poster зургийн prompt. Барааны `build-image-prompt.ts`-ийн ихэр:
 * үндсэн prompt нь тогтмол (зураг авалтын дүрэм), доор нь тухайн багцын нэр,
 * хүйс, тайлбар, дөрвөн гишүүн нэмэгдэнэ. Орчин, гэрэл, эд зүйлсийг загвар
 * тайлбараас өөрөө уншиж сонгоно — багц бүр өөр дүр зурагтай гарна.
 *
 * Лавлах зургууд нь гишүүдийн үндсэн зураг, prompt дахь дарааллаар нь
 * илгээгдэнэ. Pure — I/O байхгүй.
 */

/**
 * Үндсэн prompt-ын хэсгүүд. Дүрэм бүр ЗӨВХӨН НЭГ хэсэгт бичигдэнэ — засахдаа
 * тухайн хэсгийг нь олж засна, өөр газар давтаж нэмэхгүй (давхардсан,
 * зөрчилдсөн заавар загварыг төөрөгдүүлдэг).
 *
 *   style   — зураг авалтын төрөл, чанар;
 *   bottles — дөрвөн савны үнэн зөв байдал;
 *   layout  — савнуудын байрлал (бүх poster-т ТОГТМОЛ);
 *   set     — багц бүрд өөрчлөгдөх орчин;
 *   avoid   — дээрх хэсгүүдэд хамаарахгүй үлдсэн хоригууд.
 */
const SECTIONS = {
  style: [
    "Produce ONE frame from a professional fragrance-campaign photoshoot in a",
    "photo studio: medium format camera, controlled studio lighting, real glass",
    "reflections and refractions, realistic contact shadows. It must look like",
    "an authentic high-end advertisement — not a 3D render or illustration.",
  ],
  bottles: [
    "The attached reference images are the set's four perfumes, one bottle per",
    "image. Show exactly these four bottles, each exactly once, keeping its real",
    "shape, proportions, glass colour, cap, label (every letter and logo intact",
    "and legible) and its true size relative to the others.",
    "Take ONLY the bottle's design from its reference. Ignore the reference",
    "photo's camera angle, perspective, tilt, lighting and background — every",
    "bottle is re-photographed from this shoot's own camera position.",
  ],
  layout: [
    "This layout is identical for every poster in the series:",
    "- One straight horizontal row, left to right in the order listed below,",
    "  all at the same distance from the camera — none in front of, behind, on",
    "  top of or raised above another.",
    "- BASELINE: the bottom edge of every bottle rests on one perfectly",
    "  horizontal line at 70% of the frame height from the top, so all four",
    "  bases are exactly the same distance from the bottom of the frame. Round",
    "  or short bottles sit on that same line — never lifted or set back.",
    "- About 1 cm (a finger's width) between neighbouring bottles, the same gap",
    "  everywhere, never touching.",
    "- Every bottle stands perfectly upright, its vertical axis parallel to the",
    "  frame's side edges — not leaning toward or away from the camera, not",
    "  seen from above or below. Labels face the camera.",
    "- Camera straight on at label height, level, no tilt, so all four bottles",
    "  share the same eye-level view; all four in sharp focus.",
    "- The row is centred: equal space left and right; the tallest bottle's top",
    "  at 30% of the frame height from the top.",
  ],
  set: [
    "Read the set's name, gender and description below and design a studio set",
    "that tells its story: the surface the bottles stand on, a styled backdrop",
    "(wall, fabric or set pieces), a few props behind or beside the row — never",
    "in front of or between the bottles — the lighting mood, a 3-4 tone colour",
    "palette and one atmospheric element (haze with light beams, a coloured gel",
    "glow, surface reflections, moving fabric or soft bokeh). Each set should",
    "feel like a different campaign.",
  ],
  avoid: [
    "No added text, graphics or watermarks (the only text is the bottles' own",
    "labels); no people or hands; no outdoor landscape; no gradient background;",
    "no cartoon, CGI or oversaturated look.",
  ],
} as const;

const HEADINGS: Record<keyof typeof SECTIONS, string> = {
  style: "STYLE",
  bottles: "THE FOUR BOTTLES (non-negotiable)",
  layout: "LAYOUT",
  set: "SET DESIGN",
  avoid: "AVOID",
};

export const COLLECTION_BASE_PROMPT = (
  Object.keys(SECTIONS) as (keyof typeof SECTIONS)[]
)
  .map((k) => [`=== ${HEADINGS[k]} ===`, ...SECTIONS[k]].join("\n"))
  .join("\n\n");

export interface CollectionPromptFields {
  name?: string;
  gender?: string;
  description?: string;
  /** Лавлах зургийн дарааллаар. */
  members: { brand?: string | null; name: string }[];
}

/** Урт тайлбар prompt-ыг загварын хязгаараас хэтрүүлэхгүй. */
const MAX_DESCRIPTION_CHARS = 1500;

function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export function buildCollectionImagePrompt(
  fields: CollectionPromptFields,
  basePrompt: string = COLLECTION_BASE_PROMPT,
): string {
  const details: string[] = [];
  if (fields.name?.trim()) details.push(`Set name: ${fields.name.trim()}`);
  if (fields.gender) details.push(`Gender: ${fields.gender}`);

  if (fields.members.length) {
    details.push("Perfumes (reference images and row order, left to right):");
    fields.members.forEach((m, i) =>
      details.push(
        `${i + 1}. ${[m.brand, m.name].filter(Boolean).join(" — ")}`,
      ),
    );
  }

  const description = (fields.description ?? "").trim();
  if (description) {
    details.push(
      "Description (may be in Mongolian — use its mood, setting and occasion",
      "for the set design; never render it as text):",
      clip(description, MAX_DESCRIPTION_CHARS),
    );
  } else {
    details.push(
      "No description — infer the set design from the name and the four",
      "perfumes.",
    );
  }

  return [basePrompt.trim(), "", "=== THIS SET ===", ...details].join("\n");
}
