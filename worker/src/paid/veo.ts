import { GoogleGenAI } from "@google/genai";
import type { ChannelConfig } from "../channelConfig.js";
import { getGeminiApiKey } from "../retry.js";

// Ported from video-pipeline/src/paid/veo.ts, which was parked specifically for this switch -
// this replaces the free-tier pipeline's imageGen.ts-still-image + stitch.ts Ken Burns pan/zoom
// approximation with a real generated video clip.
export async function generateClip(
  prompt: string,
  channel: ChannelConfig,
  outPath: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });

  let operation = await ai.models.generateVideos({
    model: channel.veoModel,
    prompt,
    config: { aspectRatio: channel.aspectRatio },
  });

  while (!operation.done) {
    await sleep(10_000);
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const generated = operation.response?.generatedVideos?.[0];
  if (!generated?.video) {
    throw new Error(`Veo generation failed or was blocked for prompt: "${prompt}"`);
  }

  await ai.files.download({ file: generated.video, downloadPath: outPath });
  return outPath;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
