import { GoogleGenAI } from "@google/genai";
import { ENV, type ChannelConfig } from "./config.js";
import { withRetry, getActiveGeminiApiKey } from "./retry.js";

export interface Scene {
  narration: string; // what the voiceover says for this scene
  imagePrompt: string; // visual prompt sent to the free-tier image generator for this scene
}

export interface GeneratedScript {
  videoTitle: string;
  description: string;
  scenes: Scene[];
}

function getAiClient() {
  return new GoogleGenAI({ apiKey: getActiveGeminiApiKey() });
}

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
       Name the actual person/place from the topic explicitly (e.g. "Chandragupta Maurya" rather
       than "the young king") so the image generator isn't left to guess who or what this is.
       When the face is meant to be visible (see framing rule above), describe their facial
       expression concretely (e.g. "a determined, unblinking gaze", "a faint, confident smile")
       so the image generator actually renders a clear, forward-facing face rather than an
       incidental one.
    3. Lighting and mood (e.g. "harsh midday sun", "flickering torchlight", "misty dawn light").
    4. Texture and material detail (e.g. weathered stone, woven fabric, dust in the air) to make
       the scene feel tangible and specific rather than generic.
  Image style direction for every imagePrompt: ${channel.imageStyle}
  IMPORTANT - avoiding wrong iconography: free image generators sometimes default to whichever
  historical iconography is most common in their training data (e.g. rendering "an ancient ruler
  on a throne" as Genghis Khan or a generic Mongol/Chinese/European court) when the real subject
  is a less globally-famous figure. To prevent this, every imagePrompt describing a person or
  setting from the topic must explicitly state their actual ethnicity/region and era-appropriate
  attire in concrete terms (e.g. "an Indian Mauryan-era king in a white dhoti and gold armlets",
  not just "a king on a throne") rather than relying on generic royal/ruler tropes.
- In imagePrompt text, NEVER use the words "battle", "war", "army attacking", "fight", or name specific
  active religious worship sites. Describe conflict scenes instead as "tense standoff" or "warriors
  standing in formation" and describe temples generically as "an ancient stone temple" rather than
  naming a specific still-active site.
- Keep narration historically and factually accurate for the real people, places, and events involved
  - do not invent events that didn't happen. Vivid and engaging is not the same as fictionalized.`;

  try {
    const response = await withRetry(() =>
      getAiClient().models.generateContent({
        model: ENV.GEMINI_MODEL,
        contents: `Write the script for a video titled: "${topicTitle}"`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
        },
      })
    );

    const text = response.text;
    if (!text) throw new Error("Script generation returned empty response");

    return JSON.parse(text) as GeneratedScript;
  } catch (geminiErr: any) {
    console.warn(`⚠️ [ScriptGen] Gemini script generation failed (${geminiErr?.message || geminiErr}). Falling back to Hugging Face Serverless LLM...`);
    return await generateScriptWithHuggingFace(topicTitle, channel, systemInstruction);
  }
}

async function generateScriptWithHuggingFace(
  topicTitle: string,
  channel: ChannelConfig,
  systemInstruction: string
): Promise<GeneratedScript> {
  const token = process.env.HF_TOKEN;
  if (!token) throw new Error("HF_TOKEN is missing for Hugging Face LLM script generator fallback");

  console.log(`🤗 [ScriptGen] Attempting Hugging Face Serverless LLM (Qwen2.5-72B)...`);

  const response = await fetch("https://router.huggingface.co/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "Qwen/Qwen2.5-72B-Instruct",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: `Write the script for a video titled: "${topicTitle}"` },
      ],
      max_tokens: 2000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`HF Serverless LLM returned status: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Hugging Face LLM returned empty response");

  // Clean JSON response (strip markdown fences if model outputs ```json ... ```)
  content = content.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```$/, "").trim();

  return JSON.parse(content) as GeneratedScript;
}
