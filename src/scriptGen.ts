import { GoogleGenAI } from "@google/genai";
import { ENV, type ChannelConfig } from "./config.js";

export interface Scene {
  narration: string; // what the voiceover says for this scene
  imagePrompt: string; // visual prompt sent to the free-tier image generator for this scene
}

export interface GeneratedScript {
  videoTitle: string;
  description: string;
  scenes: Scene[];
}

const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });

/**
 * Generates a scene-by-scene script for one video.
 * Returns strict JSON so it can be fed directly into TTS + image generation without manual editing.
 *
 * Uses a free-tier Gemini model (gemini-2.5-pro requires billing - see manual-tests errors from
 * before this was swapped). Once billing is enabled, swap the model string back if you want the
 * higher-quality pro model for scripts specifically.
 *
 * NOTE ON PROMPT SAFETY: kept the same conservative wording rules that were tuned for Veo's
 * safety filters (avoid "battle", "army attacking", naming active religious sites) - these are
 * good general-purpose prompt hygiene for the free-tier image generator too.
 */
export async function generateScript(
  topicTitle: string,
  channel: ChannelConfig
): Promise<GeneratedScript> {
  const systemInstruction = `You are a scriptwriter for the YouTube channel "${channel.displayName}".
Write in ${channel.language}. Output ONLY valid JSON, no markdown fences, no commentary.

JSON shape:
{
  "videoTitle": string,
  "description": string (YouTube description, 2-3 sentences, include 3 relevant hashtags),
  "scenes": [
    { "narration": string, "imagePrompt": string }
  ]
}

Rules:
- Produce exactly ${channel.sceneCount} scenes.
- Each "narration" is 2-4 sentences of spoken voiceover text in ${channel.language}.
- Each "imagePrompt" is a cinematic, visual-only description in English for a single still image
  illustrating that scene (camera angle, setting, lighting, composition).
- In imagePrompt text, NEVER use the words "battle", "war", "army attacking", "fight", or name specific
  active religious worship sites. Describe conflict scenes instead as "tense standoff" or "warriors
  standing in formation" and describe temples generically as "an ancient stone temple" rather than
  naming a specific still-active site.
- Keep narration historically accurate and engaging, avoid dry textbook tone.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Write the script for a video titled: "${topicTitle}"`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) throw new Error("Script generation returned empty response");

  return JSON.parse(text) as GeneratedScript;
}
