import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CustomersTable, type CustomerListRow } from "./customers-table";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const row = (over: Partial<CustomerListRow>): CustomerListRow => ({
  id: "1",
  full_name: "Сараа",
  phone: "99112233",
  role: "customer",
  loyalty_points: 0,
  is_blocked: false,
  ...over,
});

describe("CustomersTable — түвшний badge", () => {
  it("нэрийн ард түвшин; туг хаалттай (null) бол badge-гүй", () => {
    render(
      <CustomersTable
        data={[
          row({ id: "1", full_name: "Сараа", tier: "gold" }),
          row({ id: "2", full_name: "Болд", tier: null }),
        ]}
      />,
    );
    expect(screen.getAllByText("Gold").length).toBeGreaterThan(0);
    expect(screen.queryByText("Standard")).toBeNull();
    expect(screen.getAllByText("Болд").length).toBeGreaterThan(0);
  });
});
