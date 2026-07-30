// PARKED - the paid upgrade path. Not imported anywhere right now because Gemini TTS has
// no free tier ($20/1M output tokens, billing required for any call to succeed).
// The active free-tier pipeline uses ../tts.ts (local Piper TTS) instead.
//
// To switch back once billing is enabled: in src/index.ts, import generateVoiceover from
// this file instead of ../tts.ts, and use channel.ttsVoice (Gemini prebuilt voice name)
// instead of channel.piperVoice.

import { GoogleGenAI } from "@google/genai";
import { FileWriter } from "wav";
import { ENV, type ChannelConfig } from "../config.js";

const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });

// Current Gemini TTS model as of mid-2026. If Google renames/deprecates this,
// swap the string here - everything else in the pipeline stays the same.
const TTS_MODEL = "gemini-3.1-flash-tts-preview";

/**
 * Generates a WAV voiceover file for one scene's narration text.
 * Returns the path to the saved .wav file.
 */
export async function generateVoiceover(
  narration: string,
  channel: ChannelConfig,
  outPath: string
): Promise<string> {
  const response = await ai.models.generateContent({
    model: TTS_MODEL,
    contents: narration,
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: channel.ttsVoice },
        },
      },
    },
  });

  const part = response.candidates?.[0]?.content?.parts?.[0];
  const base64Data = part?.inlineData?.data;
  if (!base64Data) throw new Error("TTS response contained no audio data");

  const pcm = Buffer.from(base64Data, "base64");
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
