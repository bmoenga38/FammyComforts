import type { Metadata } from "next";
import { WorkspacePlaceholder } from "@/components/shell/workspace-placeholder";
import { WORKSPACE_BY_SLUG } from "@/lib/workspaces";

const workspace = WORKSPACE_BY_SLUG.housekeeping;

export const metadata: Metadata = { title: workspace.title };

export default function HousekeepingWorkspacePage() {
  return <WorkspacePlaceholder workspace={workspace} />;
}
