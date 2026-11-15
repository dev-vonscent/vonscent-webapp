import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { EditableText, sanitizeInline } from "./editable-text";

function Harness({
  initial = "",
  max = 10,
  fallback,
  addLabel,
}: {
  initial?: string;
  max?: number;
  fallback?: string;
  addLabel?: string;
}) {
  const [value, setValue] = React.useState(initial);
  return (
    <>
      <EditableText
        value={value}
        onChange={setValue}
        label="Гарчиг"
        maxLength={max}
        fallback={fallback}
        addLabel={addLabel}
      />
      <output data-testid="value">{value}</output>
      <button type="button">гадна</button>
    </>
  );
}

const field = () => screen.getByRole("textbox", { name: "Гарчиг" });
const current = () => screen.getByTestId("value").textContent;

describe("sanitizeInline", () => {
  it("мөр таслалыг зай болгож, хязгаарт тайрна", () => {
    expect(sanitizeInline("нэг\nхоёр\r\nгурав", 50)).toBe("нэг хоёр гурав");
    expect(sanitizeInline("abcdef", 4)).toBe("abcd");
  });
});

describe("EditableText", () => {
  it("шошгоны нэртэй талбар; бичих бүрт утга шинэчлэгдэнэ", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(field(), "Сайн");
    expect(current()).toBe("Сайн");
  });

  it("maxLength-ээс хэтрэхгүй, тоологч харуулна", async () => {
    const user = userEvent.setup();
    render(<Harness max={5} />);
    await user.type(field(), "1234567");
    expect(current()).toBe("12345");
    expect(screen.getByText("5/5")).toBeInTheDocument();
  });

  it("Enter — мөр таслахгүй, засварыг дуусгана", async () => {
    const user = userEvent.setup();
    render(<Harness initial="abc" />);
    await user.click(field());
    await user.keyboard("d{Enter}");
    expect(current()).toBe("abcd");
    expect(field()).not.toHaveFocus();
  });

  it("Esc — засахын өмнөх утга руу буцаана", async () => {
    const user = userEvent.setup();
    render(<Harness initial="abc" />);
    await user.click(field());
    await user.keyboard("xyz{Escape}");
    expect(current()).toBe("abc");
    expect(field()).not.toHaveFocus();
  });

  it("Esc нь зөвхөн сүүлийн засварыг буцаана", async () => {
    const user = userEvent.setup();
    render(<Harness initial="a" />);
    await user.click(field());
    await user.keyboard("b");
    await user.click(screen.getByRole("button", { name: "гадна" }));
    await user.click(field());
    await user.keyboard("c{Escape}");
    expect(current()).toBe("ab");
  });

  it("paste — мөр таслал арилж, хязгаарт тайрагдана", async () => {
    const user = userEvent.setup();
    render(<Harness max={12} />);
    await user.click(field());
    await user.paste("нэг\nхоёр\nгурав дөрөв");
    expect(current()).toBe("нэг хоёр гур");
  });

  it("хоосон үед өгөгдмөл эсвэл «+ нэмэх» орлуулагч харагдана", () => {
    const { unmount } = render(<Harness fallback="Black Friday" />);
    expect(field()).toHaveAttribute("placeholder", "Black Friday");
    unmount();
    render(<Harness addLabel="+ Тайлбар нэмэх" />);
    expect(field()).toHaveAttribute("placeholder", "+ Тайлбар нэмэх");
  });

  it("disabled үед засагдахгүй, шошго / тоологч гарахгүй", () => {
    render(
      <EditableText
        value="abc"
        onChange={() => {}}
        label="Гарчиг"
        maxLength={10}
        disabled
      />,
    );
    expect(field()).toBeDisabled();
    expect(screen.queryByText("3/10")).not.toBeInTheDocument();
  });
});
