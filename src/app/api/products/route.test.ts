import { beforeEach, describe, expect, it, vi } from "vitest";

const getProductDetailsByIds = vi.fn();
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));
vi.mock("@/features/products/api", () => ({
  getProductDetailsByIds,
  getProductsByIds: vi.fn(),
  getCatalog: vi.fn(),
  getProductBySlug: vi.fn(),
}));

const { GET } = await import("./route");

beforeEach(() => {
  getProductDetailsByIds.mockReset();
});

describe("GET /api/products?details=1", () => {
  it("сагсны асуулга strict — хэсэгчилсэн алдаа 503 болно", async () => {
    getProductDetailsByIds.mockRejectedValue(new Error("chunk failed"));
    const res = await GET(
      new Request("http://x/api/products?ids=a,b&details=1"),
    );
    expect(res.status).toBe(503);
    expect(getProductDetailsByIds).toHaveBeenCalledWith(["a", "b"], {
      includeComingSoon: false,
      strict: true,
    });
  });

  it("хүслийн жагсаалт (upcoming) strict биш", async () => {
    getProductDetailsByIds.mockResolvedValue([]);
    const res = await GET(
      new Request("http://x/api/products?ids=a&details=1&upcoming=1"),
    );
    expect(res.status).toBe(200);
    expect(getProductDetailsByIds).toHaveBeenCalledWith(["a"], {
      includeComingSoon: true,
      strict: false,
    });
  });
});
