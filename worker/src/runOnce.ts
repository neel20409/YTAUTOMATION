import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();

import { claimNextRun, processRun } from "./poller.js";

// GitHub-Actions-friendly entrypoint: unlike index.ts's startPolling (a persistent daemon loop
// meant for an always-on host like Render), this claims and processes whatever's queued, then
// exits - a scheduled workflow run invokes this on a cron interval instead of staying alive
// between runs. TIME_BUDGET_MS caps how long one invocation processes a backlog before exiting,
// so a long queue doesn't monopolize the runner indefinitely; leftover queued runs just get
// picked up by the next scheduled trigger.
const TIME_BUDGET_MS = Number(process.env.TIME_BUDGET_MS ?? 25 * 60 * 1000);

async function main() {
  const deadline = Date.now() + TIME_BUDGET_MS;
  let processed = 0;

  while (Date.now() < deadline) {
    const runId = await claimNextRun();
    if (!runId) {
      console.log(processed === 0 ? "No queued runs found." : `No more queued runs (processed ${processed}).`);
      break;
    }
    await processRun(runId);
    processed++;
  }

  if (Date.now() >= deadline) {
    console.log(`Time budget exhausted after processing ${processed} run(s) - remaining queued runs will be picked up next trigger.`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("run-once crashed:", err);
    process.exit(1);
  });
