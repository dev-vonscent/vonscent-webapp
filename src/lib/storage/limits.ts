/**
 * Upload limits shared by the API routes and the browser forms, so the client
 * can reject a file before spending the round trip and both agree on the rule.
 */

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

/**
 * Ceiling on what the upload routes accept. Kept under Vercel's 4.5MB limit on
 * a serverless function's request body — above that the platform answers 413
 * before our handler runs, so a larger value here would only turn a clear
 * error into an opaque one. The browser downscales first (prepare-upload.ts),
 * which puts a phone photo an order of magnitude below this.
 */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB

/**
 * Ceiling on the *original* a browser will take in and downscale. Generous,
 * since a 4032x3024 phone photo is ~8MB; it exists only to refuse something
 * absurd before we spend memory decoding it.
 */
export const MAX_SOURCE_BYTES = 30 * 1024 * 1024; // 30MB

/** Longest edge the browser downscales to before uploading. */
export const UPLOAD_MAX_EDGE = 1600;

/**
 * HEIC is what an iPhone camera writes by default, and no browser but Safari
 * can decode it — nor can the server, whose libheif build has no HEVC decoder.
 * So it can't be converted for the admin, only explained to them.
 */
export const HEIC_TYPES = ["image/heic", "image/heif"];

export const HEIC_MESSAGE =
  "HEIC зургийг дэмждэггүй. iPhone дээр Тохиргоо → Камер → Формат → «Хамгийн нийцтэй» болгоод дахин авна уу.";

/** The `accept` attribute matching ALLOWED_IMAGE_TYPES. */
export const IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(",");
