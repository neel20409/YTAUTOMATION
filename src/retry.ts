export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  factor?: number;
  maxDelayMs?: number;
}

// Every Gemini call in this pipeline (script gen, topic discovery, image verification, shorts
// scripts) shares one API key's free-tier quota. Since index.ts runs scenes sequentially in a
// single process, a process-wide minimum spacing between calls is enough to keep normal, non-retried
// usage under the quota instead of relying on backoff alone to recover from bursts.
const MIN_CALL_INTERVAL_MS = 12_000; // ~5 req/min, safely under Gemini free-tier's Grounded Search RPM cap
let lastCallAt = 0;

async function throttle(): Promise<void> {
  const wait = lastCallAt + MIN_CALL_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastCallAt = Date.now();
}

/**
 * Retries a Gemini API call on transient errors (429 rate limit, 503 overloaded) with
 * exponential backoff, and throttles all calls to a shared minimum interval beforehand (see
 * MIN_CALL_INTERVAL_MS above) so normal sequential usage doesn't hit the free-tier quota in the
 * first place. Backoff is deliberately patient (defaults up to ~2 minutes total across attempts)
 * since this runs in an unattended cron job where waiting out a quota window beats failing the run.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 8, initialDelayMs = 12_000, factor = 1.8, maxDelayMs = 60_000 } = options;

  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await throttle();
    try {
      return await fn();
    } catch (err) {
      if (!isRetryable(err) || attempt === maxAttempts) throw err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(
        `Gemini call failed (attempt ${attempt}/${maxAttempts}): ${errMsg}. Retrying in ${(delay / 1000).toFixed(1)}s...`
      );
      await sleep(delay);
      delay = Math.min(delay * factor, maxDelayMs);
    }
  }
  // Unreachable, but keeps TypeScript happy about the return type.
  throw new Error("withRetry: exhausted attempts without returning or throwing");
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 429 || status === 503;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
