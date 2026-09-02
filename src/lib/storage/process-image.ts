import "server-only";
import type { Sharp } from "sharp";

/**
 * Normalise an uploaded image before it reaches Storage.
 *
 * Everything is re-encoded to WebP at a bounded size, which keeps three costs
 * down at once: the bytes we store, the bytes Vercel's image optimizer pulls
 * back out of Storage per variant, and the time the admin waits on an upload.
 * Originals off a phone are routinely 3-4MB; the same image at 1600px WebP is
 * well under 200KB with no visible loss at the sizes we ever render.
 *
 * It takes a buffer rather than a File so anything producing image bytes can
 * reuse it — the upload routes today, generated product imagery later.
 */

/** Bounding box + quality per kind of image; see PRESET_BY_FOLDER. */
export interface ImagePreset {
  /** Longest-edge bound. Never enlarged — a smaller source is left alone. */
  maxEdge: number;
  quality: number;
}

export const IMAGE_PRESETS = {
  /** Product galleries and blog covers — the only images shown large. */
  photo: { maxEdge: 1600, quality: 82 },
  /** Profile pictures, rendered at ~96px but kept retina-sized. */
  avatar: { maxEdge: 512, quality: 80 },
  /** Scent-family icons, rendered at 48px (icon-upload.tsx). */
  icon: { maxEdge: 256, quality: 85 },
} as const satisfies Record<string, ImagePreset>;

export type PresetName = keyof typeof IMAGE_PRESETS;

/**
 * Which preset a destination folder gets. Keyed by the folder values the two
 * upload routes accept; anything unrecognised falls back to `photo`, the
 * conservative choice since it bounds the least.
 */
const PRESET_BY_FOLDER: Record<string, PresetName> = {
  products: "photo",
  "products/new": "photo",
  blog: "photo",
  avatars: "avatar",
  families: "icon",
  marketing: "photo",
};

export function presetForFolder(folder: string): ImagePreset {
  return IMAGE_PRESETS[PRESET_BY_FOLDER[folder] ?? "photo"];
}

export interface ProcessedImage {
  data: Buffer;
  contentType: "image/webp";
  /** File extension to use in the object path, without the dot. */
  ext: "webp";
  width: number;
  height: number;
}

/**
 * `sharp` is a native module: on a serverless host a missing or wrong-arch
 * binary throws at *import* time, which crashed the whole upload route before
 * any handler code ran — the browser saw a bodyless 500 and the admin saw
 * "Сервер хариу өгсөнгүй". Loading it lazily turns that into a named error the
 * route can report and Sentry can capture.
 */
export class ImageToolUnavailableError extends Error {
  constructor(cause: unknown) {
    super("sharp (image processing) failed to load");
    this.name = "ImageToolUnavailableError";
    this.cause = cause;
  }
}

let sharpFactory: ((...args: never[]) => Sharp) | null = null;

async function loadSharp() {
  if (!sharpFactory) {
    try {
      const mod = await import("sharp");
      sharpFactory = mod.default as unknown as (...args: never[]) => Sharp;
    } catch (err) {
      throw new ImageToolUnavailableError(err);
    }
  }
  return sharpFactory as unknown as typeof import("sharp").default;
}

/**
 * Resize to fit `preset.maxEdge` and re-encode as WebP. Returns null when the
 * bytes aren't a decodable image, which the caller should treat as a bad
 * upload rather than a server fault — the MIME check upstream only reads the
 * client's claim about the file.
 */
export async function processImage(
  input: ArrayBuffer | Uint8Array | Buffer,
  preset: ImagePreset,
): Promise<ProcessedImage | null> {
  const buffer = Buffer.isBuffer(input)
    ? input
    : Buffer.from(input as ArrayBuffer);
  const sharp = await loadSharp();
  try {
    const { data, info } = await sharp(buffer, { failOn: "error" })
      // Phone cameras store orientation in EXIF; bake it in before we strip
      // the metadata, or portrait shots come back on their side.
      .rotate()
      .resize({
        width: preset.maxEdge,
        height: preset.maxEdge,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: preset.quality })
      .toBuffer({ resolveWithObject: true });

    return {
      data,
      contentType: "image/webp",
      ext: "webp",
      width: info.width,
      height: info.height,
    };
  } catch {
    return null;
  }
}
