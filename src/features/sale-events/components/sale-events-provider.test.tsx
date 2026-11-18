import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { FeatureFlagsProvider } from "@/components/feature-flags";
import type { FeatureFlag } from "@/lib/constants";
import {
  SaleEventsProvider,
  useBundleSaleEvents,
  useLiveSaleEvents,
} from "./sale-events-provider";

const events = [
  { slug: "black-friday", name: "Black Friday", tickerTheme: "navy" as const },
  { slug: "tsagaan-sar", name: "Цагаан сар", tickerTheme: "red" as const },
];

function wrapper(flags: FeatureFlag[]) {
  return function W({ children }: { children: React.ReactNode }) {
    return (
      <FeatureFlagsProvider enabled={flags}>
        <SaleEventsProvider
          events={events}
          badges={{}}
          pcts={{}}
          themes={{}}
          bundleEventSlugs={["black-friday"]}
        >
          {children}
        </SaleEventsProvider>
      </FeatureFlagsProvider>
    );
  };
}

describe("«Багц» табын арга хэмжээний chip (16.7)", () => {
  it("туг нээлттэй → зөвхөн бэлэн багцтай арга хэмжээ", () => {
    const { result } = renderHook(() => useBundleSaleEvents(), {
      wrapper: wrapper(["sale_events", "sale_event_bundles"]),
    });
    expect(result.current.map((e) => e.slug)).toEqual(["black-friday"]);
  });

  it("туг sale_event_bundles хаалттай → chip байхгүй (өмнөх шиг)", () => {
    const { result } = renderHook(
      () => ({ bundle: useBundleSaleEvents(), all: useLiveSaleEvents() }),
      { wrapper: wrapper(["sale_events"]) },
    );
    expect(result.current.bundle).toEqual([]);
    // «Бүгд» таб хэвээр.
    expect(result.current.all).toHaveLength(2);
  });
});
