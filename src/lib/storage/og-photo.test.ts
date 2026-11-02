import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { tintMask, toOgPhoto } from "./process-image";

/** Portrait "studio shot": beige backdrop with a dark bottle in the middle. */
async function studioWebp() {
  const bottle = await sharp({
    create: { width: 200, height: 500, channels: 3, background: "#101830" },
  })
    .png()
    .toBuffer();
  return sharp({
    create: { width: 800, height: 1000, channels: 3, background: "#ece6dc" },
  })
    .composite([{ input: bottle, left: 300, top: 300 }])
    .webp()
    .toBuffer();
}

describe("toOgPhoto", () => {
  it("WebP-г JPEG болгож, дээд ирмэгийн өнгийг буцаана", async () => {
    const out = await toOgPhoto(await studioWebp(), 600, 630);
    expect(out).not.toBeNull();
    const [r, g, b] = out!.bg;
    expect(Math.abs(r - 0xec)).toBeLessThan(6);
    expect(Math.abs(g - 0xe6)).toBeLessThan(6);
    expect(Math.abs(b - 0xdc)).toBeLessThan(6);
    const meta = await sharp(out!.jpeg).metadata();
    expect(meta).toMatchObject({ format: "jpeg", width: 600, height: 630 });
  });

  it("шилийг тайрахгүй — хажуугийн зай нь ирмэгийн өнгөөр дүүрнэ", async () => {
    const out = await toOgPhoto(await studioWebp(), 600, 630);
    const { data } = await sharp(out!.jpeg)
      .extract({ left: 0, top: 300, width: 4, height: 4 })
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(Math.abs(data[0] - 0xec)).toBeLessThan(8);
  });

  it("зураг биш байт бол null", async () => {
    expect(await toOgPhoto(Buffer.from("<html></html>"), 600, 630)).toBeNull();
  });
});

describe("tintMask", () => {
  it("alpha mask-ийг өгсөн өнгөөр будна", async () => {
    const mask = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    const out = await tintMask(mask, "#0b1d3a");
    const { data } = await sharp(out!).raw().toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2], data[3]]).toEqual([0x0b, 0x1d, 0x3a, 255]);
  });
});
