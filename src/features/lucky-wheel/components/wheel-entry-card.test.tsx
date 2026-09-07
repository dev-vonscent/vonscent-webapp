import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WheelEntryCard } from "./wheel-entry-card";
import type { WheelState } from "../types";

const state = vi.fn();
vi.mock("../use-wheel", async () => {
  const actual =
    await vi.importActual<typeof import("../use-wheel")>("../use-wheel");
  return {
    ...actual,
    // Only the network read is faked; useCountdown stays real so the row's
    // "in 05:42:00" text is the one the customer would actually see.
    useWheelState: () => ({ data: state() }),
  };
});

const PRIZES: WheelState["prizes"] = [
  {
    slot: 1,
    label: "500 V point",
    shortLabel: "500V",
    kind: "points",
    tier: "common",
    value: 500,
    minSubtotal: 0,
    maxDiscount: null,
  },
];

function wheel(over: Partial<WheelState> = {}): WheelState {
  return {
    enabled: true,
    prizes: PRIZES,
    spinCost: 2000,
    freeSpinHours: 24,
    points: 3400,
    nextFreeAt: null,
    freeReady: true,
    signedIn: true,
    history: [],
    ...over,
  };
}

describe("WheelEntryCard", () => {
  it("invites the customer in when the free spin is up", () => {
    state.mockReturnValue(wheel());
    render(<WheelEntryCard />);
    const link = screen.getByRole("link", { name: /Азын хүрд/ });
    expect(link).toHaveAttribute("href", "/lucky-wheel");
    expect(screen.getByText(/Үнэгүй эргэлт бэлэн/)).toBeInTheDocument();
  });

  it("offers the paid spin while the free one is on cooldown", () => {
    state.mockReturnValue(
      wheel({
        freeReady: false,
        nextFreeAt: new Date(Date.now() + 5 * 3600_000).toISOString(),
      }),
    );
    render(<WheelEntryCard />);
    expect(screen.getByText(/2,000V-оор эргүүлэх/)).toBeInTheDocument();
  });

  it("counts down when there are neither a free spin nor enough points", () => {
    state.mockReturnValue(
      wheel({
        freeReady: false,
        points: 100,
        nextFreeAt: new Date(
          Date.now() + 5 * 3600_000 + 42 * 60_000,
        ).toISOString(),
      }),
    );
    render(<WheelEntryCard />);
    // Not the exact second: the clock can tick between building the target
    // and rendering, turning 05:42:00 into 05:41:59.
    expect(
      screen.getByText(/Дараагийн үнэгүй эргэлт 05:4\d:\d\d-ийн дараа/),
    ).toBeInTheDocument();
  });

  it("renders nothing while the wheel is off or still loading", () => {
    state.mockReturnValue(undefined);
    const { container, rerender } = render(<WheelEntryCard />);
    expect(container).toBeEmptyDOMElement();

    state.mockReturnValue(wheel({ enabled: false }));
    rerender(<WheelEntryCard />);
    expect(container).toBeEmptyDOMElement();

    state.mockReturnValue(wheel({ prizes: [] }));
    rerender(<WheelEntryCard />);
    expect(container).toBeEmptyDOMElement();
  });
});
