import type { NextConfig } from "next";
import path from "node:path";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  // Precache the offline fallback document so it is available when offline.
  additionalPrecacheEntries: [{ url: "/offline", revision: null }],
  // The service worker is only built for production; disabled during `next dev`.
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // Pin the monorepo root so Next/Turbopack does not infer it from sibling lockfiles.
  turbopack: {
    root: path.join(import.meta.dirname, "..", ".."),
  },
};

export default withSerwist(nextConfig);
