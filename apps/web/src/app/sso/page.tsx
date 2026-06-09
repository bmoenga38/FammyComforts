"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthActions } from "@convex-dev/auth/react";
import { DEFAULT_WORKSPACE } from "@/lib/workspaces";

/**
 * SSO landing route (Epic 2, Story 2.1). BytePlane's ByteStay tile opens
 * `/sso?token=<handoff>`. We trade the one-time token for a FammyComfort session
 * via the `sso-handoff` Convex Auth provider (which verifies it against
 * Bytebazaar, upserts the org/user cache, and consumes it), then redirect into
 * the app.
 *
 * `useSearchParams` suspends, so the work lives under a Suspense boundary.
 */
function SsoHandoff() {
  const { signIn } = useAuthActions();
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return; // one attempt (tokens are single-use)
    started.current = true;
    signIn("sso-handoff", { token })
      .then(() => router.replace(DEFAULT_WORKSPACE.href))
      .catch(() => setFailed(true)); // async result — set in the promise callback
  }, [token, signIn, router]);

  // Derived at render — no synchronous setState in the effect.
  const error = !token
    ? "Missing sign-in token. Open ByteStay from the BytePlane launcher."
    : failed
      ? "That sign-in link is invalid or has expired. Re-open ByteStay from BytePlane."
      : null;

  return (
    <main className="grid min-h-dvh place-items-center bg-bg p-6 text-fg">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-card p-8 text-center">
        {error ? (
          <>
            <h1 className="text-lg font-semibold">Couldn’t sign you in</h1>
            <p className="mt-2 text-sm text-fg-muted">{error}</p>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Signing you in…</h1>
            <p className="mt-2 text-sm text-fg-muted">
              Completing your secure handoff from BytePlane.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

export default function SsoPage() {
  return (
    <Suspense fallback={null}>
      <SsoHandoff />
    </Suspense>
  );
}
