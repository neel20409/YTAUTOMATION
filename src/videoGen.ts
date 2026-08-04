import { Client } from "@gradio/client";
import fs from "node:fs";
import path from "node:path";

/**
 * Converts a verified static image into a short AI video clip (MP4)
 * using a free Hugging Face Space endpoint (Stable Video Diffusion / Wan2.1).
 */
export async function generateSceneVideo(
  imagePath: string,
  outputPath: string,
  motionPrompt: string = "subtle natural movement, cinematic motion"
): Promise<string> {
  console.log(`🎬 [VideoGen] Animating scene image: ${path.basename(imagePath)}...`);

  // Create an AbortController to enforce a 45-second timeout on free public queues
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    // Connect to open-source Hugging Face Space endpoint (supports optional free HF_TOKEN for queue priority)
    const hfToken = process.env.HF_TOKEN;
    const client = await Client.connect(
      "multimodalart/stable-video-diffusion",
      hfToken ? ({ hf_token: hfToken } as any) : undefined
    );
    
    const imageBuffer = fs.readFileSync(imagePath);
    const imageBlob = new Blob([imageBuffer]);

    // Submit prediction request
    const result = await client.predict("/predict", [
      imageBlob,       // Input image
      motionPrompt,    // Motion prompt guidance
      6,               // Motion bucket ID / intensity (lower = subtler)
      25,              // Target FPS
    ]);

    clearTimeout(timeoutId);

    const videoUrl = (result.data as any[])?.[0]?.url;
    if (!videoUrl) {
      throw new Error("No output URL returned from Gradio endpoint.");
    }
    
    // Download generated MP4 clip
    const response = await fetch(videoUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to download clip: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));

    console.log(`✅ [VideoGen] AI video clip saved to ${outputPath}`);
    return outputPath;
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn(`⚠️ [VideoGen] Free cloud I2V failed or timed out (${error instanceof Error ? error.message : error}). Triggering fallback...`);
    throw error;
  }
}
