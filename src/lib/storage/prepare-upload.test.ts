import { describe, expect, it } from "vitest";
import { prepareUpload } from "./prepare-upload";
import { HEIC_MESSAGE, MAX_IMAGE_BYTES, MAX_SOURCE_BYTES } from "./limits";

/**
 * Node has no `createImageBitmap`, so downscale() takes its early return and
 * these cover the validation around it — the part that decides what the admin
 * is told. The resizing itself is browser-only and exercised by hand.
 */
function file(name: string, type: string, bytes = 1024) {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("prepareUpload", () => {
  it("rejects a HEIC by MIME type with the iPhone instruction", async () => {
    const r = await prepareUpload(file("IMG_0001.HEIC", "image/heic"));
    expect(r).toEqual({ ok: false, message: HEIC_MESSAGE });
  });

  it("rejects a HEIC by extension when the browser reports no type", async () => {
    // Chrome leaves `type` empty for .heic, so the name is the only signal.
    const r = await prepareUpload(file("IMG_0002.heic", ""));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toBe(HEIC_MESSAGE);
  });

  it("rejects .heif too", async () => {
    const r = await prepareUpload(file("photo.heif", ""));
    expect(r.ok === false && r.message).toBe(HEIC_MESSAGE);
  });

  it("refuses a source too large to be worth decoding", async () => {
    const r = await prepareUpload(
      file("huge.jpg", "image/jpeg", MAX_SOURCE_BYTES + 1),
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toMatch(/30MB/);
  });

  it("passes a normal photo through", async () => {
    const f = file("bottle.jpg", "image/jpeg");
    const r = await prepareUpload(f);
    expect(r).toEqual({ ok: true, file: f });
  });

  it("refuses a file still over the route's cap once downscaling is unavailable", async () => {
    const r = await prepareUpload(
      file("big.jpg", "image/jpeg", MAX_IMAGE_BYTES + 1),
    );
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.message).toMatch(/4MB/);
  });
});

describe("limits", () => {
  it("keeps the route cap under Vercel's 4.5MB request body limit", () => {
    expect(MAX_IMAGE_BYTES).toBeLessThan(4.5 * 1024 * 1024);
  });
});
