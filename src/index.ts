import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { CHANNELS, ENV, getChannelConfig, type ChannelId } from "./config.js";
import { getNextTopic, markTopicDone } from "./topicQueue.js";
import { generateScript } from "./scriptGen.js";
import { generateVoiceover } from "./tts.js";
import { generateVerifiedSceneImage } from "./imageGen.js";
import { muxSceneAudio, muxSceneVideoWithAudio, concatScenes, animateImage, getAudioDurationSeconds } from "./stitch.js";
import { uploadToYouTube, uploadThumbnail } from "./upload.js";
import { generateThumbnail } from "./thumbnail.js";
import { generateSceneVideo } from "./videoGen.js";

async function runPipelineForChannel(channelId: ChannelId) {
  const channel = getChannelConfig(channelId);
  if (!channel) {
    throw new Error(`Unknown channel ID '${channelId}'. Valid options: ${Object.keys(CHANNELS).join(", ")}`);
  }
  console.log(`\n==================================================`);
  console.log(`=== Daily pipeline: ${channel.displayName} (${channel.id}) [Format: ${channel.aspectRatio}, Scenes: ${channel.sceneCount}] ===`);
  console.log(`==================================================`);

  const topic = getNextTopic(channel.id);
  console.log(`Topic: ${topic.title}`);

  const tmpDir = path.resolve("tmp", `${channel.id}-${topic.id}`);
  await mkdir(tmpDir, { recursive: true });

  // 1. Script
  console.log("Generating script...");
  const script = await generateScript(topic.title, channel);

  // 2. Per-scene voiceover + video generation (AI I2V or Ken Burns fallback), then mux together
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

    const finalScenePath = path.join(tmpDir, `scene_${i}_final.mp4`);

    // Try free AI Image-to-Video generation first; fall back to FFmpeg Ken Burns if it fails or times out
    try {
      console.log(`Scene ${i + 1}/${script.scenes.length}: generating AI video clip...`);
      const rawAiVideoClipPath = path.join(tmpDir, `scene_${i}_ai_clip.mp4`);
      await generateSceneVideo(imagePath, rawAiVideoClipPath, scene.imagePrompt, channel.aspectRatio);
      await muxSceneVideoWithAudio(rawAiVideoClipPath, voPath, finalScenePath);
    } catch (i2vErr) {
      console.warn(`⚠️ Scene ${i + 1}: AI Image-to-Video generation failed/timed out. Using FFmpeg Ken Burns fallback.`);
      console.log(`Scene ${i + 1}/${script.scenes.length}: animating image (Ken Burns fallback)...`);
      const kenBurnsClipPath = path.join(tmpDir, `scene_${i}_kb_clip.mp4`);
      await animateImage(imagePath, duration, channel.aspectRatio, kenBurnsClipPath, i);

      console.log(`Scene ${i + 1}/${script.scenes.length}: muxing audio + video...`);
      await muxSceneAudio(kenBurnsClipPath, voPath, finalScenePath);
    }

    sceneFiles.push(finalScenePath);
  }

  // 3. Stitch all scenes into the final video
  console.log("Stitching final video...");
  const finalPath = path.join(tmpDir, "final.mp4");
  await concatScenes(sceneFiles, tmpDir, finalPath);

  // 4. Upload to YouTube, building the thumbnail image concurrently since it only depends on
  // data already in hand (first scene image + title) rather than on the upload having finished.
  console.log("Uploading to YouTube (thumbnail rendering in parallel)...");
  const thumbnailPath = path.join(tmpDir, "thumbnail.jpg");
  const [result] = await Promise.all([
    uploadToYouTube(finalPath, script.videoTitle, script.description, channel),
    generateThumbnail(sceneImagePaths[0], script.videoTitle, tmpDir, thumbnailPath),
  ]);
  console.log(`Uploaded: ${result.url}`);

  // 4b. Set the (already-rendered) custom thumbnail now that the video has an id.
  try {
    await uploadThumbnail(result.videoId, thumbnailPath, channel);
    console.log("Thumbnail set.");
  } catch (err) {
    console.error("Thumbnail upload failed (video is still live without a custom thumbnail):", err);
  }

  // 5. Mark topic done and clean up
  markTopicDone(channel.id, topic.id);
  await rm(tmpDir, { recursive: true, force: true });

  console.log(`=== Pipeline complete for ${channel.displayName} ===\n`);
}

async function main() {
  const runAll = process.argv.includes("--all") || process.env.CHANNEL?.toLowerCase() === "all";

  if (runAll) {
    const channelIds = Object.keys(CHANNELS) as ChannelId[];
    console.log(`\n🚀 Starting batch pipeline for ALL ${channelIds.length} channels: ${channelIds.join(", ")}`);

    const results: { channelId: ChannelId; success: boolean; error?: unknown }[] = [];

    for (const channelId of channelIds) {
      try {
        await runPipelineForChannel(channelId);
        results.push({ channelId, success: true });
      } catch (err) {
        console.error(`❌ Failed pipeline for channel '${channelId}':`, err);
        results.push({ channelId, success: false, error: err });
      }
    }

    console.log("\n==================================================");
    console.log("=== BATCH PIPELINE SUMMARY ===");
    console.log("==================================================");
    let failures = 0;
    for (const r of results) {
      const channel = CHANNELS[r.channelId];
      if (r.success) {
        console.log(`✅ ${channel.displayName} (${r.channelId}): SUCCESS`);
      } else {
        failures++;
        console.log(`❌ ${channel.displayName} (${r.channelId}): FAILED - ${r.error instanceof Error ? r.error.message : r.error}`);
      }
    }

    if (failures > 0) {
      process.exit(1);
    }
  } else {
    await runPipelineForChannel(ENV.CHANNEL);
  }
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
