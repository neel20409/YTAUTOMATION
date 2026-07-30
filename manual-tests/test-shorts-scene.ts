// Throwaway validation: generates one background image (Pollinations, free), analyzes the
// existing test voiceover's amplitude, and composites Bloop (mouth-flap synced to volume)
// over the animated background. This is the core building block of the shorts pipeline.
//
// Run: npx tsx manual-tests/test-shorts-scene.ts
// Then play manual-tests/out/shorts-scene-test.mp4 - check the character bobs, the mouth
// flaps roughly in time with the (already-generated) test voiceover, and the background pans.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { CHANNELS } from "../src/config.js";
import { CHARACTERS, SHORTS_ASPECT_RATIO } from "../src/shorts/shortsConfig.js";
import { generateSceneImage } from "../src/imageGen.js";
import { computeMouthWindows } from "../src/shorts/audioAmplitude.js";
import { renderCharacterScene } from "../src/shorts/shortsStitch.js";
import { getAudioDurationSeconds, muxSceneAudio } from "../src/stitch.js";

async function main() {
  const outDir = path.resolve("manual-tests/out");
  await mkdir(outDir, { recursive: true });

  const voicePath = path.resolve("shorts/test_line.wav");
  const duration = await getAudioDurationSeconds(voicePath);
  console.log(`Voiceover duration: ${duration.toFixed(2)}s`);

  console.log("Analyzing mouth-flap windows from voiceover amplitude...");
  const mouthWindows = await computeMouthWindows(voicePath);
  console.log(`Computed ${mouthWindows.length} mouth windows`);

  const bgPath = path.join(outDir, "shorts-bg-test.jpg");
  console.log("Generating background image...");
  await generateSceneImage(
    "A sunny cartoon meadow with soft rolling hills and colorful flowers, storybook illustration style",
    CHANNELS.bloop_and_boo,
    bgPath
  );

  const silentClipPath = path.join(outDir, "shorts-scene-silent.mp4");
  console.log("Compositing character over animated background...");
  await renderCharacterScene(
    bgPath,
    CHARACTERS.bloop,
    mouthWindows,
    duration,
    SHORTS_ASPECT_RATIO,
    silentClipPath
  );

  const finalPath = path.join(outDir, "shorts-scene-test.mp4");
  console.log("Muxing voiceover onto scene...");
  await muxSceneAudio(silentClipPath, voicePath, finalPath);

  console.log(`Wrote ${finalPath} - play it and check the mouth-flap timing + pan/zoom.`);
}

main().catch((err) => {
  console.error("test-shorts-scene failed:", err);
  process.exit(1);
});
