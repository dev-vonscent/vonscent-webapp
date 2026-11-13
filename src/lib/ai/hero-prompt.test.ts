import { describe, expect, it } from "vitest";
import {
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
