"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/**
 * App-wide TanStack Query provider, configured for offline tolerance.
 *
 * `networkMode: "offlineFirst"` lets queries/mutations pause while offline and
 * resume on reconnect (via TanStack's onlineManager) — the foundation the
 * offline mutation queue / background sync builds on once real mutations land
 * (Epic 2+). See apps/web/PWA.md for the activation path.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            networkMode: "offlineFirst",
            retry: 2,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
          },
          mutations: {
            networkMode: "offlineFirst",
            retry: 2,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
