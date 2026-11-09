import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Азын хүрдний админ хадгалалт (0170): шагналын жагсаалт бүтнээрээ,
 * дарааллаараа `admin_save_spin_prizes`-д нэг дуудлагаар очно. Төрөл бүр
 * өөрийн талбартай — бараагүй «Бодит бараа», 0 оноо, 100-аас их хувь 400.
 */

let staff: { id: string } | null = { id: "admin-1" };
const rpc = vi.fn();

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/auth/guard", () => ({ getStaffUser: async () => staff }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/supabase/rpc", () => ({
  callRpc: (...args: unknown[]) => rpc(...args),
}));

const { PUT } = await import("./route");

const PRODUCT = "33333333-3333-4333-8333-333333333333";

const none = {
  id: null,
  kind: "none",
  tier: "common",
  label: "Хоосон",
  shortLabel: "",
  value: 0,
  minSubtotal: 0,
  maxDiscount: null,
  weight: 81,
  monthlyCap: null,
  productId: null,
  ml: null,
};
const product = {
  ...none,
  kind: "product",
  tier: "rare",
  label: "Eau Fraiche 5мл",
  shortLabel: "5мл",
  value: 1,
  weight: 19,
  productId: PRODUCT,
  ml: 5,
};

function put(prizes: unknown[]) {
  return PUT(
    new Request("http://x/api/admin/lucky-wheel", {
      method: "PUT",
      body: JSON.stringify({ prizes }),
    }),
  );
}

beforeEach(() => {
  staff = { id: "admin-1" };
  rpc.mockReset().mockResolvedValue({ data: null, error: null });
});

describe("PUT /api/admin/lucky-wheel — шагналууд", () => {
  it("жагсаалтыг дарааллаар нь нэг RPC-д өгнө", async () => {
    const res = await put([product, none]);
    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      expect.anything(),
      "admin_save_spin_prizes",
      {
        p_prizes: [
          expect.objectContaining({ kind: "product", productId: PRODUCT }),
          expect.objectContaining({ kind: "none" }),
        ],
      },
    );
  });

  it("төрлийн шаардлага дутуу бол 400, санд юу ч бичихгүй", async () => {
    for (const bad of [
      { ...product, productId: null },
      { ...product, ml: 7 },
      { ...none, kind: "points", value: 0 },
      { ...none, kind: "coupon_percent", value: 150 },
      { ...none, weight: 101 },
    ]) {
      expect((await put([bad, none])).status).toBe(400);
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("ажилтан биш бол 403", async () => {
    staff = null;
    expect((await put([product, none])).status).toBe(403);
    expect(rpc).not.toHaveBeenCalled();
  });
});
