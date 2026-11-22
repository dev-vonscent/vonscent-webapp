import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/admin/sales/new",
  useSearchParams: () => new URLSearchParams(),
}));

import { SaleEditor, type SaleEditorInitial } from "./sale-editor";
import type { SaleProductRow } from "../lib";

const products: SaleProductRow[] = Array.from({ length: 88 }, (_, i) => ({
  id: `p${i}`,
  name: `Бараа ${i}`,
  brand: "B",
  gender: "unisex",
  variants: [
    {
      ml: 5,
      price: 30000,
      salePrice: null,
      saleStartsAt: null,
      saleEndsAt: null,
      isActive: true,
      saleId: null,
    },
  ],
}));

const base: SaleEditorInitial = {
  id: null,
  name: "",
  pcts: {},
  startsOn: "",
  endsOn: "",
  productIds: ["p1", "p2"],
  phase: null,
};

describe("SaleEditor — доод action bar", () => {
  it("хадгалах товч жагсаалтын доор биш, наалддаг toolbar-т", () => {
    render(<SaleEditor initial={base} products={products} busy={{}} />);
    const bar = screen.getByRole("toolbar", { name: "Хямдралын үйлдэл" });
    expect(bar.className).toMatch(/\bsticky\b/);
    expect(
      within(bar).getByRole("button", { name: "Хямдрал үүсгэх" }),
    ).toBeInTheDocument();
    expect(within(bar).getByText("2 бараа сонгосон")).toBeInTheDocument();
  });

  it("засах үед дуусгах, устгах, хадгалах нэг мөрөнд", () => {
    render(
      <SaleEditor
        initial={{ ...base, id: "s1", name: "Март 8", phase: "active" }}
        products={products}
        busy={{}}
      />,
    );
    const bar = screen.getByRole("toolbar", { name: "Хямдралын үйлдэл" });
    for (const name of ["Одоо дуусгах", "Устгах", "Хадгалах"]) {
      expect(within(bar).getByRole("button", { name })).toBeInTheDocument();
    }
  });
});

describe("SaleEditor — арга хэмжээтэй давхцал (0200, сл.10)", () => {
  const spans = {
    p5: [
      {
        name: "Black Friday",
        startsAt: "2026-10-31T16:00:00Z",
        endsAt: "2026-11-06T16:00:00Z",
      },
    ],
  };

  it("хугацаа давхцвал бараа сонгогдохгүй, аль арга хэмжээнд байгааг хэлнэ", () => {
    render(
      <SaleEditor
        initial={{ ...base, startsOn: "2026-10-25", endsOn: "2026-11-11" }}
        products={products}
        busy={{}}
        eventSpans={spans}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: "Бараа 5 сонгох" }),
    ).toBeDisabled();
    expect(screen.getByText("— «Black Friday»")).toBeInTheDocument();
  });

  it("арга хэмжээ дууссаны дараах хугацаа → чөлөөтэй", () => {
    render(
      <SaleEditor
        initial={{ ...base, startsOn: "2026-11-07", endsOn: "2026-11-11" }}
        products={products}
        busy={{}}
        eventSpans={spans}
      />,
    );
    expect(
      screen.getByRole("checkbox", { name: "Бараа 5 сонгох" }),
    ).not.toBeDisabled();
  });

  it("аль хэдийн сонгосон бараа давхцвал улаан + хадгалахгүй алдаа", () => {
    render(
      <SaleEditor
        initial={{
          ...base,
          productIds: ["p5"],
          startsOn: "2026-10-25",
          endsOn: "2026-11-11",
        }}
        products={products}
        busy={{}}
        eventSpans={spans}
      />,
    );
    expect(screen.getByText("— «Black Friday»").className).toContain(
      "text-destructive",
    );
  });
});
