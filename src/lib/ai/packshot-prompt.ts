/**
 * The catalogue packshot: the product's own bottle, upright and centred on the
 * shop's warm light-grey studio sweep.
 *
 * One fixed art direction applied to every bottle, so a catalogue assembled
 * from a dozen different sources reads as one shoot — same background, same
 * scale, same light. Used by the batch normaliser
 * (`scripts/regen-product-images.ts`) and by the new-product pipeline, so it
 * lives here rather than in either caller.
 */
export const PACKSHOT_PROMPT = `Keep the perfume bottle 100% identical to the reference image. Do not alter, redesign, retouch, crop, or reinterpret any part of the bottle. Preserve its exact shape, proportions, cap, glass, liquid color, label, logo, typography, text, reflections, and all original details. Place the bottle upright and perfectly centered on a seamless warm light-gray studio tabletop/background in #E7E5E2. No visible horizon line, no texture, no props, and no extra objects. Strict composition requirement: the complete visible bottle height must be exactly 60% of the total image height and must never exceed 60%. Keep equal empty space above and below the bottle. Do not zoom in and do not crop any part of the bottle. Use soft diffused studio lighting from the upper-left/front-left. Create a subtle, close-to-object soft shadow exactly like a premium studio product photo: the shadow should fall gently behind the bottle toward the right and bottom-right, with the darkest area close to the bottle's right edge and base. The shadow must be wide, soft, feathered, and smoothly faded into the background, with no hard edges, no sharp silhouette, no long cast shadow, and no dark black areas. Add a very subtle natural contact shadow directly beneath the bottle base. Minimal luxury perfume product photography, clean realistic glass reflections, high resolution, photorealistic, centered composition, 1:1 square aspect ratio.`;
