import { redirect } from "next/navigation";

/**
 * The app lands on the public guest booking experience by default. `/book`
 * forwards to the active tenant's catalog (`/book/<slug>`, slug from
 * NEXT_PUBLIC_DEMO_ORG_SLUG). Staff reach their workspaces via SSO or the nav.
 */
export default function RootPage() {
  redirect("/book");
}