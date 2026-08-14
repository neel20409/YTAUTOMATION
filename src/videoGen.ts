import { Client } from "@gradio/client";
import { fal } from "@fal-ai/client";
import fs from "node:fs";
import path from "node:path";

/**
 * Helper: Uploads a local image file to Catbox.moe to obtain a temporary public URL for API consumption.
 */
async function uploadImageToCatbox(imagePath: string): Promise<string> {
  const fileBuffer = fs.readFileSync(imagePath);
  const blob = new Blob([fileBuffer]);
  const formData = new FormData();
  formData.append("reqtype", "fileupload");
  formData.append("fileToUpload", blob, path.basename(imagePath));

  const response = await fetch("https://catbox.moe/user/api.php", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload image to Catbox.moe: HTTP ${response.status}`);
  }

  const publicUrl = (await response.text()).trim();
  if (!publicUrl.startsWith("http")) {
    throw new Error(`Catbox.moe upload returned invalid URL: ${publicUrl}`);
  }

  return publicUrl;
}



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
 * Helper: Parses all available fal.ai API keys from environment (comma-separated or indexed FAL_KEY_1..10).
 */
function getFalApiKeys(): string[] {
  const keys: string[] = [];
  const mainEnv = process.env.FAL_KEYS || process.env.FAL_KEY;
  if (mainEnv) {
    const parts = mainEnv.split(/[,;\n]+/).map((k) => k.trim()).filter(Boolean);
    keys.push(...parts);
  }

  for (let i = 1; i <= 10; i++) {
    const indexedKey = process.env[`FAL_KEY_${i}`];
    if (indexedKey && indexedKey.trim()) {
      keys.push(indexedKey.trim());
    }
  }

  return Array.from(new Set(keys));
}

/**
 * Tier 0B: Attempts fal.ai (ByteDance Seedance 2.0 / Veo2 / Kling) Image-to-Video API generation.
 */
async function tryFalI2V(
  imagePath: string,
  outputPath: string,
  motionPrompt: string,
  aspectRatio: "16:9" | "9:16" = "16:9",
  imageUrl?: string
): Promise<string> {
  const falKeys = getFalApiKeys();
  if (falKeys.length === 0) {
    throw new Error("FAL_KEY is not set in environment.");
  }

  let publicUrl = imageUrl;

  for (let idx = 0; idx < falKeys.length; idx++) {
    const falKey = falKeys[idx];
    console.log(`🎬 [VideoGen] Initiating fal.ai Seedance 2.0 (Key ${idx + 1}/${falKeys.length})...`);

    try {
      fal.config({ credentials: falKey });

      if (!publicUrl) {
        console.log("📤 [VideoGen] Resolving public URL for scene image via Catbox...");
        publicUrl = await uploadImageToCatbox(imagePath);
      }

      console.log(`🌐 [VideoGen] Scene image URL: ${publicUrl}`);

      const candidateModels = [
        "fal-ai/bytedance/seedance-2.0/image-to-video",
        "fal-ai/kling-video/v1.6/pro/image-to-video",
        "fal-ai/veo2/image-to-video",
      ];

      let result: any = null;
      let lastModelErr: any = null;

      for (const modelEndpoint of candidateModels) {
        try {
          console.log(`📡 [VideoGen] Trying fal.ai model endpoint: ${modelEndpoint}...`);
          result = await fal.subscribe(modelEndpoint, {
            input: {
              prompt: motionPrompt || "cinematic motion, smooth animation",
              image_url: publicUrl,
              aspect_ratio: aspectRatio,
            },
          });
          if (result?.data?.video?.url || result?.video?.url) {
            break;
          }
        } catch (mErr: any) {
          lastModelErr = mErr;
          console.warn(`⚠️ [VideoGen] fal.ai model ${modelEndpoint} failed (${mErr?.message || mErr}). Trying next candidate...`);
        }
      }

      const videoUrl = result?.data?.video?.url || result?.video?.url;
      if (!videoUrl) {
        throw new Error(lastModelErr?.message || "No video URL returned by fal.ai model endpoints.");
      }

      console.log(`📥 [VideoGen] Downloading fal.ai video clip from ${videoUrl}...`);

      const response = await fetch(videoUrl);
      if (!response.ok) {
        throw new Error(`Failed to download fal.ai video clip: HTTP ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, buffer);

      return outputPath;
    } catch (keyErr: any) {
      console.warn(`⚠️ [VideoGen] fal.ai Key ${idx + 1}/${falKeys.length} failed (${keyErr?.message || keyErr}).`);
      if (idx < falKeys.length - 1) {
        console.log(`🔄 [VideoGen] Shifting to next fal.ai API key (${idx + 2}/${falKeys.length})...`);
      }
    }
  }

  throw new Error("All configured fal.ai API keys failed or hit limits.");
}

/**
 * Helper: Parses all available xAI / Grok API keys from environment (GROK_API_KEY1, GROK_KEY_1, XAI_API_KEY, etc.).
 */
function getGrokApiKeys(): string[] {
  const keys: string[] = [];
  const mainEnvs = [
    process.env.GROK_KEYS,
    process.env.GROK_API_KEY,
    process.env.GROK_KEY,
    process.env.XAI_KEYS,
    process.env.XAI_API_KEY,
    process.env.XAI_KEY,
  ];

  for (const mainEnv of mainEnvs) {
    if (mainEnv) {
      const parts = mainEnv.split(/[,;\n]+/).map((k) => k.trim()).filter(Boolean);
      keys.push(...parts);
    }
  }

  for (let i = 1; i <= 10; i++) {
    const candidates = [
      process.env[`GROK_API_KEY${i}`],
      process.env[`GROK_API_KEY_${i}`],
      process.env[`GROK_KEY${i}`],
      process.env[`GROK_KEY_${i}`],
      process.env[`XAI_API_KEY${i}`],
      process.env[`XAI_API_KEY_${i}`],
      process.env[`XAI_KEY${i}`],
      process.env[`XAI_KEY_${i}`],
    ];

    for (const cand of candidates) {
      if (cand && cand.trim()) {
        keys.push(cand.trim());
      }
    }
  }

  return Array.from(new Set(keys));
}

/**
 * Helper: Parses all available Manus AI API keys from environment (MANUS_API_KEY1, MANUS_KEY_1, MANUS_API_KEY, etc.).
 */
function getManusApiKeys(): string[] {
  const keys: string[] = [];
  const mainEnvs = [
    process.env.MANUS_KEYS,
    process.env.MANUS_API_KEY,
    process.env.MANUS_KEY,
  ];

  for (const mainEnv of mainEnvs) {
    if (mainEnv) {
      const parts = mainEnv.split(/[,;\n]+/).map((k) => k.trim()).filter(Boolean);
      keys.push(...parts);
    }
  }

  for (let i = 1; i <= 10; i++) {
    const candidates = [
      process.env[`MANUS_API_KEY${i}`],
      process.env[`MANUS_API_KEY_${i}`],
      process.env[`MANUS_KEY${i}`],
      process.env[`MANUS_KEY_${i}`],
    ];

    for (const cand of candidates) {
      if (cand && cand.trim()) {
        keys.push(cand.trim());
      }
    }
  }

  return Array.from(new Set(keys));
}


/**
 * Tier 0A: Attempts xAI Grok Imagine Video API (grok-imagine-video-1.5) Image-to-Video generation with key rotation.
 */
async function tryGrokI2V(
  imagePath: string,
  outputPath: string,
  motionPrompt: string,
  imageUrl?: string
): Promise<string> {
  const grokKeys = getGrokApiKeys();
  if (grokKeys.length === 0) {
    throw new Error("GROK_API_KEY is not set in environment.");
  }

  let publicUrl = imageUrl;

  for (let idx = 0; idx < grokKeys.length; idx++) {
    const apiKey = grokKeys[idx];
    console.log(`🎬 [VideoGen] Initiating xAI Grok Imagine (Key ${idx + 1}/${grokKeys.length})...`);

    try {
      if (!publicUrl) {
        console.log("📤 [VideoGen] Resolving public URL for scene image via Catbox for Grok...");
        publicUrl = await uploadImageToCatbox(imagePath);
      }

      console.log(`📡 [VideoGen] Requesting xAI Grok video generation for image: ${publicUrl}...`);
      const createRes = await fetch("https://api.x.ai/v1/videos/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "grok-imagine-video-1.5",
          prompt: motionPrompt || "subtle natural movement, cinematic motion",
          image: {
            url: publicUrl,
          },
          duration: 5,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        const errorMsg =
          typeof createData?.error === "string"
            ? createData.error
            : createData?.error?.message || JSON.stringify(createData);
        throw new Error(`xAI Grok API error (HTTP ${createRes.status}): ${errorMsg}`);
      }

      const requestId = createData?.request_id || createData?.id;
      if (!requestId) {
        throw new Error("No request_id returned by xAI Grok video API.");
      }

      console.log(`⏳ [VideoGen] Polling xAI Grok video generation status (request_id: ${requestId})...`);
      const startTime = Date.now();
      const maxWaitMs = 120000; // 2 minutes

      while (Date.now() - startTime < maxWaitMs) {
        await new Promise((res) => setTimeout(res, 5000));

        const pollRes = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
          },
        });

        if (!pollRes.ok) {
          continue;
        }

        const pollData = await pollRes.json();
        const status = pollData?.status || pollData?.state;
        const videoUrl = pollData?.video?.url || pollData?.url || pollData?.result?.url;

        if (status === "completed" || videoUrl) {
          if (!videoUrl) throw new Error("Grok video generation completed but no video URL was returned.");
          console.log(`📥 [VideoGen] Downloading Grok video clip from ${videoUrl}...`);
          const downloadRes = await fetch(videoUrl);
          if (!downloadRes.ok) throw new Error(`HTTP ${downloadRes.status} downloading Grok video`);

          const buffer = Buffer.from(await downloadRes.arrayBuffer());
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          fs.writeFileSync(outputPath, buffer);
          return outputPath;
        }

        if (status === "failed" || status === "error") {
          throw new Error(`Grok video generation failed: ${pollData?.error || "Unknown error"}`);
        }
      }

      throw new Error("Grok video generation timed out after 120s.");
    } catch (keyErr: any) {
      console.warn(`⚠️ [VideoGen] Grok Key ${idx + 1}/${grokKeys.length} failed (${keyErr?.message || keyErr}).`);
      if (idx < grokKeys.length - 1) {
        console.log(`🔄 [VideoGen] Rotating to next Grok API key (${idx + 2}/${grokKeys.length})...`);
      }
    }
  }

  throw new Error("All configured Grok API keys failed or hit limits.");
}


/**
 * Tier 0B: Attempts Manus AI Task API Image-to-Video generation.
 */
async function tryManusI2V(
  imagePath: string,
  outputPath: string,
  motionPrompt: string,
  imageUrl?: string
): Promise<string> {
  const manusKeys = getManusApiKeys();
  if (manusKeys.length === 0) {
    throw new Error("MANUS_API_KEY is not set in environment.");
  }

  let publicUrl = imageUrl;

  for (let idx = 0; idx < manusKeys.length; idx++) {
    const apiKey = manusKeys[idx];
    console.log(`🎬 [VideoGen] Initiating Manus AI (Key ${idx + 1}/${manusKeys.length})...`);

    try {
      if (!publicUrl) {
        console.log("📤 [VideoGen] Resolving public URL for scene image via Catbox for Manus...");
        publicUrl = await uploadImageToCatbox(imagePath);
      }

      console.log(`📡 [VideoGen] Requesting Manus AI video task for image: ${publicUrl}...`);
      const createRes = await fetch("https://api.manus.ai/v2/task", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-manus-api-key": apiKey,
          "API_KEY": apiKey,
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: `Animate this scene image into a video clip with ${motionPrompt || "subtle cinematic motion"}. Image: ${publicUrl}`,
          input_image: publicUrl,
        }),
      });

      const createData = await createRes.json();
      if (!createRes.ok) {
        const errorMsg =
          typeof createData?.error === "string"
            ? createData.error
            : createData?.error?.message || JSON.stringify(createData);
        throw new Error(`Manus AI API error (HTTP ${createRes.status}): ${errorMsg}`);
      }

      const taskId = createData?.task_id || createData?.id;
      if (!taskId) {
        throw new Error("No task_id returned by Manus AI API.");
      }

      console.log(`⏳ [VideoGen] Polling Manus AI task status (task_id: ${taskId})...`);
      const startTime = Date.now();
      const maxWaitMs = 180000; // 3 minutes

      while (Date.now() - startTime < maxWaitMs) {
        await new Promise((res) => setTimeout(res, 6000));

        const pollRes = await fetch(`https://api.manus.ai/v2/task/${taskId}`, {
          headers: {
            "x-manus-api-key": apiKey,
            "API_KEY": apiKey,
            "Authorization": `Bearer ${apiKey}`,
          },
        });


        if (!pollRes.ok) continue;

        const pollData = await pollRes.json();
        const status = pollData?.status || pollData?.state;
        const videoUrl = pollData?.video_url || pollData?.output?.video_url || pollData?.result?.video_url;

        if (status === "completed" || status === "success" || videoUrl) {
          if (!videoUrl) throw new Error("Manus AI task completed but no video URL returned.");
          console.log(`📥 [VideoGen] Downloading Manus video clip from ${videoUrl}...`);
          const downloadRes = await fetch(videoUrl);
          if (!downloadRes.ok) throw new Error(`HTTP ${downloadRes.status} downloading Manus video`);

          const buffer = Buffer.from(await downloadRes.arrayBuffer());
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          fs.writeFileSync(outputPath, buffer);
          return outputPath;
        }

        if (status === "failed" || status === "error") {
          throw new Error(`Manus AI task failed: ${pollData?.error || "Unknown error"}`);
        }
      }

      throw new Error("Manus AI task timed out after 180s.");
    } catch (keyErr: any) {
      console.warn(`⚠️ [VideoGen] Manus Key ${idx + 1}/${manusKeys.length} failed (${keyErr?.message || keyErr}).`);
      if (idx < manusKeys.length - 1) {
        console.log(`🔄 [VideoGen] Rotating to next Manus API key (${idx + 2}/${manusKeys.length})...`);
      }
    }
  }

  throw new Error("All configured Manus API keys failed or hit limits.");
}

/**
 * Main Export: Multi-Tier Video Generation Orchestrator
 * Tier 0A: xAI Grok Imagine API (grok-imagine-video-1.5 if GROK_API_KEY is configured)
 * Tier 0B: Manus AI Task API (if MANUS_API_KEY is configured)
 * Tier 0C: fal.ai API (ByteDance Seedance 2.0 / Kling if FAL_KEY is configured)
 * Tier 1: Hugging Face ZeroGPU (SVD / Wan2.1 - free cloud AI)
 * Tier 2: Local FFmpeg Ken Burns Pan/Zoom (Handled in orchestrator catch block)
 */
export async function generateSceneVideo(
  imagePath: string,
  outputPath: string,
  motionPrompt: string = "subtle natural movement, cinematic motion",
  aspectRatio: "16:9" | "9:16" = "16:9",
  imageUrl?: string
): Promise<string> {
  console.log(`🎬 [VideoGen] Animating scene image: ${path.basename(imagePath)}...`);

  // --- TIER 0A: xAI Grok Imagine API ---
  const grokKeys = getGrokApiKeys();
  if (grokKeys.length > 0) {
    try {
      const grokClipPath = await tryGrokI2V(imagePath, outputPath, motionPrompt, imageUrl);
      console.log(`✅ [VideoGen] Tier 0A (xAI Grok Imagine) succeeded: ${grokClipPath}`);
      return grokClipPath;
    } catch (grokError: any) {
      console.warn(`⚠️ [VideoGen] Tier 0A (xAI Grok Imagine) failed (${grokError?.message || grokError}). Falling back to next tier...`);
    }
  }

  // --- TIER 0B: Manus AI Task API ---
  const manusKeys = getManusApiKeys();
  if (manusKeys.length > 0) {
    try {
      const manusClipPath = await tryManusI2V(imagePath, outputPath, motionPrompt, imageUrl);
      console.log(`✅ [VideoGen] Tier 0B (Manus AI) succeeded: ${manusClipPath}`);
      return manusClipPath;
    } catch (manusError: any) {
      console.warn(`⚠️ [VideoGen] Tier 0B (Manus AI) failed (${manusError?.message || manusError}). Falling back to next tier...`);
    }
  }

  // --- TIER 0C: fal.ai ByteDance Seedance 2.0 ---
  if (process.env.FAL_KEY || process.env.FAL_KEYS) {
    try {
      const falClipPath = await tryFalI2V(imagePath, outputPath, motionPrompt, aspectRatio, imageUrl);
      console.log(`✅ [VideoGen] Tier 0C (fal.ai Seedance 2.0) succeeded: ${falClipPath}`);
      return falClipPath;
    } catch (falError: any) {
      console.warn(`⚠️ [VideoGen] Tier 0C (fal.ai Seedance) failed (${falError?.message || falError}). Falling back to Tier 1...`);
    }
  }

  // --- TIER 1: Hugging Face ZeroGPU ---
  try {
    const clipPath = await tryHuggingFaceI2V(imagePath, outputPath, motionPrompt, aspectRatio);
    console.log(`✅ [VideoGen] Tier 1 (Hugging Face I2V) succeeded: ${clipPath}`);
    return clipPath;
  } catch (hfError: any) {
    const errorMsg = hfError?.message || String(hfError);
    console.warn(`⚠️ [VideoGen] Tier 1 failed (${errorMsg}). Falling back to FFmpeg Ken Burns...`);
    // Throw so the orchestrator in src/index.ts triggers the Ken Burns fallback.
    throw new Error(`AI Video Generation exhausted: ${errorMsg}`);
  }
}





