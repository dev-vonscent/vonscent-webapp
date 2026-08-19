import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { IMAGE_PRESETS, presetForFolder, processImage } from "./process-image";

/** A solid-colour JPEG of the given size — stands in for a camera original. */
function jpeg(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 180, g: 140, b: 90 },
    },
  })
    .jpeg({ quality: 95 })
    .toBuffer();
}

describe("processImage", () => {
  it("bounds the longest edge and keeps the aspect ratio", async () => {
    const out = await processImage(await jpeg(4000, 3000), IMAGE_PRESETS.photo);
    expect(out).not.toBeNull();
    expect(out!.width).toBe(1600);
    expect(out!.height).toBe(1200);
  });

  it("bounds a portrait image by its height", async () => {
    const out = await processImage(await jpeg(3000, 4000), IMAGE_PRESETS.photo);
    expect(out!.width).toBe(1200);
    expect(out!.height).toBe(1600);
  });

  it("re-encodes to WebP whatever the source format", async () => {
    const png = await sharp({
      create: {
        width: 800,
        height: 800,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer();
    const out = await processImage(png, IMAGE_PRESETS.icon);
    expect(out!.contentType).toBe("image/webp");
    expect(out!.ext).toBe("webp");
    // The magic bytes, so this checks the encoding and not just our label.
    expect(out!.data.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("leaves an image smaller than the bound alone", async () => {
    const out = await processImage(await jpeg(120, 90), IMAGE_PRESETS.photo);
    expect(out!.width).toBe(120);
    expect(out!.height).toBe(90);
  });

  it("shrinks a camera-sized original by an order of magnitude", async () => {
    const src = await jpeg(4000, 3000);
    const out = await processImage(src, IMAGE_PRESETS.photo);
    expect(out!.data.length).toBeLessThan(src.length / 10);
  });

  it("returns null for bytes that aren't an image", async () => {
    const out = await processImage(
      Buffer.from("not an image at all"),
      IMAGE_PRESETS.photo,
    );
    expect(out).toBeNull();
  });
});

describe("presetForFolder", () => {
  it("maps each upload folder to its preset", () => {
    expect(presetForFolder("products")).toBe(IMAGE_PRESETS.photo);
    expect(presetForFolder("products/new")).toBe(IMAGE_PRESETS.photo);
    expect(presetForFolder("blog")).toBe(IMAGE_PRESETS.photo);
    expect(presetForFolder("avatars")).toBe(IMAGE_PRESETS.avatar);
    expect(presetForFolder("families")).toBe(IMAGE_PRESETS.icon);
  });

  it("falls back to the photo preset for an unknown folder", () => {
    expect(presetForFolder("something-new")).toBe(IMAGE_PRESETS.photo);
  });
});
