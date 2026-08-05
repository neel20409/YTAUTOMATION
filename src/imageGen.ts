import { writeFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import type { ChannelConfig } from "./config.js";
import { verifyImageMatchesContext } from "./imageVerify.js";

/**
 * Strips line breaks, quotes, and excessive symbols that break URL-based GET requests.
 */
function sanitizePrompt(prompt: string): string {
  return prompt
    .replace(/[\r\n]+/g, " ")
    .replace(/["']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Helper: Fetches from Pollinations and checks for JSON error bodies
 */
async function fetchPollinationsImage(
  prompt: string,
  width: number,
  height: number,
  model: string,
  targetPath: string
): Promise<void> {
  const encodedPrompt = encodeURIComponent(prompt.slice(0, 400));
  const seed = Math.floor(Math.random() * 1000000);
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${model}&nologo=true&seed=${seed}`;

  const response = await fetch(url);
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const errorJson = await response.text();
    throw new Error(`Pollinations API error JSON (${model}): ${errorJson.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const isValidImage =
    (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) || // JPEG
    (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) || // PNG
    (buffer.length >= 12 && buffer.toString("ascii", 8, 12) === "WEBP"); // WebP

  if (!isValidImage) {
    throw new Error(`Invalid image payload returned from Pollinations (length: ${buffer.length} bytes)`);
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);
}

/**
 * Helper: Hugging Face Free Serverless API fallback
 */
async function fetchHuggingFaceImage(
  prompt: string,
  width: number,
  height: number,
  targetPath: string
): Promise<void> {
  const hfToken = process.env.HF_TOKEN;
  if (!hfToken) {
    throw new Error("HF_TOKEN is missing in .env for backup image generator.");
  }

  const response = await fetch(
    "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { width, height, num_inference_steps: 4 },
      }),
    }
  );

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const errorJson = await response.text();
    throw new Error(`HF API JSON error: ${errorJson.slice(0, 200)}`);
  }

  if (!response.ok) {
    throw new Error(`HF HTTP ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const isValidImage =
    (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) ||
    (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e) ||
    (buffer.length >= 12 && buffer.toString("ascii", 8, 12) === "WEBP");

  if (!isValidImage) {
    throw new Error(`Invalid image payload returned from HF (length: ${buffer.length} bytes)`);
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);
}

/**
 * Helper: Picsum stock fallback if all AI generators fail/time out
 */
async function fetchPicsumImage(
  width: number,
  height: number,
  targetPath: string
): Promise<void> {
  const seed = Math.floor(Math.random() * 1000);
  const fallbackUrl = `https://picsum.photos/seed/${seed}/${width}/${height}`;
  const response = await fetch(fallbackUrl);
  if (!response.ok) throw new Error(`Picsum fallback returned status ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, Buffer.from(arrayBuffer));
}

/**
 * Generates an image with a 3-stage fallback:
 * 1. Pollinations (model=flux)
 * 2. Pollinations (model=turbo)
 * 3. Hugging Face Serverless FLUX.1-schnell / Stock Fallback
 */
export async function generateSceneImage(
  prompt: string,
  channel: ChannelConfig,
  outPath: string,
  maxAttempts = 4
): Promise<string> {
  const [width, height] = channel.aspectRatio === "16:9" ? [1280, 720] : [720, 1280];
  const fullPrompt = channel.imageAccuracyAnchor
    ? `${prompt} ${channel.imageAccuracyAnchor}`
    : prompt;

  const cleanPrompt = sanitizePrompt(fullPrompt);

  // --- ATTEMPT 1: Pollinations.ai (model=flux) ---
  try {
    console.log(`🎨 [ImageGen] Attempt 1: Pollinations (FLUX)...`);
    await fetchPollinationsImage(cleanPrompt, width, height, "flux", outPath);
    return outPath;
  } catch (err1: any) {
    console.warn(`⚠️ [ImageGen] Attempt 1 failed: ${err1.message}. Retrying with model=turbo...`);
  }

  // --- ATTEMPT 2: Pollinations.ai (model=turbo) ---
  try {
    console.log(`🎨 [ImageGen] Attempt 2: Pollinations (Turbo)...`);
    await fetchPollinationsImage(cleanPrompt, width, height, "turbo", outPath);
    return outPath;
  } catch (err2: any) {
    console.warn(`⚠️ [ImageGen] Attempt 2 failed: ${err2.message}. Switching to Hugging Face FLUX.1...`);
  }

  // --- ATTEMPT 3: Hugging Face Free Serverless / Stock Fallback ---
  try {
    console.log(`🎨 [ImageGen] Attempt 3: Hugging Face FLUX.1 / Stock Fallback...`);
    await fetchHuggingFaceImage(cleanPrompt, width, height, outPath);
    return outPath;
  } catch (err3: any) {
    console.warn(`⚠️ [ImageGen] Attempt 3 failed (${err3.message}). Using resilient stock background fallback...`);
    await fetchPicsumImage(width, height, outPath);
    return outPath;
  }
}

/**
 * generateSceneImage() + Gemini Vision accuracy verification guardrail
 */
export async function generateVerifiedSceneImage(
  prompt: string,
  channel: ChannelConfig,
  outPath: string,
  maxAttempts = 2
): Promise<string> {
  let currentPrompt = prompt;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await generateSceneImage(currentPrompt, channel, outPath);

    let verdict;
    try {
      verdict = await verifyImageMatchesContext(outPath, prompt);
    } catch (err) {
      console.warn(`Image verification call failed, keeping this attempt as-is: ${err}`);
      return outPath;
    }

    if (verdict.matches) {
      return outPath;
    }

    console.warn(
      `Scene image attempt ${attempt}/${maxAttempts} failed verification: ${verdict.issues}`
    );
    if (attempt < maxAttempts) {
      currentPrompt = `${prompt} IMPORTANT - a previous attempt was rejected for this reason, fix it specifically: ${verdict.issues}`;
    } else {
      console.warn(`Using best-effort image after ${maxAttempts} failed verification attempts.`);
    }
  }

  return outPath;
}
