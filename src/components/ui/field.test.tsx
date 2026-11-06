import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Field } from "./field";
import { Input } from "./input";

describe("Field", () => {
  it("turns the label red and marks the control invalid on error", () => {
    render(
      <Field
        label="Унаа явах газар"
        error="Ачаа очих унаа, буудлын нэрийг бичнэ үү."
      >
        <Input />
      </Field>,
    );
    expect(screen.getByText("Унаа явах газар").className).toContain(
      "text-destructive",
    );
    const input = screen.getByLabelText("Унаа явах газар");
    // `field-edge` + aria-invalid → улаан хүрээ (globals.css).
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.className).toContain("field-edge");
  });

  it("leaves both alone without an error", () => {
    render(
      <Field label="Нэр">
        <Input />
      </Field>,
    );
    expect(screen.getByText("Нэр").className).not.toContain("text-destructive");
    expect(screen.getByLabelText("Нэр").hasAttribute("aria-invalid")).toBe(
      false,
    );
  });
});
