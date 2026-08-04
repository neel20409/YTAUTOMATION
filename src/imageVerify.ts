import { readFile } from "node:fs/promises";
import { GoogleGenAI } from "@google/genai";
import { ENV } from "./config.js";
import { withRetry } from "./retry.js";

const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });

export interface VerificationResult {
  matches: boolean;
  issues: string;
}

/**
 * Sends a generated scene image back to Gemini's (free-tier) vision model along with the
 * prompt it was meant to match, and asks it to flag mismatches: wrong region/culture drift
 * (e.g. Mongolian/Chinese/European imagery when Indian was intended), a hidden or missing face
 * when the scene is about a named person, or a subject that doesn't match the description at
 * all. This is the actual check, not just hoping the generation prompt was good enough.
 */
export async function verifyImageMatchesContext(
  imagePath: string,
  expectedContext: string
): Promise<VerificationResult> {
  const imageBytes = await readFile(imagePath);

  const response = await withRetry(() =>
    ai.models.generateContent({
      model: ENV.GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: imageBytes.toString("base64") } },
            {
              text:
                `This image was meant to depict: "${expectedContext}"\n\n` +
                `Check carefully and answer honestly, even if the image looks good overall:\n` +
                `1. Does it show the correct region/ethnicity/culture with no wrong-culture drift ` +
                `(e.g. no Mongolian, Chinese, Middle Eastern, or European people/architecture/clothing ` +
                `if Indian was intended, or vice versa)?\n` +
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
        },
      ],
      config: { responseMimeType: "application/json" },
    })
  );

  const text = response.text;
  if (!text) throw new Error("Image verification returned empty response");

  return JSON.parse(text) as VerificationResult;
}
