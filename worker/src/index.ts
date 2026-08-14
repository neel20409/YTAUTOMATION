import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv(); // .env as a fallback/default layer, same convention as web/'s prisma.config.ts

import { startPolling } from "./poller.js";

const controller = new AbortController();

function shutdown(signal: string) {
  console.log(`\nReceived ${signal}, finishing the current run (if any) then exiting...`);
  controller.abort();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

startPolling(controller.signal).catch((err) => {
  console.error("Worker crashed:", err);
  process.exit(1);
});
