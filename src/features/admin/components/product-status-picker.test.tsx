import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { ProductStatus } from "@/lib/constants";
import { ProductStatusPicker } from "./product-status-picker";

function Harness({
  initial,
  launchedAt = null,
}: {
  initial: ProductStatus;
  launchedAt?: string | null;
}) {
  const [value, setValue] = React.useState<ProductStatus>(initial);
  const [note, setNote] = React.useState("");
  return (
    <ProductStatusPicker
      value={value}
      onChange={setValue}
      launchedAt={launchedAt}
      note={note}
      onNoteChange={setNote}
    />
  );
}

const radio = (name: RegExp) => screen.getByRole("radio", { name });

describe("ProductStatusPicker", () => {
  it("гурван төлөв, сонгосон нь тэмдэглэгдсэн", () => {
    render(<Harness initial="active" />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(radio(/Идэвхтэй/).getAttribute("aria-checked")).toBe("true");
  });

  it("«Тун удахгүй» сонгоход ойролцоо хугацааны талбар гарна", async () => {
    render(<Harness initial="hidden" />);
    expect(screen.queryByLabelText(/Хэзээ ирэх вэ/)).toBeNull();
    await userEvent.click(radio(/Тун удахгүй/));
    expect(radio(/Тун удахгүй/).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByLabelText(/Хэзээ ирэх вэ/)).toBeTruthy();
  });

  it("худалдаанд гарсан бараанд «Тун удахгүй» хаалттай, шалтгааныг хэлнэ", async () => {
    render(<Harness initial="hidden" launchedAt="2026-09-01T00:00:00Z" />);
    const cs = radio(/Тун удахгүй/);
    expect(cs.hasAttribute("disabled")).toBe(true);
    await userEvent.click(cs);
    expect(cs.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText(/Худалдаанд гарсан бараа/)).toBeTruthy();
  });
});
