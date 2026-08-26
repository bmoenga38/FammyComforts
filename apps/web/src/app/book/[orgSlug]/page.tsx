"use client";

import { Suspense } from "react";
import { Catalog } from "./catalog";

/**
 * Public guest catalog route (`/book/[orgSlug]`, no app shell). The catalog
 * component lives in `./catalog` so it can also render in-shell at `/browse`
 * for signed-in customers (Next.js page files can't export extra components).
 */
export default function CatalogPage() {
  return (
    <Suspense fallback={null}>
      <Catalog />
    </Suspense>
  );
}
