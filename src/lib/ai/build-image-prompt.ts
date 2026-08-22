/**
 * Compose the English image-generation prompt from the admin's base prompt and
 * the product fields (ai-image-generation §3). The fragrance notes are NOT drawn
 * literally — instead the perfume's character is read from its description and
 * expressed as one minimalist scene. Pure — no I/O, so it is unit-tested and
 * safe to import anywhere.
 */

export const DEFAULT_BASE_PROMPT =
  "Minimalist product photograph with the perfume bottle as the only hero " +
  "subject. Do NOT depict, illustrate or scatter the fragrance's notes or " +
  "ingredients. Instead, interpret the perfume's character and mood from the " +
  "description below and express it through one restrained, minimal scene: a " +
  "fitting colour palette, a single simple surface or material, and matching " +
  "light — few or no props, generous negative space, the bottle sharp and " +
  "well placed. (For example, a bold, confident scent could rest on dark grey " +
  "stone in a dark grey palette.) Photorealistic, elegant, editorial, high " +
  "detail, sharp focus, no text, no watermark.";

export interface PromptFields {
  name?: string;
  brand?: string;
  gender?: string;
  /** The perfume's story — the source of the mood/character to express. */
  shortDescription?: string;
  description?: string;
}

export function buildImagePrompt(
  fields: PromptFields,
  basePrompt: string = DEFAULT_BASE_PROMPT,
): string {
  const lines: string[] = [basePrompt.trim(), ""];

  const nameBrand = [fields.brand, fields.name].filter(Boolean).join(" — ");
  if (nameBrand) lines.push(`Perfume: ${nameBrand}`);

  if (fields.gender) lines.push(`Gender: ${fields.gender}`);

  // The character text drives the whole scene; prefer the concise short
  // description, fall back to the long one.
  const character = (fields.shortDescription || fields.description || "").trim();
  if (character)
    lines.push(
      `Character / mood to express (interpret into a minimalist scene, do not depict literally): ${character}`,
    );

  return lines.join("\n").trim();
}
