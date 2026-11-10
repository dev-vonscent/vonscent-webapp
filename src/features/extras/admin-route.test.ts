import { describe, it, expect, vi } from "vitest";
import type { ExtraSaveInput } from "@/lib/validators/extras";

vi.mock("server-only", () => ({}));

const { savePayload } = await import("./admin-route");

const input = {
  mode: "local_quantity",
  name: "Гоёмсог бэлгийн сав",
  description: "",
  images: [],
  sort: 0,
  variants: [],
} as unknown as ExtraSaveInput;

/**
 * Slug нь барааны URL — засах үед өөрчлөгдвөл хуучин холбоос 404 болно.
 * SQL `slug = coalesce(v_slug, slug)` тул null илгээвэл хуучин нь үлдэнэ.
 */
describe("savePayload slug", () => {
  it("шинэ бараанд нэрээс slug үүсгэнэ", () => {
    expect(savePayload(input, { categoryId: "cat-1" }).slug).toBeTruthy();
  });

  it("засахад slug илгээхгүй — нэр солигдсон ч URL хэвээр", () => {
    expect(
      savePayload({ ...input, name: "Шинэ нэр" }, { id: "x-1" }).slug,
    ).toBeNull();
  });
});
