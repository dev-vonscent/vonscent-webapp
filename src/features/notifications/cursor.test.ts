import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, ZERO_UUID } from "./cursor";

const id = "6f1c1f9e-7d1a-4f43-9a3c-6a1d2b3c4d5e";

describe("notification cursor", () => {
  it("микросекундтэй timestamptz-ийг өөрчлөхгүй буцаана", () => {
    const c = { visibleAt: "2026-10-18T04:00:00.123456+00:00", id };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it("JS ISO (Z) ба ZERO_UUID", () => {
    const c = { visibleAt: "2026-10-18T04:00:00.123Z", id: ZERO_UUID };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it("URL-д аюулгүй (base64url)", () => {
    const raw = encodeCursor({
      visibleAt: "2026-10-18T04:00:00.999999+08:00",
      id,
    });
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    "",
    "!!!",
    btoa("2026-10-18T04:00:00Z"),
    btoa(`not-a-date|${id}`),
    btoa("2026-10-18T04:00:00Z|not-a-uuid"),
    btoa(`2026-10-18T04:00:00Z|${id}|extra`),
    btoa(`2026-10-18T04:00:00Z",id.gt.0|${id}`),
  ])("буруу cursor → null: %j", (raw) => {
    expect(decodeCursor(raw)).toBeNull();
  });
});
