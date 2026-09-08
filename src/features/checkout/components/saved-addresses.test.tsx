import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NEW_ADDRESS, SavedAddresses } from "./saved-addresses";
import type { AddressRow } from "@/db/types";

function address(over: Partial<AddressRow> = {}): AddressRow {
  return {
    id: "a1",
    user_id: "u1",
    label: "Гэр",
    recipient: "Бат-Эрдэнэ",
    phone: "99112233",
    city: "Улаанбаатар",
    district: "Хан-Уул",
    detail: "3-р хороо, 12-р байр",
    is_default: false,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

const ROWS = [
  address({ id: "a1", is_default: true }),
  address({ id: "a2", recipient: "Сарнай", detail: "5-р байр" }),
];

describe("SavedAddresses", () => {
  it("marks the default address and shows each one in full", () => {
    render(<SavedAddresses addresses={ROWS} value="a1" onChange={() => {}} />);

    expect(screen.getByText("Үндсэн")).toBeTruthy();
    expect(screen.getByText("Бат-Эрдэнэ")).toBeTruthy();
    // City, district and detail on one line — the old dropdown truncated this.
    expect(
      screen.getByText("Улаанбаатар, Хан-Уул, 3-р хороо, 12-р байр"),
    ).toBeTruthy();
  });

  it("checks the address it is given", () => {
    render(<SavedAddresses addresses={ROWS} value="a2" onChange={() => {}} />);

    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.getAttribute("aria-checked"))).toEqual([
      "false",
      "true",
      "false", // "Шинэ хаяг нэмэх"
    ]);
  });

  it("reports a chosen address", async () => {
    const onChange = vi.fn();
    render(<SavedAddresses addresses={ROWS} value="a1" onChange={onChange} />);

    await userEvent.click(screen.getByText("Сарнай"));
    expect(onChange).toHaveBeenCalledWith("a2");
  });

  it("offers 'new address' as the last option, not a separate control", async () => {
    const onChange = vi.fn();
    render(<SavedAddresses addresses={ROWS} value="a1" onChange={onChange} />);

    await userEvent.click(screen.getByText("Шинэ хаяг нэмэх"));
    expect(onChange).toHaveBeenCalledWith(NEW_ADDRESS);
  });
});
