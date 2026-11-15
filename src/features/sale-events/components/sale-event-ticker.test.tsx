import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const { SaleEventTicker } = await import("./sale-event-ticker");

const NOW = Date.parse("2026-11-20T10:00:00Z");
const event = (over: Partial<Parameters<typeof SaleEventTicker>[0]["events"][number]> = {}) => ({
  slug: "black-friday",
  name: "Black Friday",
  headline: "Black Friday ~30%",
  endsAt: new Date(NOW + (2 * 86_400 + 4 * 3600 + 31 * 60 + 10) * 1000).toISOString(),
  showCountdown: true,
  tickerTheme: null as "navy" | "red" | null,
  ...over,
});

describe("SaleEventTicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    refresh.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("өнгө: арга хэмжээнийх эсвэл өгөгдмөл navy", () => {
    const { container, rerender } = render(<SaleEventTicker events={[event()]} />);
    expect(container.querySelector("[role=region]")).toHaveAttribute("data-ticker", "navy");
    rerender(<SaleEventTicker events={[event({ tickerTheme: "red" })]} />);
    expect(container.querySelector("[role=region]")).toHaveAttribute("data-ticker", "red");
    expect(screen.getByRole("link")).toHaveAttribute("data-ticker", "red");
  });

  it("арга хэмжээгүй бол юу ч зурахгүй", () => {
    const { container } = render(<SaleEventTicker events={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("гарчиг + секундээр гүйх тоолуур; давталт нь дэлгэц уншигчаас нуугдана", () => {
    render(<SaleEventTicker events={[event()]} />);
    const links = screen.getAllByRole("link");
    // Эхний давталт л хүртээмжтэй (бусад нь aria-hidden).
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/catalog?event=black-friday");
    expect(links[0]).toHaveTextContent("Black Friday ~30%");
    expect(links[0]).toHaveTextContent("2 өдөр 04:31:10");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("link")).toHaveTextContent("2 өдөр 04:31:09");
  });

  it("гарчиг хоосон бол нэр; тоолуур унтраалттай бол цаг гарахгүй", () => {
    render(
      <SaleEventTicker events={[event({ headline: " ", showCountdown: false })]} />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveTextContent("Black Friday");
    expect(link).not.toHaveTextContent("Дуусахад");
  });

  it("дуусмагц нуугдаж, серверээс шинэчилнэ", () => {
    const { container } = render(
      <SaleEventTicker
        events={[event({ endsAt: new Date(NOW + 2000).toISOString() })]}
      />,
    );
    expect(screen.getByRole("link")).toHaveTextContent("00:00:02");
    act(() => vi.advanceTimersByTime(2000));
    expect(container).toBeEmptyDOMElement();
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
