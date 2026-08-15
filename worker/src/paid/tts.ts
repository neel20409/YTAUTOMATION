import { GoogleGenAI } from "@google/genai";
import { FileWriter } from "wav";
import type { ChannelConfig } from "../channelConfig.js";
import { getGeminiApiKey } from "../retry.js";

// Tries the higher-quality paid TTS model first, falls back to a flash-tier TTS model that has
// real free-tier access if it fails - most importantly before billing is enabled on the Google
// Cloud project (the primary model has zero free-tier quota).
const TTS_MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-3.1-flash-tts-preview";
const TTS_MODEL_FALLBACK = process.env.GEMINI_TTS_MODEL_FALLBACK ?? "gemini-2.5-flash-preview-tts";

async function synthesize(model: string, narration: string, channel: ChannelConfig): Promise<Buffer> {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });
  const response = await ai.models.generateContent({
    model,
    contents: narration,
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: channel.ttsVoice } },
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  const base64Data = part?.inlineData?.data;
  if (!base64Data) throw new Error("TTS response contained no audio data");
  return Buffer.from(base64Data, "base64");
}

export async function generateVoiceover(
  narration: string,
  channel: ChannelConfig,
  outPath: string
): Promise<string> {
  let pcm: Buffer;
  try {
    pcm = await synthesize(TTS_MODEL, narration, channel);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️ [TTS] ${TTS_MODEL} failed (${message}). Falling back to ${TTS_MODEL_FALLBACK}...`);
    pcm = await synthesize(TTS_MODEL_FALLBACK, narration, channel);
  }

  await saveWavFile(outPath, pcm);
  return outPath;
}

function saveWavFile(
  filename: string,
  pcmData: Buffer,
  channels = 1,
  sampleRate = 24000,
  sampleWidth = 2
): Promise<void> {
  return new Promise((resolve, reject) => {
    const writer = new FileWriter(filename, {
      channels,
      sampleRate,
      bitDepth: sampleWidth * 8,
    });
    writer.on("finish", resolve);
    writer.on("error", reject);
    writer.write(pcmData);
    writer.end();
  });
}
