import { describe, expect, it } from "vitest";
import { parseExtraSort, sortExtras } from "./sort";

const item = (id: string, over: object = {}) => ({
  id,
  soldOut: false,
  fromPrice: 1000,
  sort: 0,
  categorySort: 0,
  createdAt: "2026-10-01",
  ...over,
});

describe("sortExtras", () => {
  it("дууссан нь сүүлд, үнээр", () => {
    const out = sortExtras(
      [
        item("a", { fromPrice: 500, soldOut: true }),
        item("b", { fromPrice: 3000 }),
        item("c", { fromPrice: 2000 }),
      ],
      "price_asc",
    );
    expect(out.map((i) => i.id)).toEqual(["c", "b", "a"]);
  });
  it("шинэ нь эхэнд", () => {
    const out = sortExtras(
      [
        item("a", { createdAt: "2026-09-01" }),
        item("b", { createdAt: "2026-10-05" }),
      ],
      "new",
    );
    expect(out[0].id).toBe("b");
  });
  it("танихгүй утга → recommended", () => {
    expect(parseExtraSort("x")).toBe("recommended");
    expect(parseExtraSort("new")).toBe("new");
  });
});
