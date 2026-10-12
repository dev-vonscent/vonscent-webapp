import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { toOgImageSrc } from "./og";

afterEach(() => {
  vi.unstubAllGlobals();
});

async function webp() {
  return sharp({
    create: { width: 800, height: 800, channels: 3, background: "#8a6d3b" },
  })
    .webp()
    .toBuffer();
}

describe("toOgImageSrc", () => {
  it("WebP-г satori уншиж чадах JPEG data URL болгоно", async () => {
    const bytes = await webp();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array(bytes))),
    );
    const src = await toOgImageSrc("https://storage.test/a.webp");
    expect(src).toMatch(/^data:image\/jpeg;base64,/);
    const out = await sharp(
      Buffer.from(src!.split(",")[1], "base64"),
    ).metadata();
    expect(out).toMatchObject({ format: "jpeg", width: 460, height: 630 });
  });

  it("татаж чадахгүй бол null (текст карт)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 404 })),
    );
    expect(await toOgImageSrc("https://storage.test/x.webp")).toBeNull();
  });

  it("сүлжээний алдаа бол null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("network");
      }),
    );
    expect(await toOgImageSrc("https://storage.test/x.webp")).toBeNull();
  });

  it("зураг биш байт бол null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html></html>")),
    );
    expect(await toOgImageSrc("https://storage.test/x.webp")).toBeNull();
  });
});
