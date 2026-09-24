/**
 * Багцын poster зургийн prompt. Барааны `build-image-prompt.ts`-ийн ихэр:
 * үндсэн prompt нь тогтмол (зураг авалтын дүрэм), доор нь тухайн багцын нэр,
 * хүйс, тайлбар, дөрвөн гишүүн нэмэгдэнэ. Орчин, гэрэл, эд зүйлсийг загвар
 * тайлбараас өөрөө уншиж сонгоно — багц бүр өөр дүр зурагтай гарна.
 *
 * Лавлах зургууд нь гишүүдийн үндсэн зураг, prompt дахь дарааллаар нь
 * илгээгдэнэ. Pure — I/O байхгүй.
 */

export const COLLECTION_BASE_PROMPT = [
  "You are an award-winning commercial fragrance photographer shooting the",
  "campaign poster for a curated set of four perfumes. Produce ONE frame from a",
  "real, professional STUDIO photoshoot: medium format camera on a tripod,",
  "controlled studio lighting (softboxes, strip lights, gels, flags), true",
  "optical depth of field, real glass reflections and refractions, realistic",
  "contact shadows. It must look like an authentic high-end fragrance",
  "advertisement shot in a photo studio — never an outdoor location, a 3D",
  "render, an illustration, or an obvious AI image.",
  "",
  "=== RULE 1 — THE FOUR BOTTLES (non-negotiable) ===",
  "The attached reference images are the four perfumes of this set, one bottle",
  "per image. Exactly four bottles, no more, no fewer, none duplicated. Each",
  "bottle keeps EXACTLY its real shape, proportions, glass colour, cap and",
  "label: every letter and logo complete, unaltered and legible. Keep each",
  "bottle's true relative size — do not enlarge or shrink one to match another.",
  "",
  "=== RULE 2 — ONE STRAIGHT ROW, FIXED FRAMING (identical for every set) ===",
  "- The four bottles stand side by side in ONE straight horizontal row, left",
  "  to right in the same order as the list below, all on the same surface and",
  "  the same baseline — no bottle in front of or behind another, no stacking,",
  "  no overlap, no bottle raised on a separate block.",
  "- The bottles stand close together with a small, IDENTICAL gap of about",
  "  1 cm (roughly a finger's width) between every neighbouring pair — never",
  "  touching, never spread apart, the same gap everywhere. Each bottle faces",
  "  the camera with its label straight on.",
  "- Camera straight on at label height, level horizon, no tilt, no dramatic",
  "  perspective; all four bottles tack sharp.",
  "- The tight group of four is EXACTLY centred in the frame, horizontally and",
  "  vertically:",
  "  • horizontally — equal empty space to the left of the first bottle and to",
  "    the right of the last bottle;",
  "  • vertically — the empty space above the top of the tallest bottle equals",
  "    the space below the bottles' bases: the tallest bottle's top at 30% of",
  "    the frame height from the top, the bases at 70% (30% margin top and",
  "    bottom). The vertical centre of the group is the centre of the frame.",
  "  The surface the bottles stand on continues below the bases to the bottom",
  "  edge; the backdrop fills the space above.",
  "This framing is a fixed template: the bottle row must occupy the same area",
  "of the frame in every poster of the series.",
  "",
  "=== RULE 3 — THE SET DESIGN COMES FROM THE SET ===",
  "Read the set's name, gender and description below and build a studio set",
  "that tells its story: choose the surface material the bottles stand on, a",
  "styled backdrop (painted or textured wall, fabric, architectural set",
  "pieces, a softly lit prop in the background), a few restrained props placed",
  "BEHIND or beside the row but never in front of or between the bottles, the",
  "lighting mood and a 3-4 tone colour palette. Every set must feel like a",
  "different campaign while the bottle framing stays identical. Add one",
  "atmospheric studio element (light beams through haze, a coloured gel glow,",
  "reflections on the surface, moving fabric, soft bokeh).",
  "",
  "=== NEVER ===",
  "No added text, typography, graphics or watermarks — the only text in frame",
  "is the bottles' own labels; no people, hands or faces; no extra or duplicated",
  "bottles; no warped or misspelled labels; no gradient background; no outdoor",
  "landscape; no cartoon, CGI, painterly or oversaturated AI look.",
].join("\n");

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
      "Description (may be in Mongolian — extract the mood, setting and",
      "occasion and turn them into the scene; never render it as text):",
      clip(description, MAX_DESCRIPTION_CHARS),
    );
  } else {
    details.push(
      "No description — infer the set's character from its name and the four",
      "perfumes, and build the scene from that.",
    );
  }

  return [basePrompt.trim(), "", "=== THIS SET ===", ...details].join("\n");
}
