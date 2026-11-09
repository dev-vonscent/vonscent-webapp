// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { trackAddToCart, trackPurchase } from "./analytics";

describe("pixel events", () => {
  const fbq = vi.fn();
  beforeEach(() => {
    fbq.mockReset();
    window.fbq = fbq;
    window.gtag = undefined;
  });

  it("Purchase carries eventID = order no so the CAPI event deduplicates", () => {
    trackPurchase(
      "VS-1042",
      [
        { id: "p-1", name: "A 5ml", price: 18000, quantity: 2 },
        { id: "p-1", name: "A 10ml", price: 30000 },
      ],
      66000,
    );
    expect(fbq).toHaveBeenCalledWith(
      "track",
      "Purchase",
      {
        content_ids: ["p-1"],
        content_type: "product",
        num_items: 3,
        value: 66000,
        currency: "MNT",
      },
      { eventID: "VS-1042" },
    );
  });

  it("browser-only events pass no options object", () => {
    trackAddToCart({ id: "p-1", name: "A 5ml", price: 18000 });
    expect(fbq.mock.calls[0]).toHaveLength(3);
  });

  it("is a no-op without the pixel script", () => {
    window.fbq = undefined;
    expect(() => trackPurchase("VS-1", [], 0)).not.toThrow();
  });
});
