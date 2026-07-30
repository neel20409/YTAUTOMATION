import { spawn } from "node:child_process";
import path from "node:path";
import { ENV, type ChannelConfig } from "./config.js";

/**
 * Generates a WAV voiceover file for one scene's narration text using Piper TTS - a free,
 * open-source, fully offline engine. No API key, no billing, no per-request cost.
 * Requires the `piper` binary (ENV.PIPER_PATH) and a matching voice model file at
 * `${ENV.PIPER_VOICES_DIR}/${channel.piperVoice}.onnx` (see README "Free-tier setup").
 */
export async function generateVoiceover(
  narration: string,
  channel: ChannelConfig,
  outPath: string
): Promise<string> {
  const modelPath = path.resolve(ENV.PIPER_VOICES_DIR, `${channel.piperVoice}.onnx`);

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ENV.PIPER_PATH, ["--model", modelPath, "--output_file", outPath]);

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("error", (err) => {
      reject(new Error(`Failed to run piper (${ENV.PIPER_PATH}): ${err.message}`));
    });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`piper exited with code ${code} for voice "${channel.piperVoice}": ${stderr}`));
    });

    proc.stdin.write(narration);
    proc.stdin.end();
  });

  return outPath;
}
