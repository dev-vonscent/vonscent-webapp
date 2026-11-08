import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  useBottomBarClaimed,
  useClaimBottomBar,
  usePublishScrollHidden,
  useScrollHidden,
} from "./bottom-nav-store";

describe("bottom-nav-store", () => {
  it("header-ийн гүйлгэлтийн төлөвийг доод цэс уншина, unmount-д буцаана", () => {
    const reader = renderHook(() => useScrollHidden());
    const header = renderHook(({ hidden }) => usePublishScrollHidden(hidden), {
      initialProps: { hidden: false },
    });
    expect(reader.result.current).toBe(false);
    header.rerender({ hidden: true });
    reader.rerender();
    expect(reader.result.current).toBe(true);
    // Header алга болбол цэс нуугдсан чигээрээ гацахгүй.
    header.unmount();
    reader.rerender();
    expect(reader.result.current).toBe(false);
  });

  it("зурвасын эзэмшил гүйлгэлтээс тусдаа", () => {
    const claimed = renderHook(() => useBottomBarClaimed());
    const bar = renderHook(({ on }) => useClaimBottomBar(on), {
      initialProps: { on: true },
    });
    claimed.rerender();
    expect(claimed.result.current).toBe(true);
    bar.rerender({ on: false });
    claimed.rerender();
    expect(claimed.result.current).toBe(false);
  });
});

describe("хуудасны төгсгөл", () => {
  it("доош гүйлгэсэн ч төгсгөлд хүрвэл доод цэс гарна", () => {
    const reader = renderHook(() => useScrollHidden());
    const header = renderHook(
      ({ hidden, atEnd }) => usePublishScrollHidden(hidden, atEnd),
      { initialProps: { hidden: true, atEnd: false } },
    );
    reader.rerender();
    expect(reader.result.current).toBe(true);
    header.rerender({ hidden: true, atEnd: true });
    reader.rerender();
    expect(reader.result.current).toBe(false);
    header.unmount();
  });
});
