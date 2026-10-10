import { describe, expect, it } from "vitest";
import { SAMPLE_COUNT, nextDpr } from "./adaptive-dpr";

const frames = (ms: number, n = SAMPLE_COUNT) => Array(n).fill(ms);

describe("nextDpr", () => {
  it("дээж хүрэлцэхгүй бол өөрчлөхгүй", () => {
    expect(nextDpr(frames(40, SAMPLE_COUNT - 1), 2)).toBe(2);
  });

  it("60fps (16.7мс) бол хэвээр", () => {
    expect(nextDpr(frames(16.7), 2)).toBe(2);
  });

  it("удаан бол нэг шат буурна: 2 → 1.5 → 1", () => {
    expect(nextDpr(frames(30), 2)).toBe(1.5);
    expect(nextDpr(frames(30), 1.5)).toBe(1);
  });

  it("1-ээс доош буурахгүй", () => {
    expect(nextDpr(frames(50), 1)).toBe(1);
  });

  it("дэлгэцийн dpr бутархай (1.75) байсан ч дараагийн шат руу", () => {
    expect(nextDpr(frames(30), 1.75)).toBe(1.5);
  });

  it("цөөн гацалт (медиан) шийдвэрийг хөдөлгөхгүй", () => {
    const f = [...frames(16, SAMPLE_COUNT - 10), ...frames(200, 10)];
    expect(nextDpr(f, 2)).toBe(2);
  });
});
