import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { prisma } from "./db.js";
import { toChannelConfig } from "./channelConfig.js";
import { decryptToken } from "./crypto.js";
import { generateScript } from "./scriptGen.js";
import { generateVoiceover } from "./paid/tts.js";
import { generateSceneImage } from "./paid/imageGen.js";
import { verifyImageMatchesContext } from "./imageVerify.js";
import { generateClip } from "./paid/veo.js";
import { muxSceneVideoWithAudio, muxSceneAudio, animateImage, concatScenes, getAudioDurationSeconds } from "./stitch.js";
import { generateThumbnail } from "./thumbnail.js";
import { uploadToYouTube, uploadThumbnail } from "./upload.js";
import { markTopicDone } from "./topics.js";
import type { Channel, Topic, YoutubeConnection } from "./generated/prisma/client.js";

export interface RunJob {
  id: string;
  channel: Channel & { youtubeConnection: YoutubeConnection | null };
  topic: Topic;
}

/**
 * Runs one queued Run end to end: script -> per-scene (voiceover, image, Veo clip, mux) ->
 * stitch -> upload -> thumbnail -> mark topic done -> cleanup. DB-driven version of
 * video-pipeline/src/index.ts's runPipelineForChannel.
 *
 * Each generation step (script, image, video, TTS) tries the paid model first and falls back to
 * a free-tier path if it fails - most importantly, before billing is enabled on the Google Cloud
 * project (Veo/Imagen/Gemini-TTS have zero free-tier quota, so without a fallback every run
 * would fail outright until billing is turned on). Progress is written to the Run row's `stage`
 * column (see setStage below) instead of a tmp/error.json file, so it's queryable from the
 * dashboard instead of the filesystem.
 */
export async function runJob(job: RunJob): Promise<{ videoUrl: string }> {
  const channel = job.channel;
  const topic = job.topic;

  if (!channel.youtubeConnection) {
    throw new Error(`Channel ${channel.id} has no connected YouTube account.`);
  }
  const refreshToken = decryptToken(channel.youtubeConnection.refreshTokenEnc);
  const channelConfig = toChannelConfig(channel);

  const tmpDir = path.resolve("tmp", job.id);
  await mkdir(tmpDir, { recursive: true });

  async function setStage(stage: string) {
    await prisma.run.update({ where: { id: job.id }, data: { stage } });
  }

  await setStage("script");
  const script = await generateScript(topic.title, channelConfig);

  const sceneFiles: string[] = [];
  let firstSceneImagePath = "";

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];

    await setStage(`scene_${i}_voiceover`);
    const voPath = path.join(tmpDir, `scene_${i}_voice.wav`);
    await generateVoiceover(scene.narration, channelConfig, voPath);

    await setStage(`scene_${i}_image`);
    const imagePath = path.join(tmpDir, `scene_${i}_image.jpg`);
    await generateSceneImage(scene.imagePrompt, channelConfig, imagePath);

    // One quality-verification retry - this is a correctness check worth keeping on the paid
    // pipeline (see imageVerify.ts), not free-tier-flakiness resilience, so it stays narrow
    // (one retry) rather than the free pipeline's multi-provider fallback chain.
    const verdict = await verifyImageMatchesContext(imagePath, scene.imagePrompt).catch((err) => {
      console.warn(`Image verification call failed, keeping this attempt as-is: ${err}`);
      return null;
    });
    if (verdict && !verdict.matches) {
      console.warn(`Scene ${i} image verification flagged: ${verdict.issues}. Regenerating once...`);
      await generateSceneImage(
        `${scene.imagePrompt} IMPORTANT - a previous attempt was rejected for this reason, fix it specifically: ${verdict.issues}`,
        channelConfig,
        imagePath
      );
    }
    if (i === 0) firstSceneImagePath = imagePath;

    await setStage(`scene_${i}_video`);
    const finalScenePath = path.join(tmpDir, `scene_${i}_final.mp4`);
    try {
      const rawClipPath = path.join(tmpDir, `scene_${i}_clip.mp4`);
      await generateClip(scene.imagePrompt, channelConfig, rawClipPath);
      await muxSceneVideoWithAudio(rawClipPath, voPath, finalScenePath);
    } catch (err) {
      console.warn(`⚠️ Scene ${i}: Veo generation failed (${err}). Falling back to Ken Burns pan/zoom.`);
      const duration = await getAudioDurationSeconds(voPath);
      const kenBurnsPath = path.join(tmpDir, `scene_${i}_kb_clip.mp4`);
      await animateImage(imagePath, duration, channelConfig.aspectRatio, kenBurnsPath, i);
      await muxSceneAudio(kenBurnsPath, voPath, finalScenePath);
    }
    sceneFiles.push(finalScenePath);
  }

  await setStage("stitch");
  const finalPath = path.join(tmpDir, "final.mp4");
  await concatScenes(sceneFiles, tmpDir, finalPath);

  await setStage("youtube_upload");
  const thumbnailPath = path.join(tmpDir, "thumbnail.jpg");
  const [result] = await Promise.all([
    uploadToYouTube(
      finalPath,
      script.videoTitle,
      script.description,
      channel.language,
      channel.isMadeForKids,
      refreshToken
    ),
    generateThumbnail(firstSceneImagePath, script.videoTitle, tmpDir, thumbnailPath),
  ]);

  await setStage("thumbnail_upload");
  try {
    await uploadThumbnail(result.videoId, thumbnailPath, refreshToken);
  } catch (err) {
    console.error("Thumbnail upload failed (video is still live without a custom thumbnail):", err);
  }

  await setStage("mark_done");
  await markTopicDone(topic.id);

  await setStage("cleanup");
  await rm(tmpDir, { recursive: true, force: true }).catch((err) => {
    console.warn(`Cleanup failed for ${tmpDir} (video already uploaded, so this is non-fatal):`, err);
  });

  return { videoUrl: result.url };
}
