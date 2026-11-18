import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SaleEventAdminRow } from "../../types";

/**
 * Хадгалсны дараа `router.refresh()` (PR #289): client router cache
 * (`staleTimes.dynamic`, back/forward)-аас студи хуучин мөрөөр нээгдэж,
 * дараагийн хадгалалт админы хараагүй багцыг устгаж байсан («LADIES NIGHT»).
 */
const refresh = vi.fn();
const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, replace, push: vi.fn() }),
}));
vi.mock("@/lib/toast", () => {
  const toast = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() });
  return { toast };
});
vi.mock("@/components/shared/confirm-dialog", () => ({
  useConfirm: () => [async () => true, null],
}));
const adminFetch = vi.fn();
vi.mock("@/features/admin/lib/mutate", () => ({
  adminFetch: (...a: unknown[]) => adminFetch(...a),
}));

import { useEventStudio } from "./use-event-studio";

const DAY = 86_400_000;
const NOW = Date.now();

function row(over: Partial<SaleEventAdminRow> = {}): SaleEventAdminRow {
  return {
    id: "6f1c2b9e-4b2a-4e0f-9a51-3c2d1e0f9a11",
    slug: "black-friday",
    name: "Black Friday",
    badgeLabel: null,
    headline: null,
    description: null,
    // УБ 11/28 00:00 – 12/01 00:00 (exclusive).
    startsAt: "2026-11-27T16:00:00.000Z",
    endsAt: "2026-11-30T16:00:00.000Z",
    isActive: false,
    showCountdown: true,
    tickerTheme: null,
    createdAt: "2026-11-13T00:00:00.000Z",
    updatedAt: "2026-11-13T00:00:00.000Z",
    items: [
      {
        productId: "7a2c3d4e-5f60-4a1b-8c9d-0e1f2a3b4c5d",
        pcts: { "10": 20 },
      },
    ],
    collections: [],
    ...over,
  };
}

function render(r: SaleEventAdminRow) {
  return renderHook(() =>
    useEventStudio({
      row: r,
      copyOf: null,
      bannerRow: null,
      copyBanner: null,
      bannerEnabled: false,
      bundlesEnabled: true,
      now: NOW,
    }),
  );
}

describe("useEventStudio — хадгалсны дараа router.refresh()", () => {
  beforeEach(() => {
    refresh.mockClear();
    replace.mockClear();
    adminFetch.mockReset();
    adminFetch.mockResolvedValue({ ok: true, data: { id: row().id } });
  });

  it("ноорог: автомат хадгалалт амжилттай → refresh", async () => {
    const { result } = render(row());
    act(() => result.current.patch({ headline: "Жилийн хамгийн том хямдрал" }));
    await act(async () => {
      await result.current.autosave();
    });
    expect(adminFetch).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("товлосон: гараар хадгалах амжилттай → refresh", async () => {
    const { result } = render(row({ isActive: true }));
    act(() => result.current.patch({ headline: "Шинэ гарчиг" }));
    await act(async () => {
      expect(await result.current.saveManual()).toBe(true);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("хадгалалт амжилтгүй бол refresh дуудагдахгүй", async () => {
    adminFetch.mockResolvedValue({ ok: false, error: "Алдаа", data: null });
    const { result } = render(row({ isActive: true }));
    act(() => result.current.patch({ headline: "Шинэ гарчиг" }));
    await act(async () => {
      expect(await result.current.saveManual()).toBe(false);
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("товлосныг зогсоох → refresh + студи локалаар ноорог болно (key солигдохгүй)", async () => {
    const { result } = render(row({ isActive: true }));
    expect(result.current.phase).toBe("scheduled");
    await act(async () => {
      await result.current.stop();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("draft");
  });

  it("явж буйг зогсоох → дууссан төлөв", async () => {
    const { result } = render(
      row({
        isActive: true,
        startsAt: new Date(NOW - DAY).toISOString(),
        endsAt: new Date(NOW + DAY).toISOString(),
      }),
    );
    expect(result.current.phase).toBe("live");
    await act(async () => {
      await result.current.stop();
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe("ended");
  });
});
