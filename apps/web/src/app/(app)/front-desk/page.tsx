import type { Metadata } from "next";
import { WorkspacePlaceholder } from "@/components/shell/workspace-placeholder";
import { WORKSPACE_BY_SLUG } from "@/lib/workspaces";

const workspace = WORKSPACE_BY_SLUG["front-desk"];

export const metadata: Metadata = { title: workspace.title };

export default function FrontDeskWorkspacePage() {
  return <WorkspacePlaceholder workspace={workspace} />;
}
