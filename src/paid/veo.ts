// PARKED - the paid upgrade path. Not imported anywhere right now because Veo has no
// free tier at all (confirmed: $0.10-0.40/sec, billing required for any call to succeed).
// The active free-tier pipeline uses ../imageGen.ts + stitch.ts's animateImage() instead.
//
// To switch back once billing is enabled: in src/index.ts, replace the
// generateSceneImage + animateImage calls with a single generateClip() call using this
// module, and swap channel.piperVoice back to channel.ttsVoice with ./tts.ts (this
// folder's sibling, also parked - see src/paid/tts.ts).

import { GoogleGenAI } from "@google/genai";
import { ENV, type ChannelConfig } from "../config.js";

const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });

/**
 * Generates one ~8-second video clip from a text prompt using Veo, entirely via API -
 * this is the step that replaces manually pasting prompts into Google Flow.
 * Polls the long-running operation until done, then downloads the resulting mp4.
 */
export async function generateClip(
  prompt: string,
  channel: ChannelConfig,
  outPath: string
): Promise<string> {
  let operation = await ai.models.generateVideos({
    model: channel.veoModel,
    prompt,
    config: {
      aspectRatio: channel.aspectRatio,
    },
  });

  while (!operation.done) {
    await sleep(10_000);
    operation = await ai.operations.getVideosOperation({ operation });
  }

  const generated = operation.response?.generatedVideos?.[0];
  if (!generated?.video) {
    throw new Error(`Veo generation failed or was blocked for prompt: "${prompt}"`);
  }

  // Download the generated video directly to disk.
  await ai.files.download({ file: generated.video, downloadPath: outPath });

  return outPath;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
