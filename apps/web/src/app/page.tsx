"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { homeForRole } from "@/lib/home-route";

/**
 * Root resolver. Sends each visitor to the right place:
 *  - not signed in  → the public guest booking catalog (`/book`)
 *  - signed in      → their role's home (admin → /admin, reception → /front-desk,
 *                     customer → /guest, …) via homeForRole(me.role)
 *
 * Gate on the AUTH SESSION (`useConvexAuth`), not just `identity.me`: right after
 * sign-in the Convex client hasn't propagated the token yet, so `me` briefly
 * returns null. Treating that null as "signed out" bounced fresh logins to
 * /book → /book/<slug> instead of their dashboard. We only redirect to /book
 * once auth has genuinely resolved as unauthenticated.
 */
export default function RootPage() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useConvexAuth();
  const me = useQuery(api.identity.me);

  useEffect(() => {
    if (isLoading) return; // auth session still resolving
    if (!isAuthenticated) {
      router.replace("/book"); // genuinely signed out → public catalog
      return;
    }
    if (me === undefined) return; // authed; wait for the profile to load
    router.replace(me ? homeForRole(me.role) : "/book");
  }, [isLoading, isAuthenticated, me, router]);

  return (
    <main className="grid min-h-dvh place-items-center">
      <span className="spinner" aria-label="Loading" />
    </main>
  );
}
