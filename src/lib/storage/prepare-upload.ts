import {
  ALLOWED_IMAGE_TYPES,
  HEIC_MESSAGE,
  HEIC_TYPES,
  MAX_IMAGE_BYTES,
  MAX_SOURCE_BYTES,
  UPLOAD_MAX_EDGE,
} from "./limits";

/**
 * Browser-side gate every upload passes through: validate, then downscale.
 *
 * Two things make this necessary rather than a nicety. A serverless function's
 * request body caps at 4.5MB on Vercel, and a modern phone photo is ~8MB — so
 * without shrinking first the upload fails at the platform, before any of our
 * code runs. And uploading 8MB over a mobile connection is slow enough that the
 * admin feels it on every image.
 *
 * The server still re-encodes what arrives (process-image.ts); nothing here is
 * trusted. This just means the server almost always receives an image that is
 * already the right size, and the admin gets told *why* when a file can't be
 * used instead of watching a request fail.
 */

export type PreparedUpload =
  | { ok: true; file: File }
  | { ok: false; message: string };

function isHeic(file: File): boolean {
  // Chrome reports "" for a .heic file rather than a HEIC MIME type, so the
  // extension is the reliable half of this check.
  return HEIC_TYPES.includes(file.type) || /\.(heic|heif)$/i.test(file.name);
}

/**
 * Decode, fit inside `maxEdge`, and re-encode as JPEG.
 *
 * JPEG rather than WebP on purpose: the server re-encodes to WebP anyway, and
 * going WebP → WebP would stack two lossy passes over the same pixels. A high
 * quality JPEG in between costs a few hundred KB of upload and keeps the only
 * visible encode the one sharp does.
 */
async function downscale(file: File, maxEdge: number): Promise<File | null> {
  if (typeof createImageBitmap !== "function") return file; // ancient browser
  let bitmap: ImageBitmap;
  try {
    // EXIF orientation is applied here, then lost with the rest of the
    // metadata — a portrait photo would otherwise upload on its side.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null; // not a decodable image
  }

  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= MAX_IMAGE_BYTES) return file;

    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    // Halve repeatedly down to the target. One big canvas step samples too few
    // source pixels and visibly softens the shot; stepping keeps the detail.
    let canvas = document.createElement("canvas");
    let ctx = canvas.getContext("2d");
    if (!ctx) return file;
    let w = bitmap.width;
    let h = bitmap.height;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();

    while (w > width * 2) {
      w = Math.max(width, Math.round(w / 2));
      h = Math.max(height, Math.round(h / 2));
      const next = document.createElement("canvas");
      next.width = w;
      next.height = h;
      const nctx = next.getContext("2d");
      if (!nctx) break;
      nctx.imageSmoothingQuality = "high";
      nctx.drawImage(canvas, 0, 0, w, h);
      canvas = next;
      ctx = nctx;
    }

    if (w !== width || h !== height) {
      const final = document.createElement("canvas");
      final.width = width;
      final.height = height;
      const fctx = final.getContext("2d");
      if (!fctx) return file;
      fctx.imageSmoothingQuality = "high";
      fctx.drawImage(canvas, 0, 0, width, height);
      canvas = final;
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file; // canvas trouble — let the server have the original
  }
}

/**
 * Validate and shrink `file` for upload. On failure the message is ready to
 * show the admin as-is.
 */
export async function prepareUpload(
  file: File,
  maxEdge: number = UPLOAD_MAX_EDGE,
): Promise<PreparedUpload> {
  if (isHeic(file)) {
    return { ok: false, message: HEIC_MESSAGE };
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return {
      ok: false,
      message: `${Math.round(MAX_SOURCE_BYTES / 1024 / 1024)}MB-аас том байна.`,
    };
  }
  // An unrecognised type is only rejected if we also can't decode it, so a
  // valid image the browser happens to label oddly still gets through.
  const shrunk = await downscale(file, maxEdge);
  if (!shrunk) {
    return {
      ok: false,
      message: ALLOWED_IMAGE_TYPES.includes(file.type)
        ? "Зургийг уншиж чадсангүй."
        : "Зөвхөн JPG / PNG / WebP / AVIF байна.",
    };
  }
  if (shrunk.size > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      message: `${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)}MB-аас том байна.`,
    };
  }
  return { ok: true, file: shrunk };
}
