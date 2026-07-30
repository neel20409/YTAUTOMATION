import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { CHANNELS, ENV } from "./config.js";
import { getNextTopic, markTopicDone } from "./topicQueue.js";
import { generateScript } from "./scriptGen.js";
import { generateVoiceover } from "./tts.js";
import { generateClip } from "./veo.js";
import { muxSceneAudio, concatScenes } from "./stitch.js";
import { uploadToYouTube } from "./upload.js";

async function main() {
  const channel = CHANNELS[ENV.CHANNEL];
  console.log(`\n=== Daily pipeline: ${channel.displayName} ===`);

  const topic = getNextTopic(channel.id);
  console.log(`Topic: ${topic.title}`);

  const tmpDir = path.resolve("tmp", `${channel.id}-${topic.id}`);
  await mkdir(tmpDir, { recursive: true });

  // 1. Script
  console.log("Generating script...");
  const script = await generateScript(topic.title, channel);

  // 2. Per-scene voiceover + Veo clip, then mux together
  const sceneFiles: string[] = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    console.log(`Scene ${i + 1}/${script.scenes.length}: generating voiceover...`);
    const voPath = path.join(tmpDir, `scene_${i}_voice.wav`);
    await generateVoiceover(scene.narration, channel, voPath);

    console.log(`Scene ${i + 1}/${script.scenes.length}: generating Veo clip...`);
    const clipPath = path.join(tmpDir, `scene_${i}_clip.mp4`);
    await generateClip(scene.veoPrompt, channel, clipPath);

    console.log(`Scene ${i + 1}/${script.scenes.length}: muxing audio + video...`);
    const finalScenePath = path.join(tmpDir, `scene_${i}_final.mp4`);
    await muxSceneAudio(clipPath, voPath, finalScenePath);
    sceneFiles.push(finalScenePath);
  }

  // 3. Stitch all scenes into the final video
  console.log("Stitching final video...");
  const finalPath = path.join(tmpDir, "final.mp4");
  await concatScenes(sceneFiles, tmpDir, finalPath);

  // 4. Upload to YouTube
  console.log("Uploading to YouTube...");
  const result = await uploadToYouTube(finalPath, script.videoTitle, script.description, channel);
  console.log(`Uploaded: ${result.url}`);

  // 5. Mark topic done and clean up
  markTopicDone(channel.id, topic.id);
  await rm(tmpDir, { recursive: true, force: true });

  console.log("=== Pipeline complete ===\n");
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
