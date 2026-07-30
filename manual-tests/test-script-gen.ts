// Throwaway Phase 1 check: confirms generateScript() returns valid JSON with the
// expected scene count for one topic. Costs one Gemini text call, no video/audio.
//
// Run: npx tsx manual-tests/test-script-gen.ts

import { CHANNELS } from "../src/config.js";
import { generateScript } from "../src/scriptGen.js";

async function main() {
  const channel = CHANNELS.bharatkaal;
  const script = await generateScript("The Rise of Chandragupta Maurya", channel);

  console.log(JSON.stringify(script, null, 2));
  console.log(`\nScenes returned: ${script.scenes.length} (expected: ${channel.sceneCount})`);
  if (script.scenes.length !== channel.sceneCount) {
    console.warn("MISMATCH: scene count does not match channel config.");
  }
}

main().catch((err) => {
  console.error("test-script-gen failed:", err);
  process.exit(1);
});
