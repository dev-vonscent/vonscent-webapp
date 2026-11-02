import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { tintMask, toBlurBackdrop } from "./process-image";

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

describe("toBlurBackdrop", () => {
  it("WebP-г канвасын хэмжээтэй, бүүдгэр JPEG болгоно", async () => {
    const out = await toBlurBackdrop(await studioWebp(), 1200, 630);
    const meta = await sharp(out!).metadata();
    expect(meta).toMatchObject({ format: "jpeg", width: 1200, height: 630 });
  });

  it("гэрлийг бууруулна — цагаан текст уншигдана", async () => {
    const out = await toBlurBackdrop(await studioWebp(), 1200, 630);
    const { channels } = await sharp(out!).stats();
    expect(channels[0].mean).toBeLessThan(0xec * 0.6);
  });

  it("зураг биш байт бол null", async () => {
    expect(
      await toBlurBackdrop(Buffer.from("<html></html>"), 1200, 630),
    ).toBeNull();
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
    const { data } = await sharp(out!)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([data[0], data[1], data[2], data[3]]).toEqual([
      0x0b, 0x1d, 0x3a, 255,
    ]);
  });
});
