import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CouponRow } from "@/db/types";

const adminFetch = vi.fn();
vi.mock("@/features/admin/lib/mutate", () => ({
  adminFetch: (...a: unknown[]) => adminFetch(...a),
}));

import { CouponRedemptionsSheet } from "./coupon-redemptions-sheet";

const coupon = { id: "c1", code: "SALE10", user_id: null } as CouponRow;

describe("CouponRedemptionsSheet", () => {
  it("нийт ашиглалт, хүн, хөнгөлөлт ба мөр бүрийн дүнг харуулна", async () => {
    adminFetch.mockResolvedValue({
      ok: true,
      data: {
        redemptions: [
          {
            id: "r1",
            at: "2026-10-09T06:00:00Z",
            cancelledAt: null,
            userId: "a",
            name: "Бат",
            phone: "99112233",
            orderId: "o1",
            orderNo: "VS-1",
            discount: 8000,
          },
          {
            id: "r2",
            at: "2026-10-08T06:00:00Z",
            cancelledAt: null,
            userId: "a",
            name: "Бат",
            phone: "99112233",
            orderId: "o2",
            orderNo: "VS-2",
            discount: 5000,
          },
          {
            id: "r3",
            at: "2026-10-07T06:00:00Z",
            cancelledAt: "2026-10-07T07:00:00Z",
            userId: "b",
            name: "Дорж",
            phone: null,
            orderId: "o3",
            orderNo: "VS-3",
            discount: 9000,
          },
        ],
      },
    });
    render(
      <CouponRedemptionsSheet
        coupon={coupon}
        ownerName={null}
        onOpenChange={() => {}}
      />,
    );
    expect(await screen.findByText("2 удаа")).toBeTruthy();
    expect(screen.getByText("1 хүн")).toBeTruthy();
    expect(screen.getByText("13,000₮")).toBeTruthy();
    expect(screen.getByText("−8,000₮")).toBeTruthy();
    // Цуцлагдсан мөрийн дүн харагдах ч зураастай.
    expect(screen.getByText("−9,000₮").className).toContain("line-through");
  });
});
