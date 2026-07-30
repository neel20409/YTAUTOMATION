import { writeFile } from "node:fs/promises";
import type { ChannelConfig } from "./config.js";

/**
 * Generates one still image per scene via Pollinations.ai - free, keyless, no billing.
 * This is the free-tier stand-in for Veo's per-scene video clip (see src/paid/veo.ts):
 * stitch.ts's animateImage() adds a pan/zoom effect so it still reads as a moving shot
 * once assembled, just without real AI-generated motion.
 */
export async function generateSceneImage(
  prompt: string,
  channel: ChannelConfig,
  outPath: string
): Promise<string> {
  const [width, height] = channel.aspectRatio === "16:9" ? [1280, 720] : [720, 1280];
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Image generation failed (${response.status}) for prompt: "${prompt}"`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outPath, buffer);
  return outPath;
}
