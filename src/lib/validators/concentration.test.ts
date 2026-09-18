import { describe, it, expect } from "vitest";
import {
  concentrationCreateSchema,
  concentrationPatchSchema,
} from "@/lib/validators/concentration";

/**
 * Товчлол нь `products.concentration`-ийн FK утга (0085) — «EDP » ба «EDP»
 * хоёр тусдаа мөр болбол барааны хуудсанд ялгаагүй харагдах ч жагсаалт
 * хуваагдана. Тиймээс зай цэвэрлэх нь гоо сайхны биш, өгөгдлийн дүрэм.
 */

describe("concentrationCreateSchema", () => {
  it("trims and collapses whitespace in the code", () => {
    const r = concentrationCreateSchema.safeParse({ code: "  Eau   Fraiche " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBe("Eau Fraiche");
  });

  it("defaults the long name to an empty string", () => {
    const r = concentrationCreateSchema.safeParse({ code: "EDP" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.label).toBe("");
  });

  it("rejects a code of nothing but spaces", () => {
    expect(concentrationCreateSchema.safeParse({ code: "   " }).success).toBe(
      false,
    );
  });

  it("rejects a code past the column's limit", () => {
    expect(
      concentrationCreateSchema.safeParse({ code: "E".repeat(41) }).success,
    ).toBe(false);
  });
});

describe("concentrationPatchSchema", () => {
  it("accepts a single field", () => {
    const r = concentrationPatchSchema.safeParse({ label: "Eau de Parfum" });
    expect(r.success).toBe(true);
  });

  it("rejects an empty patch", () => {
    expect(concentrationPatchSchema.safeParse({}).success).toBe(false);
  });

  it("allows hiding a type without touching its name", () => {
    const r = concentrationPatchSchema.safeParse({ isActive: false });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.code).toBeUndefined();
  });
});
