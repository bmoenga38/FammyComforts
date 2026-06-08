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
            // Do NOT auto-retry mutations: bookings/payments are non-idempotent,
            // and a retry after a lost response could double-book / double-charge.
            // Individual mutations opt in with an idempotency key (Epic 5).
            retry: 0,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
