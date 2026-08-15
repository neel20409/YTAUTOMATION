import { GoogleGenAI } from "@google/genai";
import type { ChannelConfig } from "./channelConfig.js";
import { withRetry, getGeminiApiKey } from "./retry.js";

export interface Scene {
  narration: string;
  imagePrompt: string;
}

export interface GeneratedScript {
  videoTitle: string;
  description: string;
  scenes: Scene[];
}

function getAiClient() {
  return new GoogleGenAI({ apiKey: getGeminiApiKey() });
}

// Tries the pro model first (better writing quality), falls back to flash if pro fails - which
// includes the case where billing isn't enabled on the Google Cloud project yet: pro-tier models
// have a hard 0 free-tier quota, while flash models have real free-tier access. Both are stable
// aliases Google keeps pointed at their current recommended model, not dated/preview names that
// 404 once deprecated (which is what happened to the "gemini-3-pro-preview" this used to
// hardcode).
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-pro-latest";
const GEMINI_MODEL_FALLBACK = process.env.GEMINI_MODEL_FALLBACK ?? "gemini-flash-latest";

/**
 * Generates a scene-by-scene script for one video. Ported from video-pipeline/src/scriptGen.ts,
 * minus that version's Hugging Face free-tier fallback - on the paid pipeline a script-gen
 * failure should surface as a failed Run rather than silently degrading to a much weaker model.
 */
export async function generateScript(
  topicTitle: string,
  channel: ChannelConfig
): Promise<GeneratedScript> {
  const systemInstruction = `You are a scriptwriter and visual director for the YouTube channel "${channel.displayName}".
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
- Each "narration" is 2-4 sentences of spoken voiceover text in ${channel.language}. Make it vivid
  and engaging, not a dry textbook recitation - use sensory, concrete detail and a sense of story.
- Each "imagePrompt" is a detailed, richly specific visual description in English for a single
  still image illustrating that scene. Every imagePrompt MUST include:
    1. A specific camera framing. If this scene's narration centers on a named person's
       thoughts, feelings, decision, or dialogue, the framing MUST clearly show their face -
       use "medium shot", "three-quarter shot", or "close-up" (never "wide shot", "aerial
       view", "over-the-shoulder shot", or any framing where the face would be small, distant,
       in shadow, or turned away from camera). Reserve wide/aerial framings for scenes that are
       genuinely about a landscape, army, or setting rather than an individual's character
       moment. Still vary the framing across scenes rather than repeating the same one twice in
       a row, but never at the cost of hiding a main character's face in a scene about them.
    2. Concrete, specific visual subject matter drawn directly from the narration for that scene
       (specific people, objects, setting details - not generic filler like "a person standing").
       Name the actual person/place from the topic explicitly so the image generator isn't left
       to guess who or what this is. When the face is meant to be visible, describe their facial
       expression concretely so the generator actually renders a clear, forward-facing face.
    3. Lighting and mood (e.g. "harsh midday sun", "flickering torchlight", "misty dawn light").
    4. Texture and material detail (e.g. weathered stone, woven fabric, dust in the air) to make
       the scene feel tangible and specific rather than generic.
  Image style direction for every imagePrompt: ${channel.imageStyle}
  IMPORTANT - avoiding wrong iconography: image generators sometimes default to whichever
  iconography is most common in their training data when the real subject is less globally
  famous. To prevent this, every imagePrompt describing a person or setting from the topic must
  explicitly state their actual ethnicity/region and era-appropriate attire in concrete terms.
- In imagePrompt text, NEVER use the words "battle", "war", "army attacking", "fight", or name specific
  active religious worship sites. Describe conflict scenes instead as "tense standoff" or "warriors
  standing in formation" and describe temples generically as "an ancient stone temple" rather than
  naming a specific still-active site.
- Keep narration historically and factually accurate for the real people, places, and events involved
  - do not invent events that didn't happen. Vivid and engaging is not the same as fictionalized.
${channel.imageAccuracyAnchor}`;

  const prompt = `Write the script for a video titled: "${topicTitle}"`;

  let response;
  try {
    response = await withRetry(() =>
      getAiClient().models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: { systemInstruction, responseMimeType: "application/json" },
      })
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ [ScriptGen] ${GEMINI_MODEL} failed (${message}). Falling back to ${GEMINI_MODEL_FALLBACK}...`);
    response = await withRetry(() =>
      getAiClient().models.generateContent({
        model: GEMINI_MODEL_FALLBACK,
        contents: prompt,
        config: { systemInstruction, responseMimeType: "application/json" },
      })
    );
  }

  const text = response.text;
  if (!text) throw new Error("Script generation returned empty response");

  return JSON.parse(text) as GeneratedScript;
}
