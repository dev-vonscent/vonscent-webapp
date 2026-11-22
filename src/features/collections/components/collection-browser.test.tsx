import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FeatureFlagsProvider } from "@/components/feature-flags";
import { SaleEventsProvider } from "@/features/sale-events/components/sale-events-provider";
import type { FeatureFlag } from "@/lib/constants";
import type { Collection } from "../types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/collections",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("./collection-grid", () => ({
  CollectionGrid: ({ collections }: { collections: Collection[] }) => (
    <ul>
      {collections.map((c) => (
        <li key={c.id}>{c.name}</li>
      ))}
    </ul>
  ),
}));

import { CollectionBrowser } from "./collection-browser";

const bf = { slug: "black-friday", name: "Black Friday", pcts: { 5: 10 } };
const col = (id: string, event: typeof bf | null) =>
  ({
    id,
    name: id.toUpperCase(),
    description: "",
    gender: "male",
    isFeatured: false,
    startingPrice: 100_000,
    discountRange: { min: 5, max: event ? 10 : 5 },
    event,
  }) as unknown as Collection;
const list = [col("luxury", bf), col("lv", null), col("office", bf)];

function renderWith(flags: FeatureFlag[]) {
  return render(
    <FeatureFlagsProvider enabled={flags}>
      <SaleEventsProvider
        events={[
          { slug: "black-friday", name: "Black Friday", tickerTheme: "red" },
        ]}
        badges={{}}
        pcts={{}}
        themes={{}}
        bundleEventSlugs={["black-friday"]}
      >
        <CollectionBrowser collections={list} customEnabled={false} />
      </SaleEventsProvider>
    </FeatureFlagsProvider>,
  );
}

describe("CollectionBrowser — арга хэмжээний chip", () => {
  it("туг нээлттэй: chip гарч, сонговол зөвхөн тэр event-ийн багцууд", () => {
    renderWith(["sale_events", "sale_event_bundles"]);
    const chip = screen.getByRole("button", { name: "Black Friday" });
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(chip);
    expect(chip.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(
      ["LUXURY", "OFFICE"],
    );
  });

  it("туг sale_event_bundles хаалттай: chip байхгүй, бүх багц", () => {
    renderWith(["sale_events"]);
    expect(screen.queryByRole("button", { name: "Black Friday" })).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});
