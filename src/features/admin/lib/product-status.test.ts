import { describe, expect, it } from "vitest";
import {
  canBeComingSoon,
  isReadyToLaunch,
  statusConflict,
} from "./product-status";

describe("canBeComingSoon", () => {
  it("хэзээ ч гараагүй бараа «Тун удахгүй» болж чадна", () => {
    expect(canBeComingSoon(null)).toBe(true);
  });

  it("нэг удаа гарсан бараа чадахгүй — нуусан ч гэсэн", () => {
    expect(canBeComingSoon("2026-10-01T00:00:00Z")).toBe(false);
  });
});

describe("isReadyToLaunch", () => {
  it("«Тун удахгүй» + үлдэгдэлтэй = ус ирсэн, гаргахад бэлэн", () => {
    expect(isReadyToLaunch({ status: "coming_soon", availableMl: 100 })).toBe(
      true,
    );
  });

  it("үлдэгдэлгүй бол хараахан ирээгүй", () => {
    expect(isReadyToLaunch({ status: "coming_soon", availableMl: 0 })).toBe(
      false,
    );
  });

  it.each(["active", "hidden"] as const)("%s бараанд хамаарахгүй", (status) => {
    expect(isReadyToLaunch({ status, availableMl: 100 })).toBe(false);
  });
});

describe("statusConflict", () => {
  it("DB-ийн ALREADY_LAUNCHED-ийг админд ойлгомжтой болгоно", () => {
    const res = statusConflict(
      "ALREADY_LAUNCHED (check_violation) at function products_status_sync",
    );
    expect(res?.code).toBe("ALREADY_LAUNCHED");
    expect(res?.error).toContain("Тун удахгүй");
  });

  it.each(["STATUS_ACTIVE_MISMATCH", "LAUNCHED_AT_IMMUTABLE"])(
    "%s-г таньна",
    (code) => {
      expect(statusConflict(`ERROR: ${code}`)?.code).toBe(code);
    },
  );

  it("бусад алдаа бол null — route өөрийн 500-гаа буцаана", () => {
    expect(statusConflict("duplicate key value")).toBeNull();
    expect(statusConflict(undefined)).toBeNull();
  });
});
