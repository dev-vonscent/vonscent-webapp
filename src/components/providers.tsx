"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeatureFlagsProvider } from "@/components/feature-flags";
import type { FeatureFlag } from "@/lib/constants";

export function Providers({
  children,
  enabledFlags,
}: {
  children: React.ReactNode;
  enabledFlags: readonly FeatureFlag[];
}) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 60_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="black"
      themes={["navy", "black", "white", "pink"]}
      enableSystem={false}
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <FeatureFlagsProvider enabled={enabledFlags}>
          {children}
        </FeatureFlagsProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
