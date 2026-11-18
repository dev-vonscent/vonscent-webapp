import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeatureFlagsProvider } from "@/components/feature-flags";
import { SizePrice } from "./size-price";

const ENDS = new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString();

function quick(props: { price: number; basePrice: number; reserve: boolean }) {
  return (
    <FeatureFlagsProvider enabled={["sale_display"]}>
      <SizePrice size="sm" sizeLabel="2ml" endsAt={ENDS} {...props} />
    </FeatureFlagsProvider>
  );
}

describe("SizePrice size=sm (quick-add)", () => {
  it("reserve үед хямдралгүй хэмжээнд ч тоолуурын мөрийн өндөр хадгалагдана", () => {
    render(quick({ price: 12000, basePrice: 12000, reserve: true }));
    const slot = screen.getByTestId("size-price-countdown-slot");
    expect(slot.className).toContain("min-h-4");
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("хямдралтай хэмжээнд тоолуур ижил мөрөнд", () => {
    render(quick({ price: 21300, basePrice: 25000, reserve: true }));
    const slot = screen.getByTestId("size-price-countdown-slot");
    expect(slot.querySelector("[role=timer]")).not.toBeNull();
  });

  it("хямдралгүй бараанд нэмэлт зай үгүй", () => {
    render(quick({ price: 12000, basePrice: 12000, reserve: false }));
    expect(screen.queryByTestId("size-price-countdown-slot")).toBeNull();
  });
});
