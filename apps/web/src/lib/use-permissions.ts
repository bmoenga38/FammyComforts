"use client";

import { useQuery } from "convex/react";
import { api } from "@fammycomforts/backend/convex/_generated/api";
import { hasPermission } from "./permissions";

/**
 * The signed-in user's permission set, reactive (Stories 2.3–2.5). Backed by
 * `roles.myPermissions`; `can(area, action)` drives UI gating. Server stays
 * authoritative — gating only hides/disables affordances.
 */
export function usePermissions() {
  const perms = useQuery(api.roles.myPermissions);
  const list = perms ?? [];
  return {
    perms: list,
    isLoading: perms === undefined,
    can: (area: string, action: string) => hasPermission(list, area, action),
  };
}
