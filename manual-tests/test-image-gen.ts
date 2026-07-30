// Throwaway Phase 1 check: confirms generateSceneImage() (Pollinations.ai, free/keyless)
// and animateImage() (ffmpeg pan/zoom) work together to produce a moving clip from a
// still image. This is the free-tier stand-in for the old Veo clip test - no cost, no
// billing required. Requires ffmpeg on PATH.
//
// Run: npx tsx manual-tests/test-image-gen.ts
// Then play manual-tests/out/test-scene.mp4 and confirm the pan/zoom looks reasonable.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { CHANNELS } from "../src/config.js";
import { generateSceneImage } from "../src/imageGen.js";
import { animateImage } from "../src/stitch.js";

async function main() {
  const channel = CHANNELS.bloop_and_boo;
  const outDir = path.resolve("manual-tests/out");
  await mkdir(outDir, { recursive: true });

  const imagePath = path.join(outDir, "test-scene.jpg");
  console.log("Generating scene image...");
  await generateSceneImage(
    "A cheerful cartoon rabbit waving in a sunny meadow, wide shot, bright colors",
    channel,
    imagePath
  );
  console.log(`Wrote image to ${imagePath}`);

  const clipPath = path.join(outDir, "test-scene.mp4");
  console.log("Animating image (pan/zoom)...");
  await animateImage(imagePath, 5, channel.aspectRatio, clipPath);

  console.log(`Wrote animated clip to ${clipPath} - play it and confirm it looks right.`);
}

main().catch((err) => {
  console.error("test-image-gen failed:", err);
  process.exit(1);
});
