import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const run = promisify(execFile);

const FONT_PATH = path.resolve("assets/fonts/Anton-Regular.ttf");

function escapeFilterPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:");
}

function wrapTitle(text: string, maxLines = 3): string[] {
  const words = text.split(/\s+/);
  const targetLines = text.length <= 20 ? 1 : text.length <= 42 ? 2 : maxLines;
  const targetLineLength = Math.ceil(text.length / targetLines);

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > targetLineLength && lines.length < targetLines - 1) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

/**
 * Builds a 16:9 YouTube thumbnail from one scene image - ported unchanged from
 * video-pipeline/src/thumbnail.ts.
 */
export async function generateThumbnail(
  sourceImagePath: string,
  titleText: string,
  tmpDir: string,
  outPath: string
): Promise<string> {
  const W = 1280;
  const H = 720;
  const lines = wrapTitle(titleText.toUpperCase());
  const fontSize = lines.length === 1 ? 130 : lines.length === 2 ? 100 : 82;

  const textFilePath = path.join(tmpDir, "thumbnail_text.txt");
  await writeFile(textFilePath, lines.join("\n"), "utf-8");

  const vf = [
    `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase`,
    `crop=${W * 2}:${H * 2}`,
    `scale=${W}:${H}`,
    `drawtext=fontfile='${escapeFilterPath(FONT_PATH)}':textfile='${escapeFilterPath(textFilePath)}':` +
      `fontsize=${fontSize}:fontcolor=white:line_spacing=14:` +
      `box=1:boxcolor=black@0.55:boxborderw=24:x=(w-text_w)/2:y=h-text_h-70`,
  ].join(",");

  await run("ffmpeg", ["-y", "-i", sourceImagePath, "-vf", vf, "-frames:v", "1", outPath]);
  return outPath;
}
