import { describe, expect, it } from "vitest";
import {
  HERO_AI_MAX_PRODUCTS,
  HERO_AI_SIZES,
  HERO_THEME_KEYS,
  buildHeroPrompt,
} from "./hero-prompt";

/** plan §13.2: сэдэв бүрт бүсийн дүрэм, барааны үнэнч байдал заавал орно. */
describe("buildHeroPrompt", () => {
  for (const theme of HERO_THEME_KEYS) {
    it(`${theme}: desktop бүсийн дүрэм`, () => {
      const p = buildHeroPrompt({ target: "desktop", theme, extra: "x" });
      expect(p).toContain("The left 55% of the frame must stay completely empty");
      expect(p).toContain("2.8:1");
      expect(p).toContain("printed text faithfully");
      expect(p).toContain("no watermark");
    });
    it(`${theme}: mobile бүсийн дүрэм`, () => {
      const p = buildHeroPrompt({ target: "mobile", theme, extra: "x" });
      expect(p).toContain("The left 58% of the frame, including the bottom-left corner,");
      expect(p).toContain("4:3");
    });
  }

  it("нэмэлт тайлбар `Theme details:`-ээр орно, хоосон бол орохгүй", () => {
    expect(
      buildHeroPrompt({ target: "desktop", theme: "winter", extra: "more snow" }),
    ).toContain("Theme details: more snow");
    expect(buildHeroPrompt({ target: "desktop", theme: "winter" })).not.toContain(
      "Theme details:",
    );
  });

  it("mobile: сонгосон desktop-ыг image 2 гэж дурдана", () => {
    expect(
      buildHeroPrompt({ target: "mobile", theme: "winter", withDesktopStyleRef: true }),
    ).toContain("Image 2 is the approved wide version");
    expect(buildHeroPrompt({ target: "mobile", theme: "winter" })).not.toContain(
      "Image 2",
    );
  });

  it("Black Friday: бараан хана (цагаан текст), SALE бичиг хориотой", () => {
    const p = buildHeroPrompt({ target: "desktop", theme: "black_friday" });
    expect(p).toContain("white text");
    expect(p).toContain("no 'SALE'");
  });

  it("Цагаан сар: ул боов, хоол хориотой", () => {
    expect(buildHeroPrompt({ target: "desktop", theme: "tsagaan_sar" })).toContain(
      "no stacked pastries",
    );
  });

  it("хэмжээ 16-ын үржвэр, харьцаа зөв, урт тал < 3840", () => {
    for (const [target, sizes] of Object.entries(HERO_AI_SIZES)) {
      for (const s of Object.values(sizes)) {
        const [w, h] = s.split("x").map(Number);
        expect(w % 16).toBe(0);
        expect(h % 16).toBe(0);
        expect(Math.max(w, h)).toBeLessThan(3840);
        expect(w / h).toBeCloseTo(target === "desktop" ? 2.8 : 4 / 3, 2);
      }
    }
  });
});

describe("buildHeroPrompt — DB-ийн үнэртэн (ихдээ 3)", () => {
  const three = [
    { brand: "Creed", name: "Aventus" },
    { brand: "Parfums de Marly", name: "Layton" },
    { brand: "Dior", name: "Sauvage" },
  ];

  it("desktop: image 1–3 бараа, image 4 scene, байрлал, бүс", () => {
    const p = buildHeroPrompt({ target: "desktop", theme: "black_friday", products: three });
    expect(p).toContain('Images 1–3 are the exact product references');
    expect(p).toContain('image 1 is Creed "Aventus", image 2 is Parfums de Marly "Layton", image 3 is Dior "Sauvage"');
    expect(p).toContain("Image 4 is the scene reference");
    expect(p).toContain("Replace the bottles in image 4 with these 3 products");
    expect(p).toContain("the Creed bottle on the left, the Parfums de Marly bottle in the center, the Dior bottle on the right");
    expect(p).toContain("between 55% and 88% of the frame width");
    expect(p).toContain("The left 55% of the frame must stay completely empty");
    // Restyle хэсгийн «юуг ч бүү хөдөлгө» дүрэм энд хамаарахгүй.
    expect(p).not.toContain("exact scene reference: keep the same perfume bottles");
  });

  it("нэг бараа: ганц тоо, төвд", () => {
    const p = buildHeroPrompt({ target: "desktop", theme: "winter", products: three.slice(0, 1) });
    expect(p).toContain("Image 1 is the exact product reference");
    expect(p).toContain("Image 2 is the scene reference");
    expect(p).toContain("with this product");
    expect(p).toContain("one full-size bottle stands upright");
  });

  it("хоёр бараа: зүүн, баруун", () => {
    const p = buildHeroPrompt({ target: "desktop", theme: "winter", products: three.slice(0, 2) });
    expect(p).toContain("the Creed bottle on the left, the Parfums de Marly bottle on the right");
  });

  it("mobile + сонгосон desktop: дахин зохиомжлох, 62% хоосон", () => {
    const p = buildHeroPrompt({
      target: "mobile",
      theme: "winter",
      products: three,
      withDesktopStyleRef: true,
    });
    expect(p).toContain("Image 4 is the approved wide version of this hero");
    expect(p).toContain("4:3 aspect ratio");
    expect(p).toContain("The left 62% of the frame, including the bottom-left corner,");
    expect(p).toContain("between 62% and 97% of the frame width");
    expect(p).not.toContain("Do not move, enlarge or shift anything");
  });

  it(`${HERO_AI_MAX_PRODUCTS}-аас олныг тасална`, () => {
    const p = buildHeroPrompt({
      target: "desktop",
      theme: "winter",
      products: [...three, { brand: "X", name: "Y" }],
    });
    expect(p).not.toContain('"Y"');
    expect(p).toContain("Image 4 is the scene reference");
  });
});
