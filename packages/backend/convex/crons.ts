import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Scheduled jobs (Story 1.10). There is exactly ONE `crons.ts` per Convex
 * deployment. Cron registration only takes effect on `convex deploy`.
 *
 * All Convex cron times are UTC. Kenya (EAT) is UTC+3, so 00:00 EAT = 21:00 UTC
 * the previous day → `hourUTC: 21`.
 */
const crons = cronJobs();

crons.daily(
  "daily backup export",
  { hourUTC: 21, minuteUTC: 0 }, // 00:00 EAT
  internal.backups.dailyExport,
  {},
);

export default crons;
