import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";
import type { ChannelConfig } from "../channelConfig.js";
import { getGeminiApiKey } from "../retry.js";

// Uses Google's Imagen via the same @google/genai SDK already used by paid/veo.ts and
// paid/tts.ts, so there's one Google Cloud key for the whole pipeline - Imagen is the primary,
// highest-quality path. Falls back to the free-tier chain (Pollinations, then a guaranteed
// thematic canvas) ported from video-pipeline/src/imageGen.ts for when Imagen fails, e.g. before
// billing is enabled on the Google Cloud project (Imagen has no free tier at all).
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "imagen-4.0-generate-001";

function sanitizePrompt(prompt: string): string {
  return prompt.replace(/[\r\n]+/g, " ").replace(/["']/g, "").replace(/\s+/g, " ").trim();
}

async function generateWithImagen(prompt: string, channel: ChannelConfig, outPath: string): Promise<void> {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  const response = await ai.models.generateImages({
    model: IMAGE_MODEL,
    prompt,
    config: { numberOfImages: 1, aspectRatio: channel.aspectRatio },
  });

  const imageBytes = response.generatedImages?.[0]?.image?.imageBytes;
  if (!imageBytes) throw new Error(`Imagen returned no image for prompt: "${prompt}"`);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(imageBytes, "base64"));
}

async function fetchPollinationsImage(
  prompt: string,
  width: number,
  height: number,
  model: string | null,
  targetPath: string
): Promise<void> {
  const encodedPrompt = encodeURIComponent(prompt.slice(0, 350));
  const seed = Math.floor(Math.random() * 1000000);
  const modelQuery = model ? `&model=${model}` : "";
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}${modelQuery}&nologo=true&seed=${seed}`;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url);
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const errorJson = await response.text();
        throw new Error(`Pollinations API JSON error: ${errorJson.slice(0, 200)}`);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      const isValidImage =
        (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ||
        (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) ||
        (buffer.length >= 12 && buffer.toString("ascii", 8, 12) === "WEBP");
      if (!isValidImage) throw new Error(`Invalid image payload (length: ${buffer.length} bytes)`);

      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, buffer);
      return;
    } catch (err: any) {
      if (attempt < 3 && (err.message.includes("429") || err.message.includes("Queue full"))) {
        await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
      } else {
        throw err;
      }
    }
  }
}

async function createThematicFallbackImage(prompt: string, width: number, height: number, targetPath: string): Promise<void> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e1b4b"/>
        <stop offset="50%" stop-color="#312e81"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#f8fafc" font-family="sans-serif" font-size="28" font-weight="bold">${prompt.slice(0, 40)}...</text>
  </svg>`;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, Buffer.from(svg, "utf-8"));
}

export async function generateSceneImage(
  prompt: string,
  channel: ChannelConfig,
  outPath: string
): Promise<string> {
  const fullPrompt = channel.imageAccuracyAnchor ? `${prompt} ${channel.imageAccuracyAnchor}` : prompt;
  const cleanPrompt = sanitizePrompt(fullPrompt);
  const [width, height] = channel.aspectRatio === "16:9" ? [1280, 720] : [720, 1280];

  try {
    console.log(`🎨 [ImageGen] Attempt 1: Imagen (${IMAGE_MODEL})...`);
    await generateWithImagen(fullPrompt, channel, outPath);
    return outPath;
  } catch (err1: any) {
    console.warn(`⚠️ [ImageGen] Imagen failed (${err1.message}). Falling back to Pollinations...`);
  }

  try {
    console.log(`🎨 [ImageGen] Attempt 2: Pollinations (FLUX)...`);
    await fetchPollinationsImage(cleanPrompt, width, height, "flux", outPath);
    return outPath;
  } catch (err2: any) {
    console.warn(`⚠️ [ImageGen] Pollinations FLUX failed (${err2.message}). Retrying with default model...`);
  }

  try {
    await fetchPollinationsImage(cleanPrompt, width, height, null, outPath);
    return outPath;
  } catch (err3: any) {
    console.warn(`⚠️ [ImageGen] Pollinations default failed (${err3.message}). Using thematic canvas fallback...`);
    await createThematicFallbackImage(cleanPrompt, width, height, outPath);
    return outPath;
  }
}
