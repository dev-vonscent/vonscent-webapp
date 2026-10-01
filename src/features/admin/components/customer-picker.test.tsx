import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CustomerOption } from "@/features/admin/lib/customer-option";

const adminFetch = vi.fn();
vi.mock("@/features/admin/lib/mutate", () => ({
  adminFetch: (...args: unknown[]) => adminFetch(...args),
}));

import { CustomerPicker } from "./customer-picker";

const bat: CustomerOption = { id: "u1", full_name: "Бат", phone: "99112233" };
const dorj: CustomerOption = { id: "u2", full_name: "Дорж", phone: "88001122" };

function Harness({ onChange }: { onChange: (c: CustomerOption | null) => void }) {
  const [value, setValue] = React.useState<CustomerOption | null>(null);
  return (
    <CustomerPicker
      initial={[bat]}
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe("CustomerPicker", () => {
  it("утсаар серверээс хайж олоод сонгоно; нийтийн сонголт руу буцаж болно", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    adminFetch.mockResolvedValue({ ok: true, data: { items: [dorj] } });
    render(<Harness onChange={onChange} />);

    // Анхдагч нь нийтийн купон.
    const trigger = screen.getByRole("combobox");
    expect(trigger.textContent).toContain("Бүх хэрэглэгч (нийтийн)");

    await user.click(trigger);
    // Нээхэд серверийн эхний хуудас + нийтийн сонголт — хүсэлтгүйгээр.
    expect(await screen.findByRole("option", { name: /Бат/ })).toBeTruthy();
    expect(adminFetch).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Хэрэглэгч хайх"), "8800");
    // Base UI дахин шүүдэггүй: «8800» нэрэнд байхгүй ч Дорж харагдана.
    const option = await screen.findByRole("option", { name: /Дорж/ });
    expect(adminFetch).toHaveBeenCalledWith(
      "/api/admin/customers/options?q=8800",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    await user.click(option);
    expect(onChange).toHaveBeenLastCalledWith(dorj);
    await waitFor(() => expect(trigger.textContent).toContain("Дорж"));

    await user.click(trigger);
    await user.click(
      await screen.findByRole("option", { name: /Бүх хэрэглэгч/ }),
    );
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
