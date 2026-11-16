import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandMarquee } from "./brand-marquee";

const brands = (n: number) => Array.from({ length: n }, (_, i) => `Brand ${i + 1}`);

/** Мөр бүрийн [бүх линк, a11y-д харагдах линк]. */
function counts(n: number) {
  const { container } = render(<BrandMarquee brands={brands(n)} logos={{}} />);
  const tracks = container.querySelectorAll(".animate-marquee");
  return [...tracks].map((t) => [
    t.querySelectorAll("a").length,
    t.querySelectorAll('a:not([aria-hidden="true"])').length,
  ]);
}

describe("BrandMarquee", () => {
  it("урт мөр (≥16) хагастаа нэг л хувь — брэнд бүр мөрөнд 2 удаа", () => {
    // 32 брэнд → мөр бүр 16. Өмнө нь 4 удаа (64 линк) байв.
    expect(counts(32)).toEqual([
      [32, 16],
      [32, 16],
    ]);
  });

  it("богино мөр өмнөх шигээ давхарлана — хагас нь мөрөөс өргөн байх ёстой", () => {
    // 12 брэнд → мөр бүр 6 → хагас 12, давталт 24.
    expect(counts(12)).toEqual([
      [24, 12],
      [24, 12],
    ]);
    // 31 брэнд → 16 + 15: эхнийх нь нэг хувь, хоёр дахь нь давхарлана
    // (логогүй нэр нарийн тул 15 нь 2560px-д ч хүрэлцэхгүй байж болно).
    expect(counts(31)).toEqual([
      [32, 16],
      [60, 30],
    ]);
  });

  it("анимацийн хугацаа хагасын уртаар — хурд (px/s) өөрчлөгдөхгүй", () => {
    const { container } = render(
      <BrandMarquee brands={brands(32)} logos={{}} />,
    );
    const track = container.querySelector<HTMLElement>(".animate-marquee")!;
    expect(track.style.animationDuration).toBe("64s");
  });
});
