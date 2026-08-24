/**
 * Compose the English image-generation prompt from the admin's base prompt and
 * the product fields (ai-image-generation §3). Rewritten around real perfume
 * photography practice: the scent family selects a concrete photoshoot recipe
 * (surface + backdrop + atmosphere + light), the description fine-tunes the
 * mood, and the reference bottle — especially its label text — is preserved
 * exactly. Pure — no I/O, unit-testable, safe to import anywhere.
 */

export const DEFAULT_BASE_PROMPT = [
  "You are recreating the work of an award-winning commercial perfume",
  "photographer. Produce ONE frame from a real professional studio photoshoot:",
  "full-frame camera, macro product lens, true optical depth of field, real",
  "glass reflections and refractions, realistic soft shadows. It must be",
  "indistinguishable from an authentic magazine advertisement — never a 3D",
  "render, illustration, or obvious AI image.",
  "",
  "=== RULE 1 — THE BOTTLE (non-negotiable) ===",
  "The bottle from the reference image is the hero and must stay EXACTLY as it",
  "is: identical shape, proportions, glass colour, cap. Above all, the LABEL:",
  "every letter, logo and marking on the bottle must remain complete, unaltered",
  "and crisply legible — treat the label as untouchable. Never repaint,",
  "simplify, blur, crop, or let lighting effects wash out any text on the",
  "bottle. The bottle and its label are always in tack-sharp focus; only the",
  "environment may soften.",
  "",
  "=== RULE 2 — NO EMPTY BACKDROPS ===",
  "A flat, featureless background is a failed result. Every image must be a",
  "fully composed scene with all three layers:",
  "1) a real SURFACE the bottle stands on (stone, marble, wood, glossy acrylic",
  "   with reflection, rippled water, sand, fabric-draped table);",
  "2) a BACKDROP with visible depth or texture (colour gradient falling into",
  "   shadow, textured plaster wall, out-of-focus tones — never a blank void);",
  "3) one ATMOSPHERIC element that gives the frame life: a beam of directional",
  "   light, window-light shadow patterns, drifting smoke or mist, flowing",
  "   fabric, water droplets and splashes, or a mirror reflection.",
  "Keep it minimalist through generous negative space and restraint — not",
  "through emptiness. Creative, editorial, intentional.",
  "",
  "=== RULE 3 — MATCH THE PHOTOSHOOT TO THE FRAGRANCE ===",
  "Read the fragrance family and description below, then shoot in the matching",
  "style:",
  "- FLORAL / romantic / feminine → soft satin or silk backdrop in muted",
  "  pastel or blush tones, diffused window light, delicate soft shadows.",
  "- FRESH / citrus / aquatic → bright airy high-key scene, cool blue-white",
  "  palette, water surface with ripples or fine droplets and a small splash,",
  "  crisp daylight, strong glass sparkle.",
  "- WOODY / earthy / masculine → dark stone or rough timber surface, deep",
  "  warm-neutral palette, single hard directional light raking across",
  "  textures, long confident shadows.",
  "- ORIENTAL / amber / spicy / oud → low-key dramatic scene, near-black",
  "  backdrop with amber-gold rim light from behind, slow drifting smoke,",
  "  glowing highlights on the glass.",
  "- SENSUAL / seductive / intense (from the description) → deep red or",
  "  crimson silk billowing behind the bottle, or an all-black glossy set with",
  "  one dramatic spotlight — passionate, cinematic.",
  "- GOURMAND / sweet / warm → creamy caramel-toned backdrop, warm golden",
  "  side light, velvet surface, cosy inviting glow.",
  "- CLEAN / modern / unisex minimal → white-on-white or grey monochrome",
  "  architectural set, geometric shadow play from hard light, precise",
  "  composition.",
  "If several apply, blend the two strongest; let the description's mood make",
  "the final call.",
  "",
  "=== COMPOSITION ===",
  "Bottle large in frame and dominant; centered or on a strong third; camera at",
  "bottle level or slightly below for presence; shallow depth of field on the",
  "environment only; generous negative space; colour palette limited to 2-3",
  "tones that suit the fragrance.",
  "",
  "=== NEVER ===",
  "No literal fragrance ingredients as props (no flowers, fruits, spices,",
  "coffee beans, vanilla pods); no people, hands or faces; no added text,",
  "graphics or watermarks — the only text in frame is the bottle's own label;",
  "no cartoon, CGI, painterly or oversaturated AI look; no plain empty",
  "background; no second bottle.",
].join("\n");

export interface PromptFields {
  name?: string;
  brand?: string;
  gender?: string;
  /** e.g. ["floral","woody"] — selects the photoshoot recipe (RULE 3). */
  scentFamilies?: string[];
  /** The perfume's story — fine-tunes the mood within the chosen style. */
  shortDescription?: string;
  description?: string;
}

/** Keep the final prompt comfortably inside gpt-image-1 limits. */
const MAX_DESCRIPTION_CHARS = 1200;

function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export function buildImagePrompt(
  fields: PromptFields,
  basePrompt: string = DEFAULT_BASE_PROMPT,
): string {
  const lines: string[] = [basePrompt.trim(), "", "=== THIS FRAGRANCE ==="];

  const nameBrand = [fields.brand, fields.name].filter(Boolean).join(" — ");
  if (nameBrand) lines.push(`Perfume: ${nameBrand}`);

  if (fields.gender) lines.push(`Gender: ${fields.gender}`);

  const families = (fields.scentFamilies ?? []).filter(Boolean);
  if (families.length)
    lines.push(
      `Fragrance family: ${families.join(", ")} — use the matching photoshoot style from RULE 3.`,
    );

  // Pass BOTH the concise summary and the full story so the model reads the
  // character properly; the description refines the mood inside the style.
  const short = (fields.shortDescription || "").trim();
  const long = (fields.description || "").trim();

  if (short || long) {
    lines.push(
      "Description (extract the mood and let it fine-tune the scene — never",
      "depict it literally):",
    );
    if (short) lines.push(`Summary: ${clip(short, 300)}`);
    if (long && long !== short)
      lines.push(`Full story: ${clip(long, MAX_DESCRIPTION_CHARS)}`);
  }

  return lines.join("\n").trim();
}
