import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline — Fammy Comforts",
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <h1 className="text-2xl font-bold">You&rsquo;re offline</h1>
      <p className="text-text-muted">
        Reconnect to continue. Screens you&rsquo;ve already opened may still be available from the cache.
      </p>
    </main>
  );
}
