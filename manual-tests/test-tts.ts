// Throwaway Phase 1 check: confirms generateVoiceover() writes a playable .wav
// for the channel's configured voice. Costs one Gemini TTS call.
//
// Run: npx tsx manual-tests/test-tts.ts
// Then play manual-tests/out/test-voice.wav and confirm it sounds right.

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { CHANNELS } from "../src/config.js";
import { generateVoiceover } from "../src/tts.js";

async function main() {
  const channel = CHANNELS.bharatkaal;
  const outDir = path.resolve("manual-tests/out");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "test-voice.wav");

  await generateVoiceover(
    "यह एक परीक्षण वाक्य है, यह जांचने के लिए कि आवाज़ सही लग रही है या नहीं।",
    channel,
    outPath
  );

  console.log(`Wrote voiceover to ${outPath} - play it and confirm voice "${channel.ttsVoice}" sounds right.`);
}

main().catch((err) => {
  console.error("test-tts failed:", err);
  process.exit(1);
});
