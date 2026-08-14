import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import type { ChannelConfig } from "../channelConfig.js";
import { getGeminiApiKey } from "../retry.js";

// NEW - the one gap in video-pipeline/src/paid/: veo.ts and tts.ts were parked for the paid
// switch, but no paid image module existed (the free-tier pipeline's imageGen.ts used
// Pollinations/Hugging Face). Uses Google's Imagen via the same @google/genai SDK already used
// by paid/veo.ts and paid/tts.ts, so there's one Google Cloud key for the whole pipeline.
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "imagen-4.0-generate-001";

export async function generateSceneImage(
  prompt: string,
  channel: ChannelConfig,
  outPath: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });

  const fullPrompt = channel.imageAccuracyAnchor ? `${prompt} ${channel.imageAccuracyAnchor}` : prompt;

  const response = await ai.models.generateImages({
    model: IMAGE_MODEL,
    prompt: fullPrompt,
    config: {
      numberOfImages: 1,
      aspectRatio: channel.aspectRatio,
    },
  });

  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
  if (!imageBytes) {
    throw new Error(`Imagen returned no image for prompt: "${prompt}"`);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(imageBytes, "base64"));
  return outPath;
}
