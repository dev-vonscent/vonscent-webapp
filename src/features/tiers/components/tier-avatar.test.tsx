import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TierAvatar } from "./tier-avatar";

describe("TierAvatar", () => {
  it("түвшинтэй бол тухайн түвшний хүрээ", () => {
    const { container } = render(
      <TierAvatar tier="sapphire" src={null} name="Сараа" size={36} />,
    );
    const frame = container.querySelector("[data-tier]");
    expect(frame).toHaveAttribute("data-tier", "sapphire");
    expect(frame?.querySelector("img")?.getAttribute("src")).toContain(
      "sapphire",
    );
    expect(screen.getByText("С")).toBeInTheDocument();
  });

  it("түвшингүй (зочин, туг хаалттай) бол энгийн дугуй", () => {
    const { container } = render(
      <TierAvatar tier={null} src={null} name="болд" size={40} />,
    );
    expect(container.querySelector("[data-tier]")).toBeNull();
    expect(screen.getByText("б")).toBeInTheDocument();
  });
});
