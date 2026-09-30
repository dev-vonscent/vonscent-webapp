import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { ProductGallery } from "./product-gallery";

// Embla хэмжээ ажиглахад ResizeObserver хэрэглэдэг — jsdom-д байхгүй.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

describe("ProductGallery", () => {
  it("савны зургийг тайрахгүй, цагаан дэвсгэр дээр бүтнээр харуулна", () => {
    // Утасны слайд 4:5 — дөрвөлжин савны зургийг cover хоёр талаас нь тайрдаг.
    render(
      <ProductGallery
        name="Aventus"
        images={[
          { url: "https://x.test/a.webp", alt: "Packshot" },
          { url: "https://x.test/bottle.webp", alt: "Хар сав", contain: true },
        ]}
      />,
    );
    const [packshot] = screen.getAllByAltText("Packshot");
    const [bottle] = screen.getAllByAltText("Хар сав");
    expect(bottle).toHaveClass("object-contain", "bg-white");
    expect(bottle).not.toHaveClass("object-cover");
    // Бусад зураг хүрээгээ дүүргэсэн хэвээр.
    expect(packshot).toHaveClass("object-cover");
  });
});
