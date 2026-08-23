import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "./rich-text";

describe("RichText", () => {
  it("renders TipTap HTML with dangerous markup stripped", () => {
    const { container } = render(
      <RichText content={'<p>Сайн уу <script>alert("x")</script><b>найз</b></p>'} />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(/найз/)).toBeInTheDocument();
  });

  it("renders legacy plain text as blank-line paragraphs", () => {
    const { container } = render(
      <RichText content={"Эхний догол мөр.\n\nХоёр дахь догол мөр."} />,
    );
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[1]).toHaveTextContent("Хоёр дахь догол мөр.");
  });
});
