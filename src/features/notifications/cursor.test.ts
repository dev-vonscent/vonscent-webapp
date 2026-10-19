import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor, laterOf, ZERO_UUID } from "./cursor";

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

  it("өндөр жилийн 2-р сарын 29", () => {
    const c = { visibleAt: "2028-02-29T23:59:59+08:00", id };
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
    // Date.parse хүлээн авдаг ч Postgres татгалзана (→ 500 биш 400).
    btoa(`2026-02-30T00:00:00Z|${id}`),
    btoa(`2026-10-18T24:00:00Z|${id}`),
    btoa(`0000-01-01T00:05:00Z|${id}`),
    btoa(`2026-13-01T00:00:00Z|${id}`),
  ])("буруу cursor → null: %j", (raw) => {
    expect(decodeCursor(raw)).toBeNull();
  });
});

describe("laterOf", () => {
  const a = { visibleAt: "2026-10-18T04:00:00.000+00:00", id };
  const b = { visibleAt: "2026-10-18T04:05:00Z", id: ZERO_UUID };

  it("cursor зөвхөн урагшилна", () => {
    expect(laterOf(a, b)).toBe(b);
    expect(laterOf(b, a)).toBe(b);
  });

  it("тэнцүү бол эхнийхийг үлдээнэ (өөр timezone бичлэг)", () => {
    const same = { visibleAt: "2026-10-18T12:00:00+08:00", id: ZERO_UUID };
    expect(laterOf(a, same)).toBe(a);
  });
});
