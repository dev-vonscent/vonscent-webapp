import { describe, it, expect } from "vitest";
import { cardStatus, preferredStatuses } from "./card-status";

describe("cardStatus", () => {
  it("Эрэлттэй → Шинэ → Онцлох дарааллаар нэгийг", () => {
    expect(cardStatus({ tags: ["new", "hot"], isFeatured: true })).toBe("hot");
    expect(cardStatus({ tags: ["new", "sale"], isFeatured: true })).toBe("new");
    expect(cardStatus({ tags: ["sale"], isFeatured: true })).toBe("featured");
    expect(cardStatus({ tags: ["sale"], isFeatured: false })).toBeNull();
  });

  it("харж буй жагсаалтын төлөв түрүүлнэ", () => {
    const item = { tags: ["hot", "new"] as const, isFeatured: true };
    expect(cardStatus(item, ["featured"])).toBe("featured");
    expect(cardStatus(item, ["new"])).toBe("new");
    // Тэр төлөвгүй бол ердийн дараалал.
    expect(cardStatus({ tags: ["hot"], isFeatured: false }, ["featured"])).toBe(
      "hot",
    );
  });
});

describe("preferredStatuses", () => {
  it("онцлох, таг (хямдралаас бусад)", () => {
    expect(
      preferredStatuses({ featured: true, tags: ["sale", "new"] }),
    ).toEqual(["featured", "new"]);
    expect(preferredStatuses({})).toEqual([]);
  });
});
