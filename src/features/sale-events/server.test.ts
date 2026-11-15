import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: vi.fn() }));
vi.mock("@/lib/auth/guard", () => ({ getStaffUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { saleEventWriteError } from "./server";

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
