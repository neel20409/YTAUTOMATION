import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CharacterConfig } from "./shortsConfig.js";
import type { MouthWindow } from "./audioAmplitude.js";

const run = promisify(execFile);

function buildEnableExpr(windows: MouthWindow[]): string {
  const openWindows = windows.filter((w) => w.open);
  if (openWindows.length === 0) return "0";
  return openWindows.map((w) => `between(t,${w.start.toFixed(3)},${w.end.toFixed(3)})`).join("+");
}

/**
 * Renders one dialogue line's scene: a Ken Burns pan/zoom over the background image, with the
 * speaking character composited on top, its mouth cutting between the closed and open-mouth
 * images according to mouthWindows (see audioAmplitude.ts). A gentle vertical bob is added to
 * the character so it doesn't look totally static while "talking".
 */
export async function renderCharacterScene(
  backgroundImagePath: string,
  character: CharacterConfig,
  mouthWindows: MouthWindow[],
  durationSeconds: number,
  aspectRatio: "16:9" | "9:16",
  outPath: string
): Promise<string> {
  const [w, h] = aspectRatio === "16:9" ? [1280, 720] : [720, 1280];
  const fps = 30;
  const totalFrames = Math.max(1, Math.round(durationSeconds * fps));
  const charWidth = Math.round(w * 0.62);
  const charY = Math.round(h * 0.52);

  const enableExpr = buildEnableExpr(mouthWindows);

  const filterComplex = [
    `[0:v]scale=${w * 2}:${h * 2}:force_original_aspect_ratio=increase,crop=${w * 2}:${h * 2},` +
      `zoompan=z='min(zoom+0.0012,1.15)':d=${totalFrames}:s=${w}x${h}:fps=${fps}[bg]`,
    `[1:v]scale=${charWidth}:-1[char_closed]`,
    `[2:v]scale=${charWidth}:-1[char_open]`,
    `[bg][char_closed]overlay=x=(W-w)/2:y='${charY}+6*sin(2*PI*t*1.1)':eval=frame[tmp1]`,
    `[tmp1][char_open]overlay=x=(W-w)/2:y='${charY}+6*sin(2*PI*t*1.1)':eval=frame:enable='${enableExpr}'[out]`,
  ].join(";");

  await run("ffmpeg", [
    "-y",
    "-loop", "1", "-i", backgroundImagePath,
    "-loop", "1", "-i", character.closedMouthImage,
    "-loop", "1", "-i", character.openMouthImage,
    "-filter_complex", filterComplex,
    "-map", "[out]",
    "-t", durationSeconds.toFixed(2),
    "-pix_fmt", "yuv420p",
    outPath,
  ]);

  return outPath;
}
