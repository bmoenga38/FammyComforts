"use client";

import { Suspense } from "react";
import { Home } from "./home";

/**
 * Public landing page for a property (`/book/[orgSlug]`, no app shell): hero,
 * six database-driven rooms, benefits, about, location and CTA. The full room
 * list lives behind sign-in at `/browse`, which renders `./catalog` in-shell.
 */
export default function CatalogPage() {
  return (
    <Suspense fallback={null}>
      <Home />
    </Suspense>
  );
}
