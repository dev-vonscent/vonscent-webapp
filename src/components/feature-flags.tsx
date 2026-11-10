"use client";

import * as React from "react";
import type { FeatureFlag } from "@/lib/constants";

/**
 * Client component-д feature flag (0133). Root layout серверээс ЗӨВХӨН
 * асаалттай тугуудыг дамжуулна — унтраалттай feature-ийн нэр HTML-д гарахгүй.
 *
 * Энэ нь зөвхөн UI нуух давхарга: route handler ба SQL тал өөрөө
 * `isFeatureEnabled` / `feature_enabled()`-ээр давхар шалгана.
 */
const FeatureFlagsContext = React.createContext<ReadonlySet<string>>(new Set());
const FeatureFlagSinceContext = React.createContext<
  Partial<Record<FeatureFlag, string>>
>({});

export function FeatureFlagsProvider({
  enabled,
  since = {},
  children,
}: {
  enabled: readonly FeatureFlag[];
  /** Асаалттай туг бүрийг асаасан цаг (ISO) — `useFeatureFlagSince`. */
  since?: Partial<Record<FeatureFlag, string>>;
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => new Set<string>(enabled), [enabled]);
  return (
    <FeatureFlagsContext.Provider value={value}>
      <FeatureFlagSinceContext.Provider value={since}>
        {children}
      </FeatureFlagSinceContext.Provider>
    </FeatureFlagsContext.Provider>
  );
}

/** Тугийг хэзээ асаасан (ISO), унтраалттай бол null. */
export function useFeatureFlagSince(key: FeatureFlag): string | null {
  return React.useContext(FeatureFlagSinceContext)[key] ?? null;
}

export function useFeatureFlag(key: FeatureFlag): boolean {
  return React.useContext(FeatureFlagsContext).has(key);
}

/** Асаалттай бүх туг — жагсаалтаас (ж: цэс) олон түлхүүрийг шүүхэд. */
export function useFeatureFlagSet(): ReadonlySet<string> {
  return React.useContext(FeatureFlagsContext);
}
