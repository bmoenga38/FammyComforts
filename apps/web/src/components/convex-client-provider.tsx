"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

/**
 * Convex + Convex Auth client provider (Epic 2, Story 2.1 — first story to need
 * a Convex client in the web app). A single long-lived `ConvexReactClient` feeds
 * `ConvexAuthProvider`, which manages the auth session (tokens in localStorage)
 * and powers `useAuthActions()` / authed `useQuery`.
 *
 * Client-only for now (no SSR cookie/route-guarding) — the Next.js server
 * provider + proxy middleware come with the `(staff)` guard split in Story 2.3.
 */
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
