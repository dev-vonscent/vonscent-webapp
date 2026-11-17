import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ getStaffUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));

import { isFeatureEnabled } from "@/lib/feature-flags";
import { getStaffUser } from "@/lib/auth/guard";
import { namedSaleGate, namedSaleWriteError, toSaveSaleRpc } from "./server";

const flags = vi.mocked(isFeatureEnabled);

beforeEach(() => {
  flags.mockReset();
  vi.mocked(getStaffUser).mockReset();
});

describe("namedSaleGate", () => {
  it("named_sales хаалттай → 404 (staff шалгахаас өмнө)", async () => {
    flags.mockImplementation(async (k) => k === "sale_page");
    const g = await namedSaleGate();
    expect("response" in g && g.response?.status).toBe(404);
    expect(getStaffUser).not.toHaveBeenCalled();
  });

  it("sale_page хаалттай → 404", async () => {
    flags.mockImplementation(async (k) => k === "named_sales");
    const g = await namedSaleGate();
    expect("response" in g && g.response?.status).toBe(404);
  });

  it("staff биш → 403", async () => {
    flags.mockResolvedValue(true);
    vi.mocked(getStaffUser).mockResolvedValue(null);
    const g = await namedSaleGate();
    expect("response" in g && g.response?.status).toBe(403);
  });
});

describe("namedSaleWriteError", () => {
  it("SALE_CONFLICT → 409 + бараа, хямдралын нэр (16.3)", async () => {
    const res = namedSaleWriteError({
      message: "SALE_CONFLICT",
      details: JSON.stringify([{ productId: "p1", sale: "Март 8" }]),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { conflicts: unknown[] };
    expect(body.conflicts).toEqual([{ productId: "p1", sale: "Март 8" }]);
  });

  it("PRODUCT_WITHOUT_DISCOUNT → 400 + бараа (16.5)", async () => {
    const res = namedSaleWriteError({
      message: "PRODUCT_WITHOUT_DISCOUNT",
      details: '["p2"]',
    });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { productIds: string[] }).productIds).toEqual([
      "p2",
    ]);
  });

  it("FEATURE_DISABLED → 404, үл мэдэгдэх → 500", () => {
    expect(namedSaleWriteError({ message: "FEATURE_DISABLED" }).status).toBe(404);
    expect(namedSaleWriteError({ message: "boom" }).status).toBe(500);
  });
});

describe("toSaveSaleRpc", () => {
  it("УБ өдрийн хил (эхлэх 00:00, дуусах дараагийн 00:00)", () => {
    const rpc = toSaveSaleRpc(
      null,
      {
        name: "Март 8",
        pcts: { "5": 10 },
        startsOn: "",
        endsOn: "2026-03-08",
        productIds: ["00000000-0000-4000-8000-000000000001"],
        adoptUnnamed: false,
      },
      "u1",
    );
    expect(rpc.p_starts).toBeNull();
    expect(rpc.p_ends).toBe("2026-03-08T16:00:00.000Z");
    expect(rpc.p_actor).toBe("u1");
  });
});
