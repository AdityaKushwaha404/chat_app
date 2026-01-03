import axios from "axios";
import cron from "node-cron";

/**
 * keepDatabaseAlive
 * Calls your own /api/keep-alive endpoint so MongoDB Atlas stays awake.
 * Runs as a scheduled background task. Safe to call repeatedly.
 */
export async function keepDatabaseAlive(endpoint: string) {
  try {
    await axios.get(endpoint, { timeout: 10_000 });
    console.log("Pinged MongoDB successfully");
  } catch (err: any) {
    console.error("Failed to ping MongoDB keep-alive endpoint:", err?.message || err);
  }
}

/**
 * scheduleKeepAlive
 * Sets up a cron job to call keepDatabaseAlive every 5 minutes.
 * Only schedules the job when NODE_ENV === 'production'.
 */
export function scheduleKeepAlive(endpoint: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log("Keep-alive cron disabled: not in production");
    return null;
  }

  // run every 5 minutes: '*/5 * * * *'
  const task = cron.schedule("*/5 * * * *", () => {
    // non-blocking: call and forget (the function handles its own errors)
    keepDatabaseAlive(endpoint);
  }, {
    scheduled: true,
    name: "keep-database-alive",
  });

  console.log("Keep-alive cron scheduled: every 5 minutes");
  return task;
}
