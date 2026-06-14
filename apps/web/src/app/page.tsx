"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { homeForRole } from "@/lib/home-route";

/**
 * Root resolver. Sends each visitor to the right place:
 *  - not signed in  → the public guest booking catalog (`/book`)
 *  - signed in      → their role's home (admin → /admin, reception → /front-desk,
 *                     customer → /guest, …) via homeForRole(me.role)
 * Replaces the old blanket redirect that dropped everyone (incl. admins) on /book.
 */
export default function RootPage() {
  const router = useRouter();
  const me = useQuery(api.identity.me);

  useEffect(() => {
    if (me === undefined) return; // still resolving the session
    router.replace(me === null ? "/book" : homeForRole(me.role));
  }, [me, router]);

  return (
    <main className="grid min-h-dvh place-items-center">
      <span className="spinner" aria-label="Loading" />
    </main>
  );
}
