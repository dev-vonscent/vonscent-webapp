import sharp from "sharp";

/**
 * Is this packshot on a white background?
 *
 * The client asked for white-background product shots, and the source URL
 * never tells you: a brand PDP shot on a pale-grey studio sweep downloads
 * exactly like a cut-out on white. So each candidate is measured instead.
 *
 * Sampling the four corners is the cheap approximation — on a centred packshot
 * they are pure background — and the *darkest* one is what counts, because
 * these sweeps are usually vignetted, white in the middle and grey at the
 * edges. That is also why nothing here tries to *fix* a grey backdrop: a
 * global tone curve strong enough to lift a vignetted corner to white blows
 * out the bottle, and a flood-fill segmentation walks straight through an
 * anti-aliased edge and eats the product. Measure, prefer a whiter source,
 * and report what stayed grey.
 */

/** Border-ring median luminance at or above this counts as a white background. */
export const WHITE_LUMA = 244;

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}

/**
 * Median luminance of the outer border ring, 0-255.
 *
 * The ring rather than the four corners: a tightly-cropped packshot puts the
 * bottle *in* the corners, and corner sampling then reports a white shot as
 * dark — Fragrantica's Eros render measured 135 on a plainly white background
 * for exactly that reason. Taking the median around the whole frame lets the
 * white majority outvote the edges the product happens to touch.
 */
export async function backgroundLuma(input: Buffer): Promise<number> {
  // Flattened first, so a transparent cut-out measures as the white shot it
  // becomes once stored.
  const { data, info } = await sharp(input)
    .flatten({ background: "#ffffff" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  if (!w || !h) return 0;

  const at = (x: number, y: number) => (y * w + x) * channels;
  const ring: number[] = [];
  const band = Math.max(1, Math.round(Math.min(w, h) * 0.01));
  const step = Math.max(1, Math.round(Math.min(w, h) / 300));
  for (let d = 0; d < band; d++) {
    for (let x = 0; x < w; x += step)
      for (const y of [d, h - 1 - d]) {
        const i = at(x, y);
        ring.push(luma(data[i], data[i + 1], data[i + 2]));
      }
    for (let y = 0; y < h; y += step)
      for (const x of [d, w - 1 - d]) {
        const i = at(x, y);
        ring.push(luma(data[i], data[i + 1], data[i + 2]));
      }
  }
  return Math.round(median(ring));
}
