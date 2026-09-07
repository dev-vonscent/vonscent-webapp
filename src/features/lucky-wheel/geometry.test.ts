import { describe, expect, it } from "vitest";
import {
  norm360,
  segmentAngle,
  segmentPath,
  slotAtRotation,
  slotCenter,
  targetRotation,
} from "./geometry";

const COUNT = 8;

describe("wheel geometry", () => {
  it("splits the disc evenly", () => {
    expect(segmentAngle(8)).toBe(45);
    expect(slotCenter(1, 8)).toBe(22.5);
    expect(slotCenter(8, 8)).toBe(337.5);
  });

  it("reads slot 1 under the pointer at rest", () => {
    expect(slotAtRotation(0, COUNT)).toBe(1);
    expect(slotAtRotation(-22.5, COUNT)).toBe(1);
  });

  it("lands every slot under the pointer", () => {
    for (let slot = 1; slot <= COUNT; slot++) {
      const rot = targetRotation(0, slot, COUNT);
      expect(slotAtRotation(rot, COUNT)).toBe(slot);
    }
  });

  it("keeps the jittered landing inside its own segment", () => {
    for (let slot = 1; slot <= COUNT; slot++) {
      for (const jitter of [-1, -0.5, 0, 0.5, 1]) {
        const rot = targetRotation(0, slot, COUNT, 6, jitter);
        expect(slotAtRotation(rot, COUNT)).toBe(slot);
      }
    }
  });

  it("always spins forward, from any starting angle", () => {
    for (const from of [0, 17.3, 359, 1234.5, -90]) {
      for (let slot = 1; slot <= COUNT; slot++) {
        const rot = targetRotation(from, slot, COUNT, 6);
        expect(rot).toBeGreaterThanOrEqual(from + 6 * 360);
        expect(rot).toBeLessThan(from + 7 * 360);
        expect(slotAtRotation(rot, COUNT)).toBe(slot);
      }
    }
  });

  it("normalises angles into one turn", () => {
    expect(norm360(-1)).toBe(359);
    expect(norm360(720)).toBe(0);
  });

  it("draws a closed wedge, and a ring when an inner radius is given", () => {
    const wedge = segmentPath(1, 8, 100);
    expect(wedge.startsWith("M 0 0")).toBe(true);
    expect(wedge.endsWith("Z")).toBe(true);
    const ring = segmentPath(1, 8, 100, 40);
    expect(ring.startsWith("M 0 0")).toBe(false);
    expect(ring).toContain("A 40 40");
  });
});
