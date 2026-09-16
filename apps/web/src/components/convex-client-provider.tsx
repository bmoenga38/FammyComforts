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
/**
 * Fail with a message that says what to do. Without this the error is Convex's
 * generic "No address provided", raised from module scope while Next prerenders
 * the root layout — which reads as a mysterious build failure rather than a
 * missing variable. See `.env.example`; CI supplies a placeholder in `ci.yml`.
 */
const address = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!address) {
  throw new Error(
    "NEXT_PUBLIC_CONVEX_URL is not set. Copy apps/web/.env.example to " +
      "apps/web/.env.local and point it at your Convex deployment " +
      "(`npx convex dev` prints the URL).",
  );
}

const convex = new ConvexReactClient(address);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexAuthProvider client={convex}>{children}</ConvexAuthProvider>;
}
