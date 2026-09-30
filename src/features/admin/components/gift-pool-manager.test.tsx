import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProductOption } from "@/features/admin/lib/product-option";

const adminFetch = vi.fn();
vi.mock("@/features/admin/lib/mutate", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

import { GiftPoolManager } from "./gift-pool-manager";

const opt = (id: string): ProductOption => ({
  id,
  name: `Ус ${id}`,
  brand: "Brand",
  isActive: true,
  availableMl: 100,
  priceByMl: {},
});

describe("GiftPoolManager", () => {
  it("устгагдсан бараа слот эзлэхгүй — 7 харагдах үед 8 дахийг нэмж болно", async () => {
    const options = ["a", "b", "c", "d", "e", "f", "g", "h"].map(opt);
    // «deleted» нь каталогт байхгүй (устгагдсан) ч санд id-гаараа үлдсэн.
    const initial = {
      enabled: true,
      productIds: ["a", "b", "c", "d", "e", "f", "g", "deleted"],
    };
    render(<GiftPoolManager options={options} initial={initial} />);

    expect(screen.getByText(/Устгагдсан 1 бараа сангаас хасагдлаа/)).toBeTruthy();
    const h = screen.getAllByRole("checkbox")[8]; // 0 = «систем идэвхтэй»
    expect(h.hasAttribute("disabled")).toBe(false);

    adminFetch.mockResolvedValue({ ok: true, data: {} });
    await userEvent.click(h);
    await userEvent.click(screen.getByRole("button", { name: "Хадгалах" }));
    const body = JSON.parse(adminFetch.mock.calls[0][1].body);
    expect(body.value.productIds).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
  });
});
