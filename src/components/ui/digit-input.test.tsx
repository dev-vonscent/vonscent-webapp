import * as React from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DigitInput, type DigitInputProps } from "./digit-input";

function Harness(props: Partial<DigitInputProps>) {
  const [value, setValue] = React.useState("");
  return (
    <>
      <DigitInput
        length={8}
        label="Утасны дугаар"
        {...props}
        value={value}
        onChange={setValue}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

const fill = (text: string) =>
  fireEvent.change(screen.getByLabelText("Утасны дугаар"), {
    target: { value: text },
  });

describe("DigitInput autoComplete", () => {
  it("defaults to off", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Утасны дугаар")).toHaveAttribute(
      "autocomplete",
      "off",
    );
  });

  it("drops the country code from a tel autofill", () => {
    render(<Harness autoComplete="tel-national" />);
    expect(screen.getByLabelText("Утасны дугаар")).toHaveAttribute(
      "autocomplete",
      "tel-national",
    );
    fill("+976 9911 2233");
    expect(screen.getByTestId("value")).toHaveTextContent("99112233");
  });

  it("keeps a plain national number as is", () => {
    render(<Harness autoComplete="tel-national" />);
    fill("9911 2233");
    expect(screen.getByTestId("value")).toHaveTextContent("99112233");
  });

  it("ignores one extra keystroke once full", () => {
    render(<Harness autoComplete="tel-national" />);
    fill("991122334");
    expect(screen.getByTestId("value")).toHaveTextContent("99112233");
  });

  it("keeps the leading digits for a passcode paste", () => {
    render(<Harness />);
    fill("+976 9911 2233");
    expect(screen.getByTestId("value")).toHaveTextContent("97699112");
  });
});
