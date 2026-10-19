import { describe, expect, it } from "vitest";
import { bellLabel, formatBadge, planToasts } from "./lib";
import type { AppNotification } from "./types";

const n = (id: string, read = false): AppNotification => ({
  id,
  kind: "announcement",
  title: `t${id}`,
  body: null,
  url: null,
  imageUrl: null,
  read,
  visibleAt: "2026-10-18T04:00:00Z",
});

describe("formatBadge", () => {
  it("0 бол алга, 1–99, 99+", () => {
    expect(formatBadge(0)).toBeNull();
    expect(formatBadge(-1)).toBeNull();
    expect(formatBadge(1)).toBe("1");
    expect(formatBadge(99)).toBe("99");
    expect(formatBadge(100)).toBe("99+");
  });

  it("aria-label", () => {
    expect(bellLabel(3)).toBe("Мэдэгдэл, уншаагүй 3");
    expect(bellLabel(0)).toBe("Мэдэгдэл");
  });
});

describe("planToasts", () => {
  const base = { initial: false, visible: true, shown: new Set<string>() };

  it("анхны ачаалалд хуучин уншаагүйг toast болгохгүй", () => {
    expect(
      planToasts({ ...base, initial: true, fresh: [n("a")], freshCount: 1 }),
    ).toEqual({ type: "none" });
  });

  it("далд tab toast гаргахгүй", () => {
    expect(
      planToasts({ ...base, visible: false, fresh: [n("a")], freshCount: 1 }),
    ).toEqual({ type: "none" });
  });

  it("1–2 шинэ → тус бүр", () => {
    const plan = planToasts({
      ...base,
      fresh: [n("a"), n("b")],
      freshCount: 2,
    });
    expect(plan).toEqual({ type: "single", items: [n("a"), n("b")] });
  });

  it("2-оос олон → нэг нэгтгэсэн, freshCount-аар (сервер ≤5 буцаана)", () => {
    const fresh = ["a", "b", "c", "d", "e"].map((id) => n(id));
    expect(planToasts({ ...base, fresh, freshCount: 12 })).toEqual({
      type: "summary",
      count: 12,
    });
    expect(
      planToasts({ ...base, fresh: fresh.slice(0, 3), freshCount: 3 }),
    ).toEqual({
      type: "summary",
      count: 3,
    });
  });

  it("өөр tab үзүүлсэн эсвэл аль хэдийн уншсаныг алгасна", () => {
    const shown = new Set(["a"]);
    expect(
      planToasts({
        ...base,
        shown,
        fresh: [n("a"), n("b", true)],
        freshCount: 2,
      }),
    ).toEqual({ type: "none" });
    expect(
      planToasts({ ...base, shown, fresh: [n("a"), n("c")], freshCount: 2 }),
    ).toEqual({ type: "single", items: [n("c")] });
  });
});
