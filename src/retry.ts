export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  factor?: number;
}

/**
 * Retries a Gemini API call on transient errors (429 rate limit, 503 overloaded) with
 * exponential backoff. Free-tier quotas (e.g. Gemini 3 Flash's ~10 requests/minute) get hit
 * in normal bursty usage - without this, a temporary rate limit fails the whole unattended
 * cron run instead of just waiting a bit and succeeding.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 4, initialDelayMs = 5_000, factor = 3 } = options;

  let delay = initialDelayMs;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryable(err) || attempt === maxAttempts) throw err;
      console.warn(
        `Gemini call failed with a retryable error (attempt ${attempt}/${maxAttempts}), retrying in ${delay / 1000}s...`
      );
      await sleep(delay);
      delay *= factor;
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
