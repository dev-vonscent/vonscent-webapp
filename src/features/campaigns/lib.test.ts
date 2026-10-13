import { describe, expect, it } from "vitest";
import {
  addDays,
  campaignPhase,
  couponEndsOn,
  overlapMessage,
  periodsOverlap,
} from "./lib";

const c = { isActive: true, startsOn: "2026-10-15", endsOn: "2026-10-31" };

describe("campaignPhase", () => {
  it("эхлэх ба дуусах өдөр хоёулаа хугацаанд орно (00:00:00 — 23:59:59)", () => {
    expect(campaignPhase(c, "2026-10-15")).toBe("live");
    expect(campaignPhase(c, "2026-10-31")).toBe("live");
  });

  it("эхлэхээс өмнө товлосон, дууссаны дараа дууссан", () => {
    expect(campaignPhase(c, "2026-10-14")).toBe("scheduled");
    expect(campaignPhase(c, "2026-11-01")).toBe("ended");
  });

  it("унтраасан нь хугацаанаас давамгайлна", () => {
    expect(campaignPhase({ ...c, isActive: false }, "2026-10-20")).toBe("off");
  });
});

describe("periodsOverlap", () => {
  it("нэг өдөр ч давхцвал давхцал", () => {
    const next = { ...c, startsOn: "2026-10-31", endsOn: "2026-11-30" };
    expect(periodsOverlap(c, next)).toBe(true);
  });

  it("залгаа өдрүүд давхцахгүй", () => {
    const next = { ...c, startsOn: "2026-11-01", endsOn: "2026-11-30" };
    expect(periodsOverlap(c, next)).toBe(false);
  });
});

describe("couponEndsOn", () => {
  it("олгосон өдрийг оролцуулан N хоног", () => {
    expect(couponEndsOn("2026-10-13", 30)).toBe("2026-11-11");
    expect(couponEndsOn("2026-12-28", 7)).toBe("2027-01-03");
  });

  it("1 хоног = зөвхөн олгосон өдөр", () => {
    expect(couponEndsOn("2026-10-13", 1)).toBe("2026-10-13");
  });

  it("сарын хил", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
  });
});

describe("overlapMessage", () => {
  it("SQL-ийн алдаанаас кампанит ажлын нэрийг гаргана", () => {
    expect(overlapMessage("CAMPAIGN_OVERLAP:Шинэ жил")).toContain("«Шинэ жил»");
    expect(overlapMessage("duplicate key")).toBeNull();
  });
});
