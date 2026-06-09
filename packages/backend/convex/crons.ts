import { cronJobs } from "convex/server";
// import { internal } from "./_generated/api"; // re-enable together with the cron below

/**
 * Scheduled jobs (Story 1.10). There is exactly ONE `crons.ts` per Convex
 * deployment. Cron registration only takes effect on `convex deploy`.
 *
 * ⚠️ TEMPORARILY DISABLED: the daily backup cron is commented out until
 * `runExport()` in `backups.ts` is wired to a real `convex export` — otherwise
 * it would fail every day on the deployment (the stub throws). Re-enable when
 * the live export lands.
 *
 * All Convex cron times are UTC. Kenya (EAT) is UTC+3, so 00:00 EAT = 21:00 UTC
 * the previous day → `hourUTC: 21`.
 */
const crons = cronJobs();

// crons.daily(
//   "daily backup export",
//   { hourUTC: 21, minuteUTC: 0 }, // 00:00 EAT
//   internal.backups.dailyExport,
//   {},
// );

export default crons;
