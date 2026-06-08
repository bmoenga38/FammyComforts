import { redirect } from "next/navigation";
import { DEFAULT_WORKSPACE } from "@/lib/workspaces";

/** The root lands on the default workspace (Guest Booking). */
export default function RootPage() {
  redirect(DEFAULT_WORKSPACE.href);
}
