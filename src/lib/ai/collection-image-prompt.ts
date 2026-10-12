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
 *   frame   — 4:5 хүрээ, цуврал (card-ын харьцаа, grid-д зэрэгцэнэ);
 *   layout  — савнуудын байрлал хувь/px-ээр (бүх poster-т ТОГТМОЛ —
 *             «ойролцоо» дүрмийг загвар сул дагаж, сав зарим нь голдоо,
 *             зарим нь доор гарч байв);
 *   surface — бүдэг гадаргуу: толь шиг тод тусгал зургийг дарж байв;
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
  frame: [
    "Vertical 4:5 portrait frame (width : height = 4 : 5), e.g. 1024 x 1280 px.",
    "This poster is one of a SERIES shown side by side in a grid, so every",
    "poster must use exactly the same framing: same camera distance, same",
    "bottle scale, same baseline. Nothing important may sit near the edges.",
  ],
  layout: [
    "Positions are given as % of the frame (and in px for 1024 x 1280):",
    "- BASELINE: the bottom edge of all four bottles rests on ONE perfectly",
    "  horizontal line at 68% of the frame height from the top (y = 870 px).",
    "  Every bottle — tall, short or round — stands on this same line, never",
    "  lifted, sunk, set back or placed in front.",
    "- ROW WIDTH: the row, from the left edge of bottle 1 to the right edge of",
    "  bottle 4, spans 84% of the frame width (about 860 px), centred: 8%",
    "  (about 80 px) of empty space on the left and on the right. Choose the",
    "  bottle scale so the row fills exactly this width.",
    "- HEIGHT LIMIT: no bottle top (including its cap) is higher than 22% of",
    "  the frame height from the top (y = 280 px). If the tallest bottle would",
    "  break this limit, scale all four down together.",
    "- One straight horizontal row, left to right in the order listed below,",
    "  all at the same distance from the camera — none in front of, behind or",
    "  on top of another. Equal gaps of about 1 cm between neighbouring",
    "  bottles, never touching.",
    "- Every bottle stands perfectly upright, its vertical axis parallel to the",
    "  frame's side edges, labels facing the camera.",
    "- Camera straight on at label height, level, no tilt, no perspective",
    "  distortion; all four bottles in sharp focus.",
    "- Below the baseline (bottom 32%): only the surface, calm and uncluttered,",
    "  no props. Above the row: backdrop, props and light.",
  ],
  surface: [
    "The bottles stand on a matte or satin surface (honed stone, linen, paper,",
    "suede, brushed wood or similar). Under each bottle there is only a soft,",
    "short contact shadow and at most a faint, blurred hint of reflection that",
    "fades out within a few centimetres. NOT a mirror: no glossy black, polished",
    "marble, glass or water surface, and never a sharp, full-height mirrored",
    "copy of a bottle or its label.",
  ],
  set: [
    "Read the set's name, gender and description below and design a studio set",
    "that tells its story: the surface material and colour, a styled backdrop",
    "(wall, fabric or set pieces), a few props behind or beside the row — never",
    "in front of or between the bottles — the lighting mood, a 3-4 tone colour",
    "palette and one atmospheric element (haze with light beams, a coloured gel",
    "glow, moving fabric or soft bokeh). Each set should feel like a different",
    "campaign.",
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
  frame: "FRAME",
  layout: "LAYOUT (exact positions — follow precisely)",
  surface: "SURFACE",
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
