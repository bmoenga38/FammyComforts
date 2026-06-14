"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";

/**
 * Error boundary for the workspace shell. If a page's query throws (e.g. a
 * permission the role lacks, or a transient network blip), show a recoverable
 * message instead of a blank "couldn't load" crash. `reset()` re-renders the
 * segment; the home link routes back through the role resolver.
 */
export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Workspace route error:", error);
  }, [error]);

  return (
    <main className="grid min-h-[60vh] place-items-center p-6">
      <div className="glass-panel max-w-md rounded-card p-7 text-center">
        <h1 className="font-display text-headline-md text-text">This page couldn’t load</h1>
        <p className="mt-2 text-body-md text-text-muted">
          Something went wrong, or you may not have access to this area. Try again, or head back.
        </p>
        <div className="mt-5 flex justify-center gap-2.5">
          <Button onClick={reset}>Try again</Button>
          <Link href="/" className="btn btn-ghost">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
