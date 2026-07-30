// Throwaway check: confirms verifyImageMatchesContext() correctly distinguishes a matching
// image from a mismatched one (using two images already generated in this out/ folder).
//
// Run: npx tsx manual-tests/test-image-verify.ts

import path from "node:path";
import { verifyImageMatchesContext } from "../src/imageVerify.js";

async function main() {
  const outDir = path.resolve("manual-tests/out");

  const correctPrompt =
    "Three-quarter shot of Emperor Chandragupta Maurya, an Indian Mauryan-era king, sitting on " +
    "an ornate Indian throne of dark wood and gold, wearing a pleated dhoti and gold jewelry, " +
    "with his face clearly visible and a regal, serene expression.";

  console.log("Checking a real matching image (should pass)...");
  const verdictMatch = await verifyImageMatchesContext(
    path.join(outDir, "test-image-quality.jpg"),
    correctPrompt
  );
  console.log(JSON.stringify(verdictMatch, null, 2));

  console.log("\nChecking a deliberately mismatched image (a cartoon rabbit, should fail)...");
  const verdictMismatch = await verifyImageMatchesContext(
    path.join(outDir, "test-scene.jpg"),
    correctPrompt
  );
  console.log(JSON.stringify(verdictMismatch, null, 2));
}

main().catch((err) => {
  console.error("test-image-verify failed:", err);
  process.exit(1);
});
