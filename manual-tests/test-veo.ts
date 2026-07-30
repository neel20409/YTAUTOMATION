// Throwaway Phase 1 check: confirms generateClip() downloads a playable .mp4.
// Uses bloop_and_boo's "fast" Veo model and a short, safe, cheap test prompt to
// minimize cost - this still takes 1-3 minutes and costs money.
//
// Run: npx tsx manual-tests/test-veo.ts
// Then play manual-tests/out/test-clip.mp4.
//
// Also worth trying once with a deliberately borderline prompt (e.g. mentioning
// "battle") to confirm generateClip's error actually includes the offending
// prompt text, per the plan's Phase 1 checklist - don't just assume it does.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { CHANNELS } from "../src/config.js";
import { generateClip } from "../src/veo.js";

async function main() {
  const channel = CHANNELS.bloop_and_boo;
  const outDir = path.resolve("manual-tests/out");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "test-clip.mp4");

  await generateClip(
    "A cheerful cartoon rabbit waving in a sunny meadow, wide shot, bright colors",
    channel,
    outPath
  );

  console.log(`Wrote clip to ${outPath} - play it and confirm it looks right.`);
}

main().catch((err) => {
  console.error("test-veo failed:", err);
  process.exit(1);
});
