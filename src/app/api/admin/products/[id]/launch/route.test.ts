import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * «Худалдаанд гаргах» (0125 `launch_product`): давхар дарвал амжилт, кэш
 * зөвхөн бодит гаргалтад цэвэрлэгдэнэ; төлөв нь өөрчлөгдсөн бол 409.
 */

const ID = "7d3c1a52-9e0b-4f7e-8a51-2c6f0b9d4e11";
const callRpc = vi.fn();
const revalidatePublic = vi.fn();

vi.mock("@/lib/env", () => ({ isSupabaseConfigured: true }));
vi.mock("@/lib/cache", () => ({ revalidatePublic }));
vi.mock("@/lib/auth/guard", () => ({
  getStaffUser: async () => ({ id: "staff", role: "operator" }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/supabase/rpc", () => ({ callRpc }));

const { POST } = await import("./route");

function launch(id = ID) {
  return POST(new Request(`http://test/api/admin/products/${id}/launch`), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  callRpc.mockReset();
  revalidatePublic.mockReset();
});

describe("POST /api/admin/products/[id]/launch", () => {
  it("давхар дарвал хоёр дахь нь already_active — алдаа биш", async () => {
    // RPC нь нөхцөлтэй UPDATE: эхнийх нь гаргана, дараагийнх нь аль хэдийн
    // идэвхтэйг олно.
    callRpc
      .mockResolvedValueOnce({ data: "launched", error: null })
      .mockResolvedValueOnce({ data: "already_active", error: null });

    const first = await launch();
    const second = await launch();

    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ ok: true, result: "launched" });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({
      ok: true,
      result: "already_active",
    });
    // Кэш зөвхөн бодит гаргалтад.
    expect(revalidatePublic).toHaveBeenCalledTimes(1);
    expect(callRpc).toHaveBeenCalledWith(expect.anything(), "launch_product", {
      p_id: ID,
    });
  });

  it("«Тун удахгүй» байхаа больсон бол 409", async () => {
    callRpc.mockResolvedValueOnce({ data: "not_coming_soon", error: null });
    const res = await launch();
    expect(res.status).toBe(409);
    expect(revalidatePublic).not.toHaveBeenCalled();
  });

  it("олдоогүй бол 404", async () => {
    callRpc.mockResolvedValueOnce({ data: "not_found", error: null });
    expect((await launch()).status).toBe(404);
  });

  it("UUID биш id нь 400, RPC дуудагдахгүй", async () => {
    const res = await launch("not-a-uuid");
    expect(res.status).toBe(400);
    expect(callRpc).not.toHaveBeenCalled();
  });
});
