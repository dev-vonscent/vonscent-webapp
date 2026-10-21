import { describe, expect, it } from "vitest";
import { currentBottleStyle, isBottleImageUrl } from "./bottle";

const URL_ = (name: string) =>
  `https://x.supabase.co/storage/v1/object/public/media/products/a-b/${name}`;

describe("isBottleImageUrl", () => {
  it("recognises the copies addBottleImage makes", () => {
    expect(
      isBottleImageUrl(
        URL_("bottle-3f2c1a9e-1111-4222-8333-444455556666.webp"),
      ),
    ).toBe(true);
    expect(isBottleImageUrl(URL_("ai-3f2c1a9e.png"))).toBe(false);
  });
});

describe("currentBottleStyle", () => {
  const bottle = URL_("bottle-3f2c1a9e-1111-4222-8333-444455556666.webp");

  it("reads the style from the bottle image's alt", () => {
    expect(
      currentBottleStyle([
        { url: URL_("a.webp"), alt: "Хар сав" },
        { url: bottle, alt: "Ягаан сав" },
      ]),
    ).toBe("pink");
  });

  it("is null without a bottle image and unknown for an edited alt", () => {
    expect(currentBottleStyle([{ url: URL_("a.webp"), alt: "" }])).toBeNull();
    expect(currentBottleStyle([{ url: bottle, alt: "сав" }])).toBe("unknown");
  });
});
