import { GoogleGenAI } from "@google/genai";
import { ENV } from "../config.js";
import { withRetry } from "../retry.js";
import { CHARACTERS, type CharacterId } from "./shortsConfig.js";

export interface DialogueLine {
  character: CharacterId;
  text: string; // spoken line
  backgroundPrompt: string; // visual prompt for this line's background image
}

export interface ShortScript {
  title: string;
  description: string;
  lines: DialogueLine[];
}

const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });

/**
 * Generates a short (15-40 second) back-and-forth story for a YouTube Short, told entirely
 * as dialogue between Bloop and Boo. Uses the free-tier gemini-2.5-flash model.
 */
export async function generateShortScript(premise: string): Promise<ShortScript> {
  const systemInstruction = `You are writing a YouTube Short script for the channel "Bloop and Boo".
The only two characters are:
- Bloop: ${CHARACTERS.bloop.personality}
- Boo: ${CHARACTERS.boo.personality}

Output ONLY valid JSON, no markdown fences, no commentary.

JSON shape:
{
  "title": string (catchy, under 60 characters),
  "description": string (YouTube description, 1-2 sentences, include 2-3 relevant hashtags),
  "lines": [
    { "character": "bloop" | "boo", "text": string, "backgroundPrompt": string }
  ]
}

Rules:
- Produce 6-10 lines total, alternating naturally between Bloop and Boo like a real conversation
  (not strictly alternating turn-by-turn if the story calls for one character speaking twice in a row).
- Each "text" is 1-2 short sentences of spoken dialogue in simple English suitable for young kids.
- Each "backgroundPrompt" is a richly specific, visual-only English description of the scene
  setting behind the characters for that line (no characters in the description - they're
  composited in separately). Include concrete setting details drawn from that line's story beat
  (specific objects, time of day, weather, small details that make the place feel real), plus a
  sense of camera framing (wide establishing shot, close-up on a detail, etc.) varied across
  lines. Style: warm, colorful children's storybook illustration - soft rounded shapes, gentle
  lighting, a friendly picture-book aesthetic. Never photorealistic.
- Tell a complete, wholesome mini-story with a beginning, a small challenge or question, and a
  kind resolution - values like sharing, kindness, courage, or friendship.
- Keep the tone warm, playful, and easy to follow for a young audience.`;

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Write the short's dialogue for this story idea: "${premise}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      },
    })
  );

  const text = response.text;
  if (!text) throw new Error("Short script generation returned empty response");

  return JSON.parse(text) as ShortScript;
}
