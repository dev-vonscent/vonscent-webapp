import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeatureFlagsProvider } from "@/components/feature-flags";
import { SaleBadge, SaleChip } from "./sale-badge";
import { SaleEventsProvider } from "./sale-events-provider";

/** jsdom container query бодохгүй — нэрийн span-ийн классаар шалгана. */
const nameSpan = (c: HTMLElement) =>
  c.querySelector<HTMLElement>("[data-chip-name]");

describe("SaleChip fit — каталогийн карт (нарийн/өргөн)", () => {
  it("нарийн үед зөвхөн хувь: нэр анхдагчаар нуугдана, «…» үгүй", () => {
    const { container } = render(
      <SaleChip theme="navy" pct="~30%" fit>
        Black Friday
      </SaleChip>,
    );
    const name = nameSpan(container)!;
    expect(name.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(name.className).not.toContain("truncate");
    expect(screen.getByText("~30%").className).not.toContain("hidden");
    expect(container.textContent).not.toContain("…");
  });

  it("өргөн үед нэр + хувь: бүтэн текстийн өргөнөөс дээш container босго", () => {
    const { container } = render(
      <SaleChip theme="navy" pct="~30%" fit>
        Black Friday
      </SaleChip>,
    );
    // «Black Friday ~30%» бодитоор ≈ 132px, тооцоо ≈ 140 → 144px босго.
    expect(nameSpan(container)!.className).toContain(
      "@min-[144px]/chip:inline",
    );
    expect(container.textContent).toBe("Black Friday~30%");
  });

  it("хэт урт нэр ямар ч өргөнд багтахгүй → үргэлж зөвхөн хувь", () => {
    const long = "Цагаан сарын их хямдралын долоо хоног 2027 он";
    const { container } = render(
      <SaleChip theme="navy" pct="~30%" fit>
        {long}
      </SaleChip>,
    );
    expect(nameSpan(container)!.className.trim()).toBe("hidden");
  });

  it("маш нарийн үед урт хувь «−10% хүртэл» → богино «~10%»", () => {
    const { container } = render(
      <SaleChip theme="navy" pct="−10% хүртэл" pctShort="~10%" fit>
        Black Friday
      </SaleChip>,
    );
    const long = container.querySelector<HTMLElement>("[data-chip-pct]")!;
    const short = container.querySelector<HTMLElement>(
      "[data-chip-pct-short]",
    )!;
    expect(long.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(long.className).toMatch(/@min-\[(\d+)px\]\/chip:inline/);
    const at = long.className.match(/@min-\[(\d+)px\]/)![1];
    expect(short.className).toContain(`@min-[${at}px]/chip:hidden`);
    expect(
      screen.getByRole("img", { name: "Black Friday, 10% хүртэл хямдралтай" }),
    ).toBeTruthy();
  });

  it("aria-label үргэлж бүтэн", () => {
    render(
      <SaleChip theme="navy" pct="~30%" fit>
        Black Friday
      </SaleChip>,
    );
    expect(
      screen.getByRole("img", { name: "Black Friday, 30% хүртэл хямдралтай" }),
    ).toBeTruthy();
  });

  it("fit-гүй (барааны хуудас, студи) — нэр шууд, нуухгүй", () => {
    const { container } = render(
      <SaleChip theme="navy" pct="~30%">
        Black Friday
      </SaleChip>,
    );
    expect(nameSpan(container)).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.textContent).toBe("Black Friday~30%");
  });
});

describe("SaleBadge — fit зөвхөн арга хэмжээний картын chip-д", () => {
  function renderBadge(surface: "image" | "page", withEvent = true) {
    return render(
      <FeatureFlagsProvider enabled={["sale_events"]}>
        <SaleEventsProvider
          events={[]}
          badges={withEvent ? { p1: "Black Friday" } : {}}
          pcts={withEvent ? { p1: 30 } : {}}
          themes={withEvent ? { p1: "navy" } : {}}
        >
          <SaleBadge productId="p1" onSale salePct="~30%" surface={surface} />
        </SaleEventsProvider>
      </FeatureFlagsProvider>,
    );
  }

  it("картын зураг дээр арга хэмжээний chip → fit", () => {
    const { container } = renderBadge("image");
    expect(nameSpan(container)).not.toBeNull();
    expect(
      screen.getByRole("img", { name: "Black Friday, 30% хүртэл хямдралтай" }),
    ).toBeTruthy();
  });

  it("барааны хуудсанд бүтэн нэр хэвээр", () => {
    const { container } = renderBadge("page");
    expect(nameSpan(container)).toBeNull();
    expect(container.textContent).toBe("Black Friday~30%");
  });

  it("арга хэмжээгүй гар хямдрал «Хямдралтай ~30%» — одоогийнхоор", () => {
    const { container } = renderBadge("image", false);
    expect(nameSpan(container)).toBeNull();
    expect(container.textContent).toBe("Хямдралтай~30%");
    // Нарийн картанд нэр таслагдана, хувь бүтэн.
    expect(screen.getByText("Хямдралтай").className).toContain("truncate");
  });
});
