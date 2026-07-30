// Throwaway Phase 1 check: confirms muxSceneAudio() and concatScenes() work
// correctly, using synthetic ffmpeg test sources instead of real Veo/TTS output
// so this costs nothing. Generates 2 dummy "scenes" (color bars + tone, and a
// different color + tone, each with a spoken-length silence track standing in
// for a voiceover) and stitches them exactly like index.ts does.
//
// Requires ffmpeg on PATH.
// Run: npx tsx manual-tests/test-stitch.ts
// Then play manual-tests/out/test-final.mp4 and check: audio/video sync per
// scene, no drift, no truncation, clean cut between scenes.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { muxSceneAudio, concatScenes } from "../src/stitch.js";

const run = promisify(execFile);

async function makeDummyClip(outPath: string, color: string, seconds: number) {
  await run("ffmpeg", [
    "-y",
    "-f", "lavfi", "-i", `color=c=${color}:s=1280x720:d=${seconds}`,
    "-f", "lavfi", "-i", `sine=frequency=440:duration=${seconds}`,
    "-c:v", "libx264", "-c:a", "aac", "-shortest",
    outPath,
  ]);
}

async function makeDummyVoiceover(outPath: string, seconds: number) {
  await run("ffmpeg", [
    "-y",
    "-f", "lavfi", "-i", `sine=frequency=220:duration=${seconds}`,
    outPath,
  ]);
}

async function main() {
  const outDir = path.resolve("manual-tests/out");
  await mkdir(outDir, { recursive: true });

  const clip0 = path.join(outDir, "dummy_clip_0.mp4");
  const clip1 = path.join(outDir, "dummy_clip_1.mp4");
  const voice0 = path.join(outDir, "dummy_voice_0.wav");
  const voice1 = path.join(outDir, "dummy_voice_1.wav");

  console.log("Generating synthetic test clips + voiceovers...");
  await makeDummyClip(clip0, "red", 4);
  await makeDummyClip(clip1, "blue", 3);
  await makeDummyVoiceover(voice0, 4);
  await makeDummyVoiceover(voice1, 3);

  console.log("Muxing scene 0...");
  const final0 = path.join(outDir, "dummy_scene_0_final.mp4");
  await muxSceneAudio(clip0, voice0, final0);

  console.log("Muxing scene 1...");
  const final1 = path.join(outDir, "dummy_scene_1_final.mp4");
  await muxSceneAudio(clip1, voice1, final1);

  console.log("Concatenating scenes...");
  const finalPath = path.join(outDir, "test-final.mp4");
  await concatScenes([final0, final1], outDir, finalPath);

  console.log(`Wrote stitched test video to ${finalPath}`);
}

main().catch((err) => {
  console.error("test-stitch failed:", err);
  process.exit(1);
});
