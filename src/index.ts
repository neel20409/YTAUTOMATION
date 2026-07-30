import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { CHANNELS, ENV } from "./config.js";
import { getNextTopic, markTopicDone } from "./topicQueue.js";
import { generateScript } from "./scriptGen.js";
import { generateVoiceover } from "./tts.js";
import { generateVerifiedSceneImage } from "./imageGen.js";
import { muxSceneAudio, concatScenes, animateImage, getAudioDurationSeconds } from "./stitch.js";
import { uploadToYouTube, uploadThumbnail } from "./upload.js";
import { generateThumbnail } from "./thumbnail.js";

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

  // 2. Per-scene voiceover + still image (animated with a pan/zoom), then mux together
  const sceneFiles: string[] = [];
  const sceneImagePaths: string[] = [];
  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    console.log(`Scene ${i + 1}/${script.scenes.length}: generating voiceover...`);
    const voPath = path.join(tmpDir, `scene_${i}_voice.wav`);
    await generateVoiceover(scene.narration, channel, voPath);
    const duration = await getAudioDurationSeconds(voPath);

    console.log(`Scene ${i + 1}/${script.scenes.length}: generating scene image...`);
    const imagePath = path.join(tmpDir, `scene_${i}_image.jpg`);
    await generateVerifiedSceneImage(scene.imagePrompt, channel, imagePath);
    sceneImagePaths.push(imagePath);

    console.log(`Scene ${i + 1}/${script.scenes.length}: animating image...`);
    const clipPath = path.join(tmpDir, `scene_${i}_clip.mp4`);
    await animateImage(imagePath, duration, channel.aspectRatio, clipPath, i);

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

  // 4b. Build and set a custom thumbnail from the first scene's image
  console.log("Generating thumbnail...");
  const thumbnailPath = path.join(tmpDir, "thumbnail.jpg");
  await generateThumbnail(sceneImagePaths[0], script.videoTitle, tmpDir, thumbnailPath);
  try {
    await uploadThumbnail(result.videoId, thumbnailPath, channel);
    console.log("Thumbnail set.");
  } catch (err) {
    console.error("Thumbnail upload failed (video is still live without a custom thumbnail):", err);
  }

  // 5. Mark topic done and clean up
  markTopicDone(channel.id, topic.id);
  await rm(tmpDir, { recursive: true, force: true });

  console.log("=== Pipeline complete ===\n");
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
