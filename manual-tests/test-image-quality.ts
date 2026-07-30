// Throwaway check: generates one real scene image using the new richer, style-directed
// prompt + flux model, to visually confirm the "photorealistic, historically accurate,
// face clearly visible" style direction is actually landing.
//
// Run: npx tsx manual-tests/test-image-quality.ts

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { CHANNELS } from "../src/config.js";
import { generateSceneImage } from "../src/imageGen.js";

async function main() {
  const outDir = path.resolve("manual-tests/out");
  await mkdir(outDir, { recursive: true });

  const prompt =
    "Three-quarter shot of Emperor Chandragupta Maurya sitting on an ornate throne of dark " +
    "wood and gold. He is dressed in royal finery: a pleated silk dhoti, a gold-bordered " +
    "angavastra, and heavy gold armlets and a chest necklace embedded with gems. He wears a " +
    "simple yet elegant gold headband across his forehead. His expression is regal and serene, " +
    "reflecting his status as a Samrat. The grand hall behind him is filled with the scent of " +
    "incense and warm sunlight streaming through high carved windows. Photorealistic, authentic " +
    "Mauryan royal aesthetic. " + CHANNELS.bharatkaal.imageStyle;

  const outPath = path.join(outDir, "test-image-quality.jpg");
  await generateSceneImage(prompt, CHANNELS.bharatkaal, outPath);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error("test-image-quality failed:", err);
  process.exit(1);
});
