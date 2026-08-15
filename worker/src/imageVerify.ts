import { readFile } from "node:fs/promises";
import { GoogleGenAI } from "@google/genai";
import { withRetry, getGeminiApiKey } from "./retry.js";

// See scriptGen.ts - gemini-pro-latest is a stable alias, not a dated preview name that 404s
// once deprecated.
const GEMINI_VISION_MODEL = process.env.GEMINI_MODEL ?? "gemini-pro-latest";

function getAiClient() {
  return new GoogleGenAI({ apiKey: getGeminiApiKey() });
}

export interface VerificationResult {
  matches: boolean;
  issues: string;
}

function detectMimeType(buffer: Buffer): string {
  if (buffer.length >= 4) {
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
  }
  return "image/jpeg";
}

/**
 * Sends a generated scene image back to Gemini's vision model along with the prompt it was
 * meant to match, and asks it to flag mismatches. Ported unchanged from
 * video-pipeline/src/imageVerify.ts - this is a genuine quality gate worth keeping even on the
 * paid pipeline (it's not a free-tier-flakiness workaround, it's a real correctness check).
 */
export async function verifyImageMatchesContext(
  imagePath: string,
  expectedContext: string
): Promise<VerificationResult> {
  const imageBytes = await readFile(imagePath);
  const mimeType = detectMimeType(imageBytes);

  const response = await withRetry(() =>
    getAiClient().models.generateContent({
      model: GEMINI_VISION_MODEL,
      contents: [
        { inlineData: { mimeType, data: imageBytes.toString("base64") } },
        {
          text:
            `This image was meant to depict: "${expectedContext}"\n\n` +
            `Check carefully and answer honestly, even if the image looks good overall:\n` +
            `1. Does it show the correct region/ethnicity/culture with no wrong-culture drift?\n` +
            `2. If a specific named person is meant to be the focus, is their face clearly visible - ` +
            `facing toward or three-quarter toward the camera, not hidden, in shadow, turned away, or ` +
            `too small/distant to make out?\n` +
            `3. Does the overall subject matter and setting actually match the description, rather ` +
            `than being a generic or unrelated scene?\n\n` +
            `Output ONLY valid JSON, no markdown fences:\n` +
            `{ "matches": boolean, "issues": string (empty string if matches is true, otherwise a ` +
            `short, specific, actionable description of what's wrong) }`,
        },
      ],
      config: { responseMimeType: "application/json" },
    })
  );

  const text = response.text;
  if (!text) throw new Error("Image verification returned empty response");

  return JSON.parse(text) as VerificationResult;
}
