import { describe, it, expect } from "vitest";
import { mapProduct, type DbProduct } from "./api";

/**
 * «Тун удахгүй» (0125)-ийн гол дүрэм: үлдэгдэл хангалттай байсан ч нэг ч
 * хэмжээ зарагдахгүй. Хурдан нэмэх, сагсны availability, `priceLines` бүгд
 * `sellable`-д найддаг тул энэ нь `comingSoon`-ыг мэдэхгүй уншигчийг ч хаана.
 */
function row(overrides: Partial<DbProduct> = {}): DbProduct {
  return {
    id: "p1",
    slug: "p1",
    name: "Test",
    brand: "Brand",
    description: "",
    notes_description: null,
    usage_description: null,
    notes_top: [],
    notes_heart: [],
    notes_base: [],
    gender: "unisex",
    concentration: "EDP",
    sillage: null,
    longevity: null,
    scent_families: null,
    seasons: null,
    origin_country: null,
    release_year: null,
    bottle_ml: 100,
    rating_avg: 0,
    rating_count: 0,
    is_featured: false,
    created_at: "2026-10-01T00:00:00Z",
    launched_at: "2026-10-02T00:00:00Z",
    status: "active",
    coming_soon_note: null,
    product_images: [],
    product_variants: [
      {
        id: "v5",
        ml: 5,
        price: 30000,
        sale_price: null,
        sale_starts_at: null,
        sale_ends_at: null,
        is_active: true,
      },
      {
        id: "v10",
        ml: 10,
        price: 52000,
        sale_price: null,
        sale_starts_at: null,
        sale_ends_at: null,
        is_active: true,
      },
    ],
    // Хоёр хэмжээг хангалттай дүүргэх үлдэгдэл.
    inventory: { on_hand_ml: 100, reserved_ml: 0, is_sold_out: false },
    product_tags: [],
    ...overrides,
  };
}

describe("mapProduct — «Тун удахгүй»", () => {
  it("идэвхтэй, үлдэгдэлтэй бараа зарагдана (суурь)", () => {
    const p = mapProduct(row());
    expect(p.comingSoon).toBe(false);
    expect(p.soldOut).toBe(false);
    expect(p.variants.every((v) => v.sellable)).toBe(true);
  });

  it("үлдэгдэлтэй ч coming_soon бол бүх хэмжээ sellable=false", () => {
    const p = mapProduct(
      row({
        status: "coming_soon",
        launched_at: null,
        coming_soon_note: "10-р сарын сүүлээр",
      }),
    );
    expect(p.comingSoon).toBe(true);
    expect(p.soldOut).toBe(true);
    expect(p.variants).toHaveLength(2);
    for (const v of p.variants) {
      expect(v.sellable).toBe(false);
      expect(v.inStock).toBe(false);
      // Хэмжээ нь идэвхтэй хэвээр — үнэ нь харагдана.
      expect(v.isActive).toBe(true);
    }
    expect(p.comingSoonNote).toBe("10-р сарын сүүлээр");
  });

  it("үнэ нь мэдэгдэнэ — «-аас» үнэ идэвхтэй хэмжээнээс", () => {
    const p = mapProduct(row({ status: "coming_soon", launched_at: null }));
    expect(p.startingPrice).toBe(30000);
  });

  it("идэвхтэй бараанд note дамжихгүй", () => {
    const p = mapProduct(row({ coming_soon_note: "хуучин тэмдэглэл" }));
    expect(p.comingSoonNote).toBeNull();
  });

  it("«Шинэ» эрэмбийн огноо: launched_at, байхгүй бол created_at", () => {
    expect(mapProduct(row()).createdAt).toBe("2026-10-02T00:00:00Z");
    expect(
      mapProduct(row({ status: "coming_soon", launched_at: null })).createdAt,
    ).toBe("2026-10-01T00:00:00Z");
  });
});

describe("mapProduct — хугацаатай хямдрал (0166)", () => {
  const sale = (patch: Record<string, string | null>) =>
    row({
      product_variants: [
        {
          id: "v5",
          ml: 5,
          price: 30000,
          sale_price: 24000,
          sale_starts_at: null,
          sale_ends_at: null,
          is_active: true,
          ...patch,
        },
      ],
    });

  it("хугацаа дотор хямдарсан үнээр", () => {
    const ends = new Date(Date.now() + 86_400_000).toISOString();
    const [v] = mapProduct(sale({ sale_ends_at: ends })).variants;
    expect(v.price).toBe(24000);
    expect(v.basePrice).toBe(30000);
  });

  it("дууссан хямдрал энгийн үнэ рүү буцна", () => {
    const ended = new Date(Date.now() - 1000).toISOString();
    const p = mapProduct(sale({ sale_ends_at: ended }));
    expect(p.variants[0].price).toBe(30000);
    expect(p.startingPrice).toBe(p.startingBasePrice);
  });

  it("эхлээгүй хямдрал үндсэн үнээр", () => {
    const later = new Date(Date.now() + 86_400_000).toISOString();
    expect(mapProduct(sale({ sale_starts_at: later })).variants[0].price).toBe(
      30000,
    );
  });
});
