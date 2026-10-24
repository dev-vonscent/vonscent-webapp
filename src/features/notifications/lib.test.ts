import { describe, expect, it } from "vitest";
import { bellLabel, formatBadge, planToasts, trackPoll } from "./lib";
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

  it("2-оос олон → нэг нэгтгэсэн, freshCount-аар (сервер ≤20 буцаана)", () => {
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

  it("давхацсан цонх: өмнө үзүүлсэн мөр илүүдлийн тоонд орохгүй", () => {
    const old = Array.from({ length: 19 }, (_, i) => `o${i}`);
    const shown = new Set(old);
    const fresh = [n("new"), ...old.map((id) => n(id))];
    expect(planToasts({ ...base, shown, fresh, freshCount: 22 })).toEqual({
      type: "single",
      items: [n("new")],
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

describe("trackPoll", () => {
  it("ижил epoch: зөвхөн шинэ seq-ийг боловсруулна", () => {
    const mark = { epoch: 1, seq: 2 };
    expect(trackPoll(mark, { epoch: 1, seq: 2 })).toEqual({
      mark,
      reset: false,
      process: false,
    });
    expect(trackPoll(mark, { epoch: 1, seq: 3 })).toEqual({
      mark: { epoch: 1, seq: 3 },
      reset: false,
      process: true,
    });
  });

  it("гарч орсон (шинэ epoch, seq 1) — reset хийж анхны хариуг боловсруулна", () => {
    expect(trackPoll({ epoch: 1, seq: 1 }, { epoch: 2, seq: 1 })).toEqual({
      mark: { epoch: 2, seq: 1 },
      reset: true,
      process: true,
    });
  });
});
