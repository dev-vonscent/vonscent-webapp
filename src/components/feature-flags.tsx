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

export function FeatureFlagsProvider({
  enabled,
  children,
}: {
  enabled: readonly FeatureFlag[];
  children: React.ReactNode;
}) {
  const value = React.useMemo(() => new Set<string>(enabled), [enabled]);
  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlag(key: FeatureFlag): boolean {
  return React.useContext(FeatureFlagsContext).has(key);
}
