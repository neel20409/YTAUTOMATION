import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const execFileAsync = promisify(execFile);
const run = (file: string, args: string[]) =>
  execFileAsync(file, args, { maxBuffer: 50 * 1024 * 1024 });

/**
 * Reads a voiceover's duration - ported unchanged from video-pipeline/src/stitch.ts. ffmpeg
 * mux/concat is provider-agnostic, so none of this needed to change for the paid pipeline.
 */
export async function getAudioDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const seconds = parseFloat(stdout.trim());
  if (Number.isNaN(seconds)) {
    throw new Error(`Could not read audio duration for ${filePath}`);
  }
  return seconds;
}

/**
 * Overlays the generated voiceover onto a (silent) scene clip, padding/trimming the audio
 * to the clip's length so scenes don't cut off mid-sentence.
 */
export async function muxSceneAudio(
  clipPath: string,
  voiceoverPath: string,
  outPath: string
): Promise<string> {
  await run("ffmpeg", [
    "-y",
    "-i", clipPath,
    "-i", voiceoverPath,
    "-filter_complex", "[1:a]apad[aud]",
    "-map", "0:v:0",
    "-map", "[aud]",
    "-c:v", "copy",
    "-c:a", "aac",
    "-shortest",
    outPath,
  ]);
  return outPath;
}

/**
 * Concatenates all scene files (in order) into one final video.
 */
export async function concatScenes(
  sceneFilePaths: string[],
  tmpDir: string,
  outPath: string
): Promise<string> {
  const listFile = path.join(tmpDir, "concat_list.txt");
  const listContent = sceneFilePaths.map((p) => `file '${path.resolve(p)}'`).join("\n");
  await writeFile(listFile, listContent);

  await run("ffmpeg", [
    "-y",
    "-f", "concat",
    "-safe", "0",
    "-i", listFile,
    "-c", "copy",
    outPath,
  ]);

  return outPath;
}

/**
 * Distinct Ken Burns motion presets, expressed in terms of zoompan's `on` (current output
 * frame). Cycled per scene so a whole video isn't just the same zoom-in repeated. Ported
 * unchanged from video-pipeline/src/stitch.ts.
 */
const MOTION_PRESETS: Array<{ z: string; x: string; y: string }> = [
  { z: "1.0+0.22*(on/{D})", x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" }, // zoom in, centered
  { z: "1.22-0.22*(on/{D})", x: "iw/2-(iw/zoom/2)", y: "ih/2-(ih/zoom/2)" }, // zoom out, centered
  { z: "1.15", x: "(iw-iw/zoom)*(on/{D})", y: "ih/2-(ih/zoom/2)" }, // pan left -> right
  { z: "1.15", x: "(iw-iw/zoom)*(1-on/{D})", y: "ih/2-(ih/zoom/2)" }, // pan right -> left
  { z: "1.15", x: "iw/2-(iw/zoom/2)", y: "(ih-ih/zoom)*(on/{D})" }, // pan top -> bottom
];

/**
 * Fallback for when the paid Veo call fails: turns one still image into a silent video of the
 * given duration with a pan/zoom ("Ken Burns effect"). Ported unchanged from
 * video-pipeline/src/stitch.ts.
 */
export async function animateImage(
  imagePath: string,
  durationSeconds: number,
  aspectRatio: "16:9" | "9:16",
  outPath: string,
  sceneIndex = 0
): Promise<string> {
  const [w, h] = aspectRatio === "16:9" ? [1280, 720] : [720, 1280];
  const fps = 30;
  const totalFrames = Math.max(1, Math.round(durationSeconds * fps));
  const preset = MOTION_PRESETS[((sceneIndex % MOTION_PRESETS.length) + MOTION_PRESETS.length) % MOTION_PRESETS.length];
  const substituteFrameCount = (expr: string) => expr.replaceAll("{D}", String(totalFrames));
  const z = substituteFrameCount(preset.z);
  const x = substituteFrameCount(preset.x);
  const y = substituteFrameCount(preset.y);

  await run("ffmpeg", [
    "-y",
    "-loop", "1",
    "-i", imagePath,
    "-vf",
    `scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase,crop=${w * 2}:${h * 2},` +
      `zoompan=z='${z}':x='${x}':y='${y}':d=${totalFrames}:s=${w}x${h}:fps=${fps}`,
    "-t", durationSeconds.toFixed(2),
    "-pix_fmt", "yuv420p",
    outPath,
  ]);

  return outPath;
}

/**
 * Combines a generated video clip (Veo) with TTS audio.
 * - Automatically loops (-stream_loop -1) the video if narration is longer than the clip.
 * - Trims output (-shortest) exactly when the voiceover finishes.
 */
export async function muxSceneVideoWithAudio(
  videoClipPath: string,
  audioPath: string,
  outputScenePath: string
): Promise<string> {
  await run("ffmpeg", [
    "-y",
    "-stream_loop", "-1",
    "-i", videoClipPath,
    "-i", audioPath,
    "-c:v", "libx264",
    "-c:a", "aac",
    "-shortest",
    "-fflags", "+shortest",
    "-max_interleave_delta", "100M",
    outputScenePath,
  ]);
  return outputScenePath;
}
