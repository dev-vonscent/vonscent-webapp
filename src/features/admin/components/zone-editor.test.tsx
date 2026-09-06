import * as React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ZoneEditor } from "./zone-editor";
import { SHIPPING_ZONES, type ShippingZoneConfig } from "@/lib/constants";

vi.mock("@/lib/toast", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

/** The editor is controlled; the page owns the zones, so the test does too. */
function Harness({ onZones }: { onZones?: (z: ShippingZoneConfig[]) => void }) {
  const [zones, setZones] = React.useState<ShippingZoneConfig[]>(
    SHIPPING_ZONES.map((z) => ({ ...z })),
  );
  return (
    <ZoneEditor
      zones={zones}
      onChange={(next) => {
        setZones(next);
        onZones?.(next);
      }}
    />
  );
}

const openZoneA = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(await screen.findByText(/^\d+ нэгж · Баянгол 34/));

describe("ZoneEditor", () => {
  it("never renders the full city-district-khoroo string on a chip", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openZoneA(user);
    expect(screen.queryByText(/-р хороо/)).toBeNull();
    expect(
      within(screen.getByRole("button", { name: "Баянгол — 5" })).queryByText(
        "5",
      ),
    ).not.toBeNull();
  });

  it("moves the selected khoroos into another zone in one tap", async () => {
    const user = userEvent.setup();
    const onZones = vi.fn();
    render(<Harness onZones={onZones} />);
    await openZoneA(user);

    await user.click(screen.getByRole("button", { name: "Баянгол — 5" }));
    await user.click(screen.getByRole("button", { name: "Баянгол — 6" }));
    expect(screen.getByText(/сонгогдлоо/)).toHaveTextContent(
      "2 хороо (A бүсээс) сонгогдлоо. Аль бүс рүү шилжүүлэх вэ?",
    );

    await user.click(
      screen.getByRole("button", {
        name: "В бүс (захын хороолол) руу шилжүүлэх",
      }),
    );

    const zones: ShippingZoneConfig[] = onZones.mock.lastCall![0];
    expect(zones.find((z) => z.code === "C")!.areas).toEqual([
      "MN1107:5",
      "MN1107:6",
    ]);
    // Баянгол is no longer whole, so zone A holds its remaining khoroos by name.
    const a = zones.find((z) => z.code === "A")!.areas!;
    expect(a).not.toContain("MN1107");
    expect(a).not.toContain("MN1107:5");
    expect(a).toContain("MN1107:7");
    // Selection clears and the target zone opens.
    expect(screen.queryByText(/сонгогдлоо/)).toBeNull();
  });

  it("offers only the unassigned pool in the add panel", async () => {
    const user = userEvent.setup();
    const onZones = vi.fn();
    render(<Harness onZones={onZones} />);
    // Zone C starts empty. The seed covers all nine capital districts between
    // A, B and R, so the only thing loose is the аймаг list — and that is all
    // the panel may show: a хороо held by another zone moves through the bar.
    await user.click(screen.getAllByText("Хамрах газар нутаг оноогдоогүй")[0]);
    await user.click(
      screen.getByRole("button", { name: /Оноогдоогүй хороо нэмэх/ }),
    );
    expect(screen.queryByRole("button", { name: "Багануур — 1" })).toBeNull();

    const khovd = screen.getByRole("button", { name: "Аймгууд — Ховд" });
    await user.click(khovd);
    await user.click(screen.getByRole("button", { name: "1 нэгж нэмэх" }));

    const zones: ShippingZoneConfig[] = onZones.mock.lastCall![0];
    expect(zones.find((z) => z.code === "C")!.areas!.length).toBeGreaterThan(1);
    expect(zones.find((z) => z.code === "X")!.areas).toEqual([]);
    // R keeps exactly what it had — nothing was pulled out of another zone.
    expect([...zones.find((z) => z.code === "R")!.areas!].sort()).toEqual([
      "MN1101",
      "MN1104",
      "MN1113",
    ]);
  });

  it("counts assigned and unassigned units in the status line", () => {
    render(<Harness />);
    // 204 хороо + 21 аймаг = 225 units; the seed assigns 7 whole districts.
    expect(
      screen.getByText(/нэгж оноогдсон · .* нэгж оноогдоогүй/),
    ).toBeInTheDocument();
  });
});
