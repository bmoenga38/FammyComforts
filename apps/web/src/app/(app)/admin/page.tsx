import type { Metadata } from "next";
import Link from "next/link";
import { WorkspacePlaceholder } from "@/components/shell/workspace-placeholder";
import { WORKSPACE_BY_SLUG } from "@/lib/workspaces";

const workspace = WORKSPACE_BY_SLUG.admin;

export const metadata: Metadata = { title: workspace.title };

export default function AdminWorkspacePage() {
  return (
    <div className="space-y-4">
      <WorkspacePlaceholder workspace={workspace} />
      <div className="px-4 md:px-6">
        <Link
          href="/admin/access"
          className="inline-flex h-10 items-center rounded-xl border border-border px-4 text-sm font-medium hover:bg-bg-subtle"
        >
          Manage access (roles, staff, audit) →
        </Link>
      </div>
    </div>
  );
}
