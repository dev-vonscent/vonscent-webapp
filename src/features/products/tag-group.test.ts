import { describe, expect, it } from "vitest";
import { matchesTagGroup, type TagGroupMatch } from "./tag-group";

/** Мөр: тагууд, онцлох эсэх, орсон арга хэмжээ. */
const row = (
  tags: string[] = [],
  featured = false,
  events: string[] = [],
): TagGroupMatch => ({
  tag: (t) => tags.includes(t),
  featured,
  event: (slug) => events.includes(slug),
});

describe("matchesTagGroup — «Таг» бүлэг дотроо OR (0194)", () => {
  it("юу ч сонгоогүй (null/хоосон/false) → шүүлтгүй", () => {
    expect(matchesTagGroup({}, row())).toBe(true);
    expect(
      matchesTagGroup({ tags: [], featured: false, event: "" }, row()),
    ).toBe(true);
    expect(matchesTagGroup({ tags: undefined, event: undefined }, row())).toBe(
      true,
    );
  });

  it("Хямдралтай + арга хэмжээ = аль нэгэнд орсон", () => {
    const f = { tags: ["sale" as const], event: "black-friday" };
    expect(matchesTagGroup(f, row(["sale"]))).toBe(true);
    expect(matchesTagGroup(f, row([], false, ["black-friday"]))).toBe(true);
    expect(matchesTagGroup(f, row(["new"]))).toBe(false);
  });

  it("Онцлох + Шинэ = аль нэгэнд орсон", () => {
    const f = { tags: ["new" as const], featured: true };
    expect(matchesTagGroup(f, row([], true))).toBe(true);
    expect(matchesTagGroup(f, row(["new"]))).toBe(true);
    expect(matchesTagGroup(f, row(["hot"]))).toBe(false);
  });

  it("арга хэмжээ + Эрэлттэй", () => {
    const f = { tags: ["hot" as const], event: "black-friday" };
    expect(matchesTagGroup(f, row(["hot"]))).toBe(true);
    expect(matchesTagGroup(f, row([], false, ["black-friday"]))).toBe(true);
    expect(matchesTagGroup(f, row([], false, ["tsagaan-sar"]))).toBe(false);
  });

  it("featured: false нь «тааралгүй» — бусад гишүүнийг өргөтгөхгүй", () => {
    expect(matchesTagGroup({ featured: false, tags: ["new"] }, row([], true))).toBe(
      false,
    );
  });
});
