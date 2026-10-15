import { describe, expect, it } from "vitest";
import { perfumeRequestInputSchema } from "./perfume-request";

describe("perfumeRequestInputSchema", () => {
  it("хоосон заавал биш талбаруудыг хоосон мөр болгоно", () => {
    const parsed = perfumeRequestInputSchema.parse({
      brand: "  Dior ",
      name: " Sauvage  ",
    });
    expect(parsed).toEqual({
      brand: "Dior",
      name: "Sauvage",
      concentration: "",
      note: "",
    });
  });

  it("брэнд, нэр заавал", () => {
    const r = perfumeRequestInputSchema.safeParse({ brand: " ", name: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const fields = r.error.flatten().fieldErrors;
      expect(fields.brand).toBeTruthy();
      expect(fields.name).toBeTruthy();
    }
  });

  it("тайлбар 300 тэмдэгтээс хэтрэхгүй", () => {
    const r = perfumeRequestInputSchema.safeParse({
      brand: "Dior",
      name: "Sauvage",
      note: "а".repeat(301),
    });
    expect(r.success).toBe(false);
  });

  it("хуучин формын илүү талбарыг (имэйл) хаяна", () => {
    const parsed = perfumeRequestInputSchema.parse({
      brand: "Dior",
      name: "Sauvage",
      email: "a@b.mn",
    });
    expect(parsed).not.toHaveProperty("email");
  });
});
