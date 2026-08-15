import { prisma } from "./db.js";
import { runJob } from "./pipeline.js";

// Read lazily (function, not a module-level const) for the same reason db.ts's PrismaClient is
// lazy: ES module imports are evaluated before any top-level code in the importing module runs,
// so a frozen `const X = process.env.X` here would capture `undefined` whenever this module is
// imported before the entrypoint's dotenv call executes - regardless of source line order. This
// bit real: SKIP_USAGE_CAP silently evaluated to false even with .env.local setting it to
// "true", because poller.js's import gets hoisted ahead of runOnce.ts's/index.ts's loadEnv().
function pollIntervalMs(): number {
  return Number(process.env.POLL_INTERVAL_MS ?? 5_000);
}

/**
 * Atomically claims the oldest queued Run using Postgres's standard job-queue pattern
 * (UPDATE ... WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1)) so multiple worker
 * instances could poll the same table concurrently without double-claiming a row. A single
 * worker instance is enough for now (see the approved plan's M3 phase for scaling this up),
 * but the claim itself is safe for concurrency from day one since it costs nothing extra.
 *
 * The usage cap is enforced right here, as part of the claim query, rather than checked after
 * claiming: a run whose owner is over quota (or has no active subscription at all) is simply
 * never selected, so it stays QUEUED indefinitely instead of being claimed and failed. That
 * means it becomes claimable automatically the moment the owner's period resets or they
 * upgrade - no separate "blocked" state or manual re-queue needed. `FOR UPDATE OF r` locks only
 * the Run row itself, not the joined Channel/Subscription rows, so this doesn't create lock
 * contention between unrelated runs that happen to share one owner's subscription.
 *
 * SKIP_USAGE_CAP=true drops the Subscription join/check entirely - for single-operator use
 * before Stripe billing is actually turned on for real users, requiring a paid subscription
 * just to run your own worker would be backwards. Defaults to false (cap enforced) so this has
 * to be deliberately opted into, not something that silently ends up on in a real multi-tenant
 * deployment.
 */
function skipUsageCap(): boolean {
  return process.env.SKIP_USAGE_CAP === "true";
}

export async function claimNextRun(): Promise<string | null> {
  const claimed = skipUsageCap()
    ? await prisma.$queryRaw<{ id: string }[]>`
        UPDATE "Run" SET status = 'RUNNING', "startedAt" = now()
        WHERE id = (
          SELECT id FROM "Run"
          WHERE status = 'QUEUED'
          ORDER BY "createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        RETURNING id
      `
    : await prisma.$queryRaw<{ id: string }[]>`
        UPDATE "Run" SET status = 'RUNNING', "startedAt" = now()
        WHERE id = (
          SELECT r.id FROM "Run" r
          JOIN "Channel" c ON c.id = r."channelId"
          JOIN "Subscription" s ON s."userId" = c."userId"
          WHERE r.status = 'QUEUED'
            AND s.status = 'ACTIVE'
            AND s."videosUsedThisPeriod" < s."videosIncludedPerPeriod"
          ORDER BY r."createdAt" ASC
          FOR UPDATE OF r SKIP LOCKED
          LIMIT 1
        )
        RETURNING id
      `;
  return claimed[0]?.id ?? null;
}

export async function processRun(runId: string): Promise<void> {
  const run = await prisma.run.findUniqueOrThrow({
    where: { id: runId },
    include: { channel: { include: { youtubeConnection: true } }, topic: true },
  });

  console.log(`[Run ${runId}] claimed - channel "${run.channel.displayName}", topic "${run.topic.title}"`);

  try {
    const { videoUrl } = await runJob({ id: run.id, channel: run.channel, topic: run.topic });
    await prisma.run.update({
      where: { id: runId },
      data: { status: "SUCCEEDED", videoUrl, finishedAt: new Date() },
    });
    // Counts against the owner's plan only on a real successful upload - a failed attempt
    // (e.g. Veo rejected the prompt) shouldn't burn part of what they're paying for.
    await prisma.subscription.updateMany({
      where: { userId: run.channel.userId },
      data: { videosUsedThisPeriod: { increment: 1 } },
    });
    console.log(`[Run ${runId}] succeeded: ${videoUrl}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[Run ${runId}] failed at stage (see Run.stage): ${message}`);
    await prisma.run.update({
      where: { id: runId },
      data: { status: "FAILED", errorMessage: message, errorStack: stack, finishedAt: new Date() },
    });
  }
}

export async function startPolling(signal: AbortSignal): Promise<void> {
  const intervalMs = pollIntervalMs();
  console.log(`Worker polling every ${intervalMs}ms for queued runs...`);
  while (!signal.aborted) {
    let runId: string | null = null;
    try {
      runId = await claimNextRun();
    } catch (err) {
      console.error("Failed to poll for queued runs:", err);
    }

    if (runId) {
      await processRun(runId);
      continue; // check for another queued run immediately rather than waiting a full interval
    }

    await sleep(intervalMs, signal);
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
