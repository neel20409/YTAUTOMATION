import { writeFile } from "node:fs/promises";
import type { ChannelConfig } from "./config.js";
import { verifyImageMatchesContext } from "./imageVerify.js";

/**
 * Generates one still image per scene via Pollinations.ai - free, keyless, no billing.
 * This is the free-tier stand-in for Veo's per-scene video clip (see src/paid/veo.ts):
 * stitch.ts's animateImage() adds a pan/zoom effect so it still reads as a moving shot
 * once assembled, just without real AI-generated motion.
 */
export async function generateSceneImage(
  prompt: string,
  channel: ChannelConfig,
  outPath: string,
  maxAttempts = 4
): Promise<string> {
  const [width, height] = channel.aspectRatio === "16:9" ? [1280, 720] : [720, 1280];
  // The accuracy anchor is appended here unconditionally (not just requested in scriptGen's
  // system instruction) as a guaranteed guardrail against the free image model defaulting to
  // more heavily-represented but wrong iconography for less globally-famous subjects.
  const fullPrompt = channel.imageAccuracyAnchor
    ? `${prompt} ${channel.imageAccuracyAnchor}`
    : prompt;
  // model=flux: Pollinations' strongest free general-purpose model (best prompt-following and
  // photorealism). enhance=true: lets Pollinations expand/sharpen the prompt itself before
  // generating, on top of the already-detailed prompts scriptGen.ts writes.
  // Pollinations API: use standard encoded prompt URL
  const seed = Math.floor(Math.random() * 1000000);
  const cleanPrompt = encodeURIComponent(fullPrompt.slice(0, 500)); // cap length to prevent URL length limits

  let delayMs = 3000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // On later attempts, try without enhance or model=flux if Pollinations endpoint is busy
      const useParams = attempt <= 2 ? `?width=${width}&height=${height}&seed=${seed}&nologo=true&model=flux&enhance=false` : `?width=${width}&height=${height}&seed=${seed}&nologo=true`;
      const url = `https://pollinations.ai/p/${cleanPrompt}${useParams}`;
      const response = await fetch(url);
      const contentType = response.headers.get("content-type") || "";
      const buffer = Buffer.from(await response.arrayBuffer());

      // Validate that buffer is actually an image (JPEG, PNG, WebP) and not an HTML/JSON error page
      const isValidImage =
        (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) || // JPEG
        (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) || // PNG
        (buffer.length >= 12 && buffer.toString("ascii", 8, 12) === "WEBP"); // WebP

      if (!isValidImage) {
        throw new Error(
          `Invalid image data returned (content-type: ${contentType}, length: ${buffer.length} bytes, starts with: ${buffer.slice(0, 50).toString()})`
        );
      }

      await writeFile(outPath, buffer);
      return outPath;
    } catch (err) {
      if (attempt === maxAttempts) {
        throw new Error(
          `Image generation failed after ${maxAttempts} attempts (${err instanceof Error ? err.message : String(err)}) for prompt: "${prompt}"`
        );
      }
      console.warn(
        `Pollinations image fetch attempt ${attempt}/${maxAttempts} failed (${err instanceof Error ? err.message : String(err)}). Retrying in ${delayMs / 1000}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      delayMs *= 2;
    }
  }

  return outPath;
}

/**
 * generateSceneImage() plus an actual check that the result matches: generates the image, then
 * asks Gemini's vision model (see imageVerify.ts) whether it matches the intended context
 * (correct region/culture, face visible if a named person is central, right subject matter). If
 * it doesn't, regenerates with the reported issue folded into the prompt, up to maxAttempts
 * total. If it still doesn't pass after that, keeps the last attempt rather than blocking the
 * pipeline indefinitely on a free image model that may just not nail every prompt.
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
