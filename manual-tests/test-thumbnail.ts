// Throwaway check: confirms generateThumbnail() overlays bold title text correctly on a
// 16:9 crop of a scene image. No API calls, no cost - pure ffmpeg + bundled font.
//
// Run: npx tsx manual-tests/test-thumbnail.ts
// Then look at manual-tests/out/test-thumbnail.jpg.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { generateThumbnail } from "../src/thumbnail.js";

async function main() {
  const outDir = path.resolve("manual-tests/out");
  await mkdir(outDir, { recursive: true });

  const sourceImage = path.resolve("manual-tests/out/test-scene.jpg");
  const outPath = path.join(outDir, "test-thumbnail.jpg");

  await generateThumbnail(
    sourceImage,
    "The Rise of Chandragupta Maurya",
    outDir,
    outPath
  );

  console.log(`Wrote thumbnail to ${outPath}`);
}

main().catch((err) => {
  console.error("test-thumbnail failed:", err);
  process.exit(1);
});
