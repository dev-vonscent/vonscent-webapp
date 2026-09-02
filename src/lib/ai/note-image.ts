import sharp from "sharp";

/**
 * The «үнэрийн нот» picture: the product's own bottle with the raw ingredients
 * of its notes floating behind it, on a pure black backdrop.
 *
 * Documented in `docs/spec/note-images.md`, including the three approaches that
 * were tried and abandoned. Used by both the batch script
 * (`scripts/gen-note-images.ts`) and the new-product pipeline, so the art
 * direction lives here rather than in either caller.
 */

/** Ingredients behind one bottle. More than this reads as a fruit bowl. */
export const MAX_NOTES = 5;

/** Anything this dark or darker is pulled to a true 0,0,0. */
const BLACK_POINT = 16;

/** Above this border-ring luminance the generation is not on black at all. */
const MAX_BACKDROP_LUMA = 12;

export function buildNoteImagePrompt(notes: string[]): string {
  return `Edit the reference photo. Keep the perfume bottle exactly as it is — identical shape, proportions, cap, glass, liquid color, label, logo, typography and reflections — and keep its existing position, scale and framing. Do not move, resize, re-center or crop it.

Delete the original background completely. The pale grey studio sweep, its surface, its horizon and the bottle's cast shadow must be gone entirely — not darkened, not tinted, not left faintly visible. Replace them with empty black space: the bottle now stands in a blacked-out studio against black velvet, photographed with no background light at all. The background is unlit emptiness, pure #000000, RGB 0,0,0, flat and identical in every corner of the frame.

The only lights in the scene are narrow spotlights aimed at the bottle and the ingredients. Their beams are tight enough that no light falls past the subjects and nothing at all illuminates the space behind them.

Directly behind the bottle, floating and suspended in mid-air, weightless, at varied angles: ${notes.join(", ")}. Group them as one tight cluster pressed in close behind the glass, all at roughly the same shallow distance behind it, never scattered or drifting into empty space. They hide behind the bottle and only their outer parts emerge past its silhouette, peeking out from behind its left and right edges and rising just past its shoulder. The bottle overlaps and conceals whatever falls behind it, never the reverse, and nothing passes in front of the glass. They must read as one connected arrangement growing out from behind the bottle.

Render every ingredient in crisp razor-sharp focus with fine visible texture: deep focus, no bokeh, no motion blur. Rim and edge highlights carve each one out of the darkness, and their unlit sides fall away into the black. Dark ingredients — oud, black pepper, dark berries, leather, roasted beans — must keep a bright enough lit edge to stay readable against the black instead of disappearing into it.

Photorealistic cinematic luxury perfume product photography on a black background. No text, no labels, no watermark, no hands, no smoke, no splashes.`;
}

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Median luminance of the outer border ring, 0-255. */
async function borderLuma(input: Buffer): Promise<number> {
  const { data, info } = await sharp(input)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  if (!w || !h) return 0;
  const at = (x: number, y: number) => (y * w + x) * ch;
  const ring: number[] = [];
  const step = Math.max(1, Math.round(Math.min(w, h) / 300));
  for (let x = 0; x < w; x += step)
    for (const y of [0, h - 1]) {
      const i = at(x, y);
      ring.push(luma(data[i], data[i + 1], data[i + 2]));
    }
  for (let y = 0; y < h; y += step)
    for (const x of [0, w - 1]) {
      const i = at(x, y);
      ring.push(luma(data[i], data[i + 1], data[i + 2]));
    }
  ring.sort((a, b) => a - b);
  // The median, not the mean: on a tightly-cropped frame the product itself
  // touches the edge, and one lit corner should not outvote three black sides.
  return ring[Math.floor(ring.length / 2)] ?? 0;
}

/**
 * Finish a generated note image: force the backdrop to a true black, then prove
 * it worked.
 *
 * The model paints the black; this only completes it. Asked for #000000 it
 * lands *near* it — #0A0A0A, a faint vignette, a little light spilling off the
 * subject — because the cinematic lighting it is also being asked for has to
 * fall somewhere. Pulling the black point down maps everything at or under
 * `BLACK_POINT` to a true 0 and stretches the rest back over the full range, so
 * the backdrop is exactly 0,0,0 in every corner while the lit subject keeps its
 * tones.
 *
 * Throws when the picture came back on a grey sweep instead, which no amount of
 * clamping can rescue — better a failed job than a grey card in the gallery.
 */
export async function finishNoteImage(
  input: Buffer,
): Promise<{ webp: Buffer; luma: number }> {
  const a = 255 / (255 - BLACK_POINT);
  const webp = await sharp(input)
    .linear(a, -BLACK_POINT * a)
    .webp({ quality: 82 })
    .toBuffer();

  const measured = await borderLuma(webp);
  if (measured > MAX_BACKDROP_LUMA) {
    throw new Error(`дэвсгэр хар биш (гэрэлтэлт ${measured.toFixed(0)}/255)`);
  }
  return { webp, luma: measured };
}
