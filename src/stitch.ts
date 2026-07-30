import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const run = promisify(execFile);

/**
 * Reads a voiceover's duration so animateImage() can generate a clip that matches it.
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
 * Free-tier stand-in for a real Veo clip: turns one still image (from imageGen.ts) into a
 * silent video of the given duration with a slow pan/zoom ("Ken Burns effect") so the final
 * video still reads as a moving shot. Scales up first so the zoom has headroom without
 * visible upscaling artifacts, and crops to an exact size since generated images don't
 * always come back at precisely the requested dimensions.
 */
export async function animateImage(
  imagePath: string,
  durationSeconds: number,
  aspectRatio: "16:9" | "9:16",
  outPath: string
): Promise<string> {
  const [w, h] = aspectRatio === "16:9" ? [1280, 720] : [720, 1280];
  const fps = 30;
  const totalFrames = Math.max(1, Math.round(durationSeconds * fps));

  await run("ffmpeg", [
    "-y",
    "-loop", "1",
    "-i", imagePath,
    "-vf",
    `scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase,crop=${w * 2}:${h * 2},` +
      `zoompan=z='min(zoom+0.0015,1.2)':d=${totalFrames}:s=${w}x${h}:fps=${fps}`,
    "-t", durationSeconds.toFixed(2),
    "-pix_fmt", "yuv420p",
    outPath,
  ]);

  return outPath;
}

/**
 * Mutes a scene's native Veo audio and overlays the generated voiceover instead,
 * padding/trimming the audio to the clip's length so scenes don't cut off mid-sentence.
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
