import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeatureFlagsProvider } from "@/components/feature-flags";
import type { FeatureFlag } from "@/lib/constants";
import { CollectionSaleBadge } from "./collection-sale-badge";
import { SaleEventsProvider } from "./sale-events-provider";

const events = [
  {
    slug: "black-friday",
    name: "Black Friday",
    badgeLabel: "Black Friday",
    tickerTheme: "navy" as const,
  },
];

const bundle = {
  discountRange: { min: 10, max: 10 },
  event: { slug: "black-friday", name: "Black Friday", pcts: { 5: 10 } },
};

function renderBadge(
  flags: FeatureFlag[],
  surface: "card" | "detail" = "detail",
) {
  return render(
    <FeatureFlagsProvider enabled={flags}>
      <SaleEventsProvider
        events={events}
        badges={{}}
        pcts={{}}
        themes={{}}
        bundleEventSlugs={["black-friday"]}
      >
        <CollectionSaleBadge collection={bundle} surface={surface} />
      </SaleEventsProvider>
    </FeatureFlagsProvider>,
  );
}

describe("CollectionSaleBadge — багцын дэлгэрэнгүй", () => {
  it("арга хэмжээнд орсон бол «Black Friday −10%»", () => {
    const { container } = renderBadge(["sale_events", "sale_event_bundles"]);
    expect(container.textContent).toContain("Black Friday");
    expect(container.textContent).toContain("−10%");
  });

  it("туг sale_event_bundles хаалттай → өмнөх «−10%» тэмдэг хэвээр", () => {
    const { container } = renderBadge(["sale_events"]);
    expect(container.textContent).not.toContain("Black Friday");
    const badge = screen.getByText("−10%", { exact: false });
    // Дэлгэрэнгүйн хуучин төрх — картын цагаан дэвсгэргүй.
    expect(badge.className).not.toContain("bg-background/85");
  });
});

describe("CollectionSaleBadge — каталогийн карт (нарийн/өргөн)", () => {
  it("нарийн үед зөвхөн «−10%», өргөн үед нэр; aria-label бүтэн", () => {
    const { container } = renderBadge(
      ["sale_events", "sale_event_bundles"],
      "card",
    );
    const name = container.querySelector<HTMLElement>("[data-chip-name]")!;
    expect(name.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(name.className).toMatch(/@min-\[\d+px\]\/chip:inline/);
    expect(
      screen.getByRole("img", { name: "Black Friday, 10% хямдралтай" }),
    ).toBeTruthy();
  });

  it("дэлгэрэнгүйн зураг дээр нэр үргэлж харагдана", () => {
    const { container } = renderBadge(["sale_events", "sale_event_bundles"]);
    expect(container.querySelector("[data-chip-name]")).toBeNull();
  });
});
