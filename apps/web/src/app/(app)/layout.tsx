import { AppShell } from "@/components/shell/app-shell";
import { AuthGate } from "@/components/shell/auth-gate";

/**
 * Shared layout for the workspace routes. The `(app)` route group adds no URL
 * segment — it opts every workspace into the app shell, behind the AuthGate so
 * an unauthenticated visit redirects to /signin instead of crashing on an
 * authenticated query.
 */
export default function WorkspacesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthGate>
      <AppShell>{children}</AppShell>
    </AuthGate>
  );
}
