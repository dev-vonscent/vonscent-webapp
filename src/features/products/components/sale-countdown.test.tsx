import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FeatureFlagsProvider } from "@/components/feature-flags";
import { __resetNowTick } from "@/components/shared/use-now-tick";
import type { FeatureFlag } from "@/lib/constants";
import { SaleCountdown } from "./sale-countdown";

const NOW = Date.parse("2026-11-18T03:00:00Z");
// 7 өдөр 16:45:32 дараа.
const ENDS = new Date(
  NOW + ((7 * 24 + 16) * 3600 + 45 * 60 + 32) * 1000,
).toISOString();

function withFlags(
  node: React.ReactNode,
  enabled: FeatureFlag[] = ["sale_display"],
) {
  return <FeatureFlagsProvider enabled={enabled}>{node}</FeatureFlagsProvider>;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  __resetNowTick();
  vi.useRealTimers();
});

describe("SaleCountdown (2.2)", () => {
  it("SSR HTML-д тоолуурын текст гарахгүй (зөвхөн зай)", () => {
    const html = renderToString(withFlags(<SaleCountdown endsAt={ENDS} />));
    expect(html).not.toMatch(/өдөр/);
    expect(html).not.toMatch(/\d\d:\d\d/);
    expect(html).toMatch(/invisible/);
  });

  it("client дээр «7 өдөр 16:45:32», секунд тутам буурна", async () => {
    render(withFlags(<SaleCountdown endsAt={ENDS} />));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("timer").textContent).toContain("7 өдөр 16:45:32");
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("timer").textContent).toContain("7 өдөр 16:45:31");
  });

  it("олон тоолуур НЭГ setInterval хуваалцана", async () => {
    const spy = vi.spyOn(globalThis, "setInterval");
    render(
      withFlags(
        <>
          <SaleCountdown endsAt={ENDS} />
          <SaleCountdown endsAt={ENDS} />
          <SaleCountdown endsAt={ENDS} />
        </>,
      ),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getAllByRole("timer")).toHaveLength(3);
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it("0 болоход нуугдана", async () => {
    const soon = new Date(NOW + 2000).toISOString();
    render(withFlags(<SaleCountdown endsAt={soon} />));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("timer").textContent).toContain("00:00:02");
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("хугацаагүй хямдрал эсвэл туг хаалттай бол юу ч үгүй", () => {
    const { container: a } = render(withFlags(<SaleCountdown endsAt={null} />));
    expect(a.innerHTML).toBe("");
    const { container: b } = render(
      withFlags(<SaleCountdown endsAt={ENDS} />, []),
    );
    expect(b.innerHTML).toBe("");
  });
});

describe("SaleCountdown — өнгө (24 цагийн босго)", () => {
  async function mount(msLeft: number) {
    render(
      withFlags(
        <SaleCountdown endsAt={new Date(NOW + msLeft).toISOString()} />,
      ),
    );
    await act(async () => {
      await Promise.resolve();
    });
  }
  const H = 3600 * 1000;

  it("> 24ц → саармаг (muted)", async () => {
    await mount(3 * 24 * H);
    const el = screen.getByRole("timer");
    expect(el.className).toContain("text-muted-foreground");
    expect(el.className).not.toContain("text-destructive");
  });

  it("≤ 24ц → улаан (destructive)", async () => {
    await mount(24 * H);
    const el = screen.getByRole("timer");
    expect(el.className).toContain("text-destructive");
    expect(el.className).not.toContain("text-muted-foreground");
  });

  it("босго давахад нэг tick-д улаан болно, 0-д нуугдана", async () => {
    await mount(24 * H + 1000);
    expect(screen.getByRole("timer").className).toContain(
      "text-muted-foreground",
    );
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("timer").className).toContain("text-destructive");
    await act(async () => {
      vi.advanceTimersByTime(24 * H);
    });
    expect(screen.queryByRole("timer")).toBeNull();
  });

  it("SSR HTML-д улаан төлөв гарахгүй", () => {
    const html = renderToString(
      withFlags(<SaleCountdown endsAt={new Date(NOW + H).toISOString()} />),
    );
    expect(html).not.toMatch(/text-destructive|data-urgent/);
  });

  it("бараан зурган дээрх цагаан хувилбар хэвээр", async () => {
    render(
      withFlags(
        <SaleCountdown
          endsAt={new Date(NOW + H).toISOString()}
          className="text-white"
        />,
      ),
    );
    await act(async () => {
      await Promise.resolve();
    });
    const el = screen.getByRole("timer");
    expect(el.className).toContain("text-white");
    expect(el.className).not.toContain("text-destructive");
  });
});
