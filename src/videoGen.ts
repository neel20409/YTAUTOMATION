import { Client } from "@gradio/client";
import fs from "node:fs";
import path from "node:path";

/**
 * Tier 1: Attempts free Image-to-Video via Hugging Face Spaces (ZeroGPU).
 */
async function tryHuggingFaceI2V(
  imagePath: string,
  outputPath: string,
  motionPrompt: string,
  aspectRatio: "16:9" | "9:16" = "16:9"
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  // Each space has its own endpoint name and parameter schema - pulled from each space's live
  // /gradio_api/info, since guessing (e.g. wan2-1-fast previously used a "/video" endpoint name
  // that doesn't exist on that space - it's "/generate_video" with a 10-parameter signature).
  const [wanHeight, wanWidth] = aspectRatio === "9:16" ? [896, 512] : [512, 896];
  const candidateSpaces: Array<{
    name: string;
    endpoint: string;
    buildArgs: (imageBlob: Blob, seed: number) => unknown[];
  }> = [
    {
      name: "multimodalart/stable-video-diffusion",
      endpoint: "/video",
      buildArgs: (imageBlob, seed) => [imageBlob, seed, true, 127, 12],
    },
    {
      name: "multimodalart/wan2-1-fast",
      endpoint: "/generate_video",
      buildArgs: (imageBlob, seed) => [
        imageBlob,
        motionPrompt || "make this image come alive, cinematic motion, smooth animation",
        wanHeight,
        wanWidth,
        "Bright tones, overexposed, static, blurred details, watermark, text, deformed, disfigured, worst quality, low quality",
        2, // duration_seconds
        1, // guidance_scale
        4, // steps
        seed,
        false, // randomize_seed - false since we already pass an explicit seed
      ],
    },
  ];

  const hfToken = process.env.HF_TOKEN;

  for (const candidate of candidateSpaces) {
    try {
      console.log(`🎬 [VideoGen] Connecting to Gradio Space: ${candidate.name}...`);
      const client = await Client.connect(
        candidate.name,
        hfToken ? ({ token: hfToken } as any) : undefined
      );
      const imageBuffer = fs.readFileSync(imagePath);
      const imageBlob = new Blob([imageBuffer]);
      const seed = Math.floor(Math.random() * 1000000);

      const result = await client.predict(candidate.endpoint, candidate.buildArgs(imageBlob, seed));

      clearTimeout(timeoutId);

      const videoData = (result.data as any[])?.[0];
      const videoUrl =
        videoData?.url || videoData?.path || (typeof videoData === "string" ? videoData : null);

      if (!videoUrl) throw new Error(`No URL returned from ${candidate.name}`);

      const response = await fetch(videoUrl, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, buffer);

      return outputPath;
    } catch (spaceErr: any) {
      console.warn(`⚠️ [VideoGen] Space ${candidate.name} failed (${spaceErr?.message || spaceErr}). Trying next candidate...`);
    }
  }

  clearTimeout(timeoutId);
  throw new Error("All Hugging Face I2V candidate spaces failed.");
}

/**
 * Main Export: 2-Tier Video Generation Orchestrator
 * Tier 1: Hugging Face ZeroGPU (SVD / Wan2.1)
 * Tier 2: Local FFmpeg Ken Burns Pan/Zoom (Handled in orchestrator catch block)
 *
 * There used to be a "Tier 2" here that fell back to Pollinations.ai - but that's an
 * image-generation endpoint (image.pollinations.ai), not video. It was returning a JPEG/PNG
 * saved with a .mp4 extension, which then failed downstream when ffmpeg tried to mux it as a
 * video clip, wasting a request cycle before falling through to the real Ken Burns fallback
 * anyway. Removed rather than fixed since there's no free Pollinations video endpoint to fall
 * back to.
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
    const clipPath = await tryHuggingFaceI2V(imagePath, outputPath, motionPrompt, aspectRatio);
    console.log(`✅ [VideoGen] Tier 1 (Hugging Face I2V) succeeded: ${clipPath}`);
    return clipPath;
  } catch (hfError: any) {
    const errorMsg = hfError?.message || String(hfError);
    console.warn(`⚠️ [VideoGen] Tier 1 failed (${errorMsg}). Falling back to FFmpeg Ken Burns...`);
    // Throw so the orchestrator in src/index.ts triggers the Ken Burns fallback.
    throw new Error(`Hugging Face I2V exhausted: ${errorMsg}`);
  }
}
