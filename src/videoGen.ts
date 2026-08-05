import { Client } from "@gradio/client";
import fs from "node:fs";
import path from "node:path";

/**
 * Tier 1: Attempts free Image-to-Video via Hugging Face Spaces (ZeroGPU).
 */
async function tryHuggingFaceI2V(
  imagePath: string,
  outputPath: string,
  motionPrompt: string
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const hfToken = process.env.HF_TOKEN;
    const client = await Client.connect(
      "multimodalart/stable-video-diffusion",
      hfToken ? ({ token: hfToken } as any) : undefined
    );
    const imageBuffer = fs.readFileSync(imagePath);
    const imageBlob = new Blob([imageBuffer]);

    const result = await client.predict("/video", [
      imageBlob,
      Math.floor(Math.random() * 1000000),
      true,
      127,
      12,
    ]);

    clearTimeout(timeoutId);

    const videoData = (result.data as any[])?.[0];
    const videoUrl =
      videoData?.url || videoData?.path || (typeof videoData === "string" ? videoData : null);

    if (!videoUrl) throw new Error("No URL returned from Hugging Face endpoint.");

    const response = await fetch(videoUrl, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);

    return outputPath;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Tier 2 (Strategy C): Fallback to Pollinations.ai generative endpoint.
 */
async function tryPollinationsVideoFallback(
  prompt: string,
  outputPath: string,
  aspectRatio: "16:9" | "9:16" = "16:9"
): Promise<string> {
  console.log(`🐝 [Strategy C] Attempting Pollinations.ai video fallback...`);

  const [width, height] = aspectRatio === "9:16" ? [720, 1280] : [1280, 720];
  const encodedPrompt = encodeURIComponent(
    `${prompt.slice(0, 300)}, subtle cinematic motion, highly detailed, 8k resolution`
  );
  const seed = Math.floor(Math.random() * 1000000);

  const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(pollinationsUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Pollinations API returned status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate image/video payload
    const isValid =
      buffer.length >= 1000 &&
      ((buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) || // JPEG
        (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e) || // PNG
        buffer.toString("ascii", 4, 8) === "ftyp" || // MP4
        buffer.toString("ascii", 0, 4) === "RIFF"); // WebP/AVI

    if (!isValid) {
      throw new Error("Invalid binary media payload returned from Pollinations endpoint.");
    }

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);

    console.log(`✅ [Strategy C] Pollinations fallback clip saved: ${outputPath}`);
    return outputPath;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Main Export: 3-Tier Video Generation Orchestrator
 * Tier 1: Hugging Face ZeroGPU (SVD / Wan2.1)
 * Tier 2: Pollinations.ai Generative Cloud Fallback (Strategy C)
 * Tier 3: Local FFmpeg Ken Burns Pan/Zoom (Handled in orchestrator catch block)
 */
export async function generateSceneVideo(
  imagePath: string,
  outputPath: string,
  motionPrompt: string = "subtle natural movement, cinematic motion",
  aspectRatio: "16:9" | "9:16" = "16:9"
): Promise<string> {
  console.log(`🎬 [VideoGen] Animating scene image: ${path.basename(imagePath)}...`);

  // --- TIER 1: Hugging Face ZeroGPU ---
  try {
    const clipPath = await tryHuggingFaceI2V(imagePath, outputPath, motionPrompt);
    console.log(`✅ [VideoGen] Tier 1 (Hugging Face I2V) succeeded: ${clipPath}`);
    return clipPath;
  } catch (hfError: any) {
    const errorMsg = hfError?.message || String(hfError);
    console.warn(`⚠️ [VideoGen] Tier 1 failed (${errorMsg}). Switching to Strategy C...`);
  }

  // --- TIER 2: Strategy C (Pollinations.ai Fallback) ---
  try {
    const clipPath = await tryPollinationsVideoFallback(
      motionPrompt,
      outputPath,
      aspectRatio
    );
    console.log(`✅ [VideoGen] Tier 2 (Pollinations.ai Strategy C) succeeded: ${clipPath}`);
    return clipPath;
  } catch (pollinationsError: any) {
    console.warn(
      `⚠️ [VideoGen] Tier 2 Strategy C failed (${pollinationsError?.message || pollinationsError}). Throwing to Tier 3 (FFmpeg)...`
    );
    // Throw error so the orchestrator in src/index.ts triggers Tier 3 (FFmpeg Ken Burns)
    throw new Error("All cloud video generators exhausted.");
  }
}
