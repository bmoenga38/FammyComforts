"use client";

import { Suspense } from "react";
import { useQuery } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { Catalog } from "@/app/book/[orgSlug]/catalog";

/**
 * In-shell room catalog for signed-in customers. The public catalog lives at
 * `/book/[orgSlug]` (no app shell, for walk-ins/SEO); this renders the SAME
 * catalog inside the app shell (sidebar + top bar stay put) using the customer's
 * own org slug from `identity.me`, so "Book" from the dashboard doesn't drop the
 * navigation. Booking still runs through the shared RoomBooking flow.
 */
function BrowseInner() {
  const me = useQuery(api.identity.me);
  const slug = me?.org?.slug;

  if (me === undefined) {
    return <p className="p-6 text-sm text-text-muted">Loading…</p>;
  }
  if (!slug) {
    return <p className="p-6 text-sm text-text-muted">No property linked to your account.</p>;
  }
  return <Catalog orgSlug={slug} embedded />;
}

export default function BrowsePage() {
  return (
    <Suspense fallback={null}>
      <BrowseInner />
    </Suspense>
  );
}
