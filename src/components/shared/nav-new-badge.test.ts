import { describe, expect, it } from "vitest";
import { newBadgeUntil } from "./nav-new-badge";

describe("newBadgeUntil", () => {
  it("тугтай мөр: асаасан цагаас 30 хоног (өгөгдмөл) эсвэл `days`", () => {
    expect(newBadgeUntil({ key: "x" }, true, "2026-11-20T10:00:00.000Z")).toBe(
      "2026-12-20T10:00:00.000Z",
    );
    expect(
      newBadgeUntil({ key: "x", days: 7 }, true, "2026-11-20T10:00:00.000Z"),
    ).toBe("2026-11-27T10:00:00.000Z");
  });

  it("тугтай ч асаасан цаг үгүй/буруу → тэмдэггүй", () => {
    expect(newBadgeUntil({ key: "x" }, true, null)).toBeNull();
    expect(newBadgeUntil({ key: "x" }, true, "буруу")).toBeNull();
  });

  it("туггүй мөр: `until`, байхгүй бол тэмдэггүй", () => {
    expect(
      newBadgeUntil(
        { key: "x", until: "2027-01-01T00:00:00+08:00" },
        false,
        null,
      ),
    ).toBe("2027-01-01T00:00:00+08:00");
    expect(newBadgeUntil({ key: "x" }, false, null)).toBeNull();
  });
});
