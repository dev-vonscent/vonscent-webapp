import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ProductStatus } from "@/lib/constants";
import { ProductStatusPicker } from "./product-status-picker";

function Harness({
  initial,
  launchedAt = null,
  launch,
}: {
  initial: ProductStatus;
  launchedAt?: string | null;
  launch?: { onLaunch: () => void; launching: boolean };
}) {
  const [value, setValue] = React.useState<ProductStatus>(initial);
  const [note, setNote] = React.useState("");
  return (
    <>
      <ProductStatusPicker
        value={value}
        onChange={setValue}
        launchedAt={launchedAt}
        note={note}
        onNoteChange={setNote}
        launch={launch}
      />
      <output data-testid="value">{value}</output>
    </>
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

  it("хаалттай сонголтыг дэлгэц уншигч ч ялгана", () => {
    render(<Harness initial="active" launchedAt="2026-09-01T00:00:00Z" />);
    expect(radio(/Тун удахгүй/).textContent).toMatch(/хаалттай/);
    expect(radio(/Идэвхтэй/).textContent).not.toMatch(/хаалттай/);
    expect(radio(/Нуусан/).textContent).not.toMatch(/хаалттай/);
  });
});

describe("ProductStatusPicker — сан дээр «Тун удахгүй» бараа", () => {
  it("launch өгвөл «Идэвхтэй» хаагдаж, дарахад төлөв солигдохгүй", async () => {
    render(
      <Harness
        initial="coming_soon"
        launch={{ onLaunch: () => {}, launching: false }}
      />,
    );
    expect(radio(/Идэвхтэй/).hasAttribute("disabled")).toBe(true);
    await userEvent.click(radio(/Идэвхтэй/));
    expect(screen.getByTestId("value").textContent).toBe("coming_soon");
    // Нуух нь хэвээр боломжтой.
    expect(radio(/Нуусан/).hasAttribute("disabled")).toBe(false);
  });

  it("«Худалдаанд гаргах» товч launch-ийг дуудна", async () => {
    const onLaunch = vi.fn();
    render(
      <Harness initial="coming_soon" launch={{ onLaunch, launching: false }} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Худалдаанд гаргах/ }),
    );
    expect(onLaunch).toHaveBeenCalledOnce();
  });

  it("launch өгөөгүй бол «Идэвхтэй» нээлттэй, товч гарахгүй", async () => {
    render(<Harness initial="hidden" />);
    expect(
      screen.queryByRole("button", { name: /Худалдаанд гаргах/ }),
    ).toBeNull();
    await userEvent.click(radio(/Идэвхтэй/));
    expect(screen.getByTestId("value").textContent).toBe("active");
  });
});
