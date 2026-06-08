import { AppShell } from "@/components/shell/app-shell";

/**
 * Shared layout for the workspace routes. The `(app)` route group adds no URL
 * segment — it only opts the six workspaces into the app shell. (Auth/RBAC land
 * in Epic 2, which will split these into `(guest)` public vs `(staff)` guarded
 * groups per architecture.md.)
 */
export default function WorkspacesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppShell>{children}</AppShell>;
}
