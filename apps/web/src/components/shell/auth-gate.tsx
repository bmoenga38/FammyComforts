"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

/**
 * Route guard for the workspace shell (the gap-listed `(staff)` guard). Staff
 * and customer pages all run authenticated Convex queries; without a session
 * those queries throw and the route hard-crashes ("This page couldn't load").
 *
 * This gates the whole `(app)` tree on the Convex Auth session:
 *  - resolving  → a splash (no children, so no premature authed queries)
 *  - signed-out → redirect to /signin
 *  - signed-in  → render the shell + page
 */
function Splash() {
  return (
    <main className="grid min-h-dvh place-items-center">
      <span className="spinner" aria-label="Loading" />
    </main>
  );
}

function RedirectToSignin() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/signin");
  }, [router]);
  return <Splash />;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthLoading>
        <Splash />
      </AuthLoading>
      <Unauthenticated>
        <RedirectToSignin />
      </Unauthenticated>
      <Authenticated>{children}</Authenticated>
    </>
  );
}
