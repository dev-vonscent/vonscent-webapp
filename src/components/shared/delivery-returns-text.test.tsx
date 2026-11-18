import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DeliveryReturnsText,
  DeliveryText,
  ReturnsText,
} from "./delivery-returns-text";

describe("«Хүргэлт» / «Буцаалт» (task 5)", () => {
  it("хүргэлтэд зөвхөн хуваарь, орон нутаг — буцаалтын нөхцөлгүй", () => {
    const t = render(<DeliveryText />).container.textContent ?? "";
    expect(t).toContain("00:00 цаг хүртэлх захиалга");
    expect(t).toContain("Орон нутагт");
    expect(t).not.toContain("буцаалт");
  });

  it("буцаалтад зөвхөн decant-ийн нөхцөл", () => {
    const t = render(<ReturnsText />).container.textContent ?? "";
    expect(t).toMatch(/^Decant бараа/);
    expect(t).toContain("буцаалт хийх боломжгүйг");
    expect(t).not.toContain("хүргэгдэнэ");
  });

  it("нийлмэл хувилбар (нэмэлт бараа) хоёр хэсгийг дутуугүй агуулна", () => {
    const all = render(<DeliveryReturnsText />).container.textContent ?? "";
    const d = render(<DeliveryText />).container.textContent ?? "";
    const r = render(<ReturnsText />).container.textContent ?? "";
    expect(all).toBe(`${d} ${r}`);
  });
});
