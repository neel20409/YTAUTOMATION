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
/**
 * Helper: Fetches from Pollinations free default endpoint with retry backoff
 */
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

  // Retry up to 3 times with backoff if Pollinations reports rate limits or temporary busy
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url);
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        const errorJson = await response.text();
        throw new Error(`Pollinations API JSON error: ${errorJson.slice(0, 200)}`);
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
        throw new Error(`Invalid image payload (length: ${buffer.length} bytes)`);
      }

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
    "https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-2-1",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hfToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: { width, height },
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
 * Helper: Creates a clean thematic SVG gradient canvas if all external APIs fail
 */
async function createThematicFallbackImage(
  prompt: string,
  width: number,
  height: number,
  targetPath: string
): Promise<void> {
  // Return a clean SVG image buffer formatted as an SVG file
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

  // --- ATTEMPT 1: Pollinations.ai (Free Default GPU Endpoint) ---
  try {
    console.log(`🎨 [ImageGen] Attempt 1: Pollinations Free Tier...`);
    await fetchPollinationsImage(cleanPrompt, width, height, null, outPath);
    return outPath;
  } catch (err1: any) {
    console.warn(`⚠️ [ImageGen] Attempt 1 failed: ${err1.message}. Retrying with model=flux...`);
  }

  // --- ATTEMPT 2: Pollinations.ai (model=flux) ---
  try {
    console.log(`🎨 [ImageGen] Attempt 2: Pollinations (FLUX)...`);
    await fetchPollinationsImage(cleanPrompt, width, height, "flux", outPath);
    return outPath;
  } catch (err2: any) {
    console.warn(`⚠️ [ImageGen] Attempt 2 failed: ${err2.message}. Switching to Hugging Face...`);
  }

  // --- ATTEMPT 3: Hugging Face Serverless / Thematic Canvas Fallback ---
  try {
    console.log(`🎨 [ImageGen] Attempt 3: Hugging Face Serverless SD 2.1...`);
    await fetchHuggingFaceImage(cleanPrompt, width, height, outPath);
    return outPath;
  } catch (err3: any) {
    console.warn(`⚠️ [ImageGen] Attempt 3 failed (${err3.message}). Using thematic canvas fallback...`);
    await createThematicFallbackImage(cleanPrompt, width, height, outPath);
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
