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

// Story 1.10 — daily database export to Convex file storage, ledgered in
// `backupRuns` and pruned to RETENTION_COPIES. See convex/BACKUP.md.
crons.daily(
  "daily backup export",
  { hourUTC: 21, minuteUTC: 0 }, // 00:00 EAT
  internal.backups.dailyExport,
  {},
);

// Story 7.8 — time-based escalations (dirty-room SLA, unpaid balances).
crons.hourly(
  "operational escalation sweep",
  { minuteUTC: 10 },
  internal.escalations.sweep,
  {},
);

// Story 10.6 — drain the outbound notification queue (SMS via HostPinnacle
// when HOSTPINNACLE_USER_ID/HOSTPINNACLE_PASSWORD are configured).
crons.interval(
  "notification queue drain",
  { minutes: 5 },
  internal.notificationsEngine.drain,
  {},
);

export default crons;
