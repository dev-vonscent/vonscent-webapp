import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ getStaffUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { saleEventWriteError, toSaleEventRpc } from "./server";

describe("saleEventWriteError", () => {
  it("EVENT_ENDED → 409 + хуулах заавар (fixes F1)", async () => {
    const res = saleEventWriteError({ message: "EVENT_ENDED" });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string };
    expect(body.error).toMatch(/Дууссан арга хэмжээг засахгүй/);
    expect(body.error).toMatch(/хуулж/);
  });

  it("NOT_FOUND → 404", () => {
    expect(saleEventWriteError({ message: "NOT_FOUND" }).status).toBe(404);
  });
});

describe("BUNDLE_UNAVAILABLE (0191)", () => {
  it("400 + аль багц, яагаад", async () => {
    const res = saleEventWriteError({
      message: "BUNDLE_UNAVAILABLE",
      details: JSON.stringify([
        { collection: "LADIES NIGHT", reason: "sold_out" },
        { collection: "Shagai test", reason: "inactive" },
      ]),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe(
      "Дууссан эсвэл идэвхгүй багцыг шинээр нэмэх боломжгүй: «LADIES NIGHT» (дууссан), «Shagai test» (идэвхгүй).",
    );
  });
});

describe("toSaleEventRpc — merge түлхүүр (0191)", () => {
  const input = {
    name: "BF",
    slug: "bf",
    badgeLabel: "",
    headline: "",
    description: "",
    startsOn: "2026-11-28",
    endsOn: "2026-11-30",
    isActive: true,
    showCountdown: true,
    tickerTheme: null,
    items: [],
  };
  it("түлхүүргүй → p_data-д хасалт байхгүй (хуучин бүрэн солих)", () => {
    const { p_data } = toSaleEventRpc(input);
    expect("removedProductIds" in p_data).toBe(false);
    expect("removedCollectionIds" in p_data).toBe(false);
  });
  it("багцын хасалт зөвхөн collections-тэй хамт явна", () => {
    const { p_data } = toSaleEventRpc({
      ...input,
      removedProductIds: [],
      removedCollectionIds: ["c"],
    });
    expect(p_data).toMatchObject({ removedProductIds: [] });
    expect("removedCollectionIds" in p_data).toBe(false);
    const withBundles = toSaleEventRpc({
      ...input,
      collections: [],
      removedCollectionIds: ["c"],
    }).p_data;
    expect(withBundles).toMatchObject({ removedCollectionIds: ["c"] });
  });
});
