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
