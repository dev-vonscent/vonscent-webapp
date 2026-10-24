import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { USER_TIERS } from "@/lib/constants";
import { TierBadge, TierGem } from "./tier-frame";

describe("TierGem", () => {
  it("Standard/Gold/Platinum — хүрээний доод медальоны зураг", () => {
    for (const tier of ["standard", "gold", "platinum"] as const) {
      const { container, unmount } = render(<TierGem tier={tier} />);
      const img = container.querySelector("img");
      expect(img?.getAttribute("src")).toContain(`badge-${tier}`);
      expect(container.querySelector("svg")).toBeNull();
      unmount();
    }
  });

  it("Sapphire/Ruby — дээрээс харсан brilliant талст (SVG)", () => {
    for (const tier of ["sapphire", "ruby"] as const) {
      const { container, unmount } = render(<TierGem tier={tier} />);
      expect(container.querySelector("img")).toBeNull();
      // 8 өнцөгт гадаргуу + 32 талст.
      expect(container.querySelectorAll("polygon")).toHaveLength(33);
      unmount();
    }
  });

  it("badge бүр нэр, тэмдэгтэй", () => {
    for (const t of USER_TIERS) {
      const { getByText, container, unmount } = render(
        <TierBadge tier={t.key} />,
      );
      expect(getByText(t.label)).toBeInTheDocument();
      expect(container.querySelector("img, svg")).not.toBeNull();
      unmount();
    }
  });
});
