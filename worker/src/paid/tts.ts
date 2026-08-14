import { GoogleGenAI } from "@google/genai";
import { FileWriter } from "wav";
import type { ChannelConfig } from "../channelConfig.js";
import { getGeminiApiKey } from "../retry.js";

// Ported from video-pipeline/src/paid/tts.ts, which was parked specifically for this switch.
const TTS_MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-3.1-flash-tts-preview";

export async function generateVoiceover(
  narration: string,
  channel: ChannelConfig,
  outPath: string
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey() });

  const response = await ai.models.generateContent({
    model: TTS_MODEL,
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
