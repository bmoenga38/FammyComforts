import { query } from "./_generated/server";

/**
 * Liveness query — proves the Convex deployment is reachable from a client.
 * (Convex queries are reactive subscriptions; there's no separate REST health
 * endpoint like the superseded NestJS `/api/v1/health`.)
 */
export const check = query({
  args: {},
  handler: async () => ({ status: "ok" as const }),
});
