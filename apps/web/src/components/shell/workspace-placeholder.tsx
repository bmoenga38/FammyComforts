import { EmptyState } from "@/components/ui";
import type { Workspace } from "@/lib/workspaces";

/**
 * Placeholder body for a workspace route. Story 1.7 ships the navigable shell
 * only — each workspace's real features arrive in a later epic, so each route
 * renders this empty state. The workspace title itself is the top-bar `<h1>`.
 */
export function WorkspacePlaceholder({ workspace }: { workspace: Workspace }) {
  const Icon = workspace.icon;
  return (
    <EmptyState
      icon={<Icon />}
      title={`${workspace.title} — coming soon`}
      description="This workspace's features arrive in a later epic. The navigation shell is in place."
    />
  );
}
