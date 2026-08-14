// Simplified from video-pipeline/src/retry.ts: that version rotated across a pool of 10
// free-tier Gemini keys and throttled to ~5 req/min process-wide to survive the free tier's
// harsh per-key daily/RPM caps. Paid billing means one Google Cloud API key with much higher
// rate limits, so there's no pool to rotate and no need for an aggressive shared throttle -
// just retry with backoff on the transient error codes.
export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  factor?: number;
  maxDelayMs?: number;
}

export function getGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing required environment variable: GEMINI_API_KEY");
  return key;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 4, initialDelayMs = 2_000, factor = 2, maxDelayMs = 20_000 } = options;

  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
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
  throw new Error("withRetry: exhausted attempts without returning or throwing");
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return status === 429 || status === 503;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
