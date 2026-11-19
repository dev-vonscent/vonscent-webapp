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

const ev = (pcts: Record<number, number>) => ({
  slug: "black-friday",
  name: "Black Friday",
  pcts,
});
const sizes = [2, 5, 10, 20].map((ml) => ({ ml, available: true }));

/** Суурь 5%, event бүх хэмжээнд 10% — server-ийн `discountRange` 10%. */
const bundle = {
  discountRange: { min: 10, max: 10 },
  discountPct: 5,
  mlDiscounts: {},
  prices: sizes,
  event: ev({ 2: 10, 5: 10, 10: 10, 20: 10 }),
};

function renderBadge(
  flags: FeatureFlag[],
  surface: "card" | "detail" = "detail",
  collection: typeof bundle = bundle,
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
        <CollectionSaleBadge collection={collection} surface={surface} />
      </SaleEventsProvider>
    </FeatureFlagsProvider>,
  );
}

describe("CollectionSaleBadge — багцын дэлгэрэнгүй", () => {
  it("арга хэмжээнд орсон бол «Black Friday 10%» (барааны 2.4 формат)", () => {
    const { container } = renderBadge(["sale_events", "sale_event_bundles"]);
    expect(container.textContent).toBe("Black Friday10%");
  });

  it("туг sale_event_bundles хаалттай → юу ч үгүй (суурь хувь үнийн мөрөнд)", () => {
    const { container } = renderBadge(["sale_events"]);
    expect(container.textContent).toBe("");
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

  const ON: FeatureFlag[] = ["sale_events", "sale_event_bundles"];
  const pctOf = (c: HTMLElement) =>
    c.querySelector("[data-chip-pct]")?.textContent ?? null;

  it("(1) event бүх хэмжээнд 10% → «10%»", () => {
    const { container } = renderBadge(ON, "card");
    expect(pctOf(container)).toBe("10%");
  });

  it("(2) event 2/5ml-д 10%, 10/20ml суурь 5% → «~10%», aria бүтэн", () => {
    const { container } = renderBadge(ON, "card", {
      ...bundle,
      discountRange: { min: 5, max: 10 },
      event: ev({ 2: 10, 5: 10 }),
    });
    expect(pctOf(container)).toBe("~10%");
    expect(
      screen.getByRole("img", {
        name: "Black Friday, 10% хүртэл хямдралтай",
      }),
    ).toBeTruthy();
  });

  it("(3) event хэмжээ бүрт 10%/15% → «10–15%» (барааны 2.4 дүрэм)", () => {
    const { container } = renderBadge(ON, "card", {
      ...bundle,
      discountRange: { min: 10, max: 15 },
      event: ev({ 2: 10, 5: 10, 10: 15, 20: 15 }),
    });
    expect(pctOf(container)).toBe("10–15%");
  });

  it("(4) event-гүй → өмнөх «−5%»", () => {
    const { container } = renderBadge(ON, "card", {
      ...bundle,
      discountRange: { min: 5, max: 5 },
      event: null as never,
    });
    expect(container.querySelector("[data-sale-chip]")).toBeNull();
    expect(container.textContent).toBe("−5%");
  });

  it("(5) event хувь ≤ суурь → event chip үгүй, суурь «−15%»", () => {
    const { container } = renderBadge(ON, "card", {
      ...bundle,
      discountPct: 15,
      discountRange: { min: 15, max: 15 },
      event: ev({ 2: 10, 5: 15, 10: 10, 20: 10 }),
    });
    expect(container.querySelector("[data-sale-chip]")).toBeNull();
    expect(container.textContent).toBe("−15%");
  });

  it("дэлгэрэнгүйн зураг дээр нэр үргэлж харагдана", () => {
    const { container } = renderBadge(["sale_events", "sale_event_bundles"]);
    expect(container.querySelector("[data-chip-name]")).toBeNull();
  });
});
