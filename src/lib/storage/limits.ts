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

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

/** The `accept` attribute matching ALLOWED_IMAGE_TYPES. */
export const IMAGE_ACCEPT = ALLOWED_IMAGE_TYPES.join(",");
