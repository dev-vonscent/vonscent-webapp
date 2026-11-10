import { describe, expect, it } from "vitest";
import {
  extraFilterChips,
  extraFilterKey,
  extraKindName,
} from "./admin-filter";

const cat = (slug: string, name: string) =>
  ({ id: slug, slug, name }) as Parameters<typeof extraFilterChips>[0][number];

describe("админы шүүлт", () => {
  it("«Шилтэй ус»-ыг горимоор хоёр chip болгоно, бусад нь ангиллаараа", () => {
    expect(
      extraFilterChips([
        cat("syringe", "Шприц"),
        cat("bottled", "Шилтэй ус"),
        cat("empty-bottle", "Хоосон шил"),
      ]),
    ).toEqual([
      { key: "syringe", label: "Шприц" },
      { key: "bottled-sealed", label: "Бүтэн шил" },
      { key: "bottled-leftover", label: "Үлдэгдэлтэй шил" },
      { key: "empty-bottle", label: "Хоосон шил" },
    ]);
  });

  it("мөрийн түлхүүр, нэр", () => {
    const row = (categorySlug: string, mode: string) => ({
      categorySlug,
      mode: mode as "local_quantity",
      categoryName: "Шилтэй ус",
    });
    expect(extraFilterKey(row("bottled", "local_quantity"))).toBe(
      "bottled-sealed",
    );
    expect(extraFilterKey(row("bottled", "leftover_liquid"))).toBe(
      "bottled-leftover",
    );
    expect(extraFilterKey(row("vial", "shared_vial"))).toBe("vial");
    expect(extraKindName(row("bottled", "leftover_liquid"))).toBe(
      "Үлдэгдэлтэй шил",
    );
    expect(
      extraKindName({
        ...row("vial", "shared_vial"),
        categoryName: "Грамын сав",
      }),
    ).toBe("Грамын сав");
  });
});
