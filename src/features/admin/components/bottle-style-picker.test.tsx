import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { BottleStylePicker } from "./bottle-style-picker";
import type { BottleStyle } from "@/lib/constants";

/** Форм шиг сонголтыг өөрөө эзэмшинэ. */
function Harness() {
  const [value, setValue] = React.useState<BottleStyle | null>(null);
  return (
    <>
      <BottleStylePicker value={value} onChange={setValue} />
      <output data-testid="value">{value ?? "none"}</output>
    </>
  );
}

const LABELS = ["Нэмэхгүй", "Хар сав", "Ягаан сав", "Мөнгөлөг сав"];

/** Сонгогдсон сонголтуудын нэр (accessible name-ээр). */
function checked() {
  return LABELS.filter(
    (name) =>
      screen.getByRole("radio", { name }).getAttribute("aria-checked") ===
      "true",
  );
}

describe("BottleStylePicker", () => {
  it("«Нэмэхгүй» + 3 савыг харуулж, анхдагчаар юу ч нэмэхгүй", () => {
    render(<Harness />);
    expect(screen.getAllByRole("radio")).toHaveLength(LABELS.length);
    expect(checked()).toEqual(["Нэмэхгүй"]);
  });

  it("сав сонгоход зөвхөн тэр нь сонгогдоно", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "Ягаан сав" }));
    expect(checked()).toEqual(["Ягаан сав"]);
    expect(screen.getByTestId("value")).toHaveTextContent("pink");
  });

  it("«Нэмэхгүй» дарж сонголтоо буцаана", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "Хар сав" }));
    await user.click(screen.getByRole("radio", { name: "Нэмэхгүй" }));
    expect(screen.getByTestId("value")).toHaveTextContent("none");
  });

  it("сав бүр урьдчилан харах зурагтай", () => {
    render(<Harness />);
    const srcs = Array.from(document.querySelectorAll("img")).map((i) =>
      decodeURIComponent(i.getAttribute("src") ?? ""),
    );
    expect(srcs).toHaveLength(3);
    expect(srcs.join(" ")).toContain("/bottles/black-bottle.png");
  });
});
