import "dotenv/config";

export type ChannelId = "bharatkaal" | "heritage_unfolded" | "bloop_and_boo";

export interface ChannelConfig {
  id: ChannelId;
  displayName: string;
  language: string;
  aspectRatio: "16:9" | "9:16";
  piperVoice: string; // active (free tier): local Piper TTS voice model id, e.g. "en_US-lessac-medium"
  ttsVoice: string; // parked (paid tier): Gemini TTS prebuilt voice name - see src/paid/tts.ts
  isMadeForKids: boolean;
  sceneCount: number; // how many scenes to generate per video
  veoModel: string; // parked (paid tier): Veo model id - see src/paid/veo.ts
  topicNiche: string; // describes the channel's subject area, used for trending-topic research
}

export const CHANNELS: Record<ChannelId, ChannelConfig> = {
  bharatkaal: {
    id: "bharatkaal",
    displayName: "BharatKaal",
    language: "Hindi",
    aspectRatio: "16:9",
    piperVoice: "hi_IN-pratham-medium",
    ttsVoice: "Kore",
    isMadeForKids: false,
    sceneCount: 6,
    veoModel: "veo-3.1-generate-preview",
    topicNiche:
      "Indian history for a Hindi-speaking audience - ancient and medieval Indian empires, rulers, battles, and turning points",
  },
  heritage_unfolded: {
    id: "heritage_unfolded",
    displayName: "Heritage Unfolded",
    language: "English",
    aspectRatio: "16:9",
    piperVoice: "en_US-lessac-medium",
    ttsVoice: "Charon",
    isMadeForKids: false,
    sceneCount: 6,
    veoModel: "veo-3.1-generate-preview",
    topicNiche:
      "Indian heritage and architecture for an English-speaking global audience - temples, forts, stepwells, and archaeological discoveries",
  },
  bloop_and_boo: {
    id: "bloop_and_boo",
    displayName: "Bloop and Boo",
    language: "English",
    aspectRatio: "9:16",
    piperVoice: "en_US-amy-medium",
    ttsVoice: "Puck",
    isMadeForKids: false, // kept false deliberately - see README on monetization framing
    sceneCount: 4,
    veoModel: "veo-3.1-fast-generate-preview",
    topicNiche:
      "Wholesome children's stories in English about kindness, sharing, and everyday life lessons for young kids",
  },
};

export const ENV = {
  GEMINI_API_KEY: requireEnv("GEMINI_API_KEY"),
  YOUTUBE_CLIENT_ID: process.env.YOUTUBE_CLIENT_ID ?? "",
  YOUTUBE_CLIENT_SECRET: process.env.YOUTUBE_CLIENT_SECRET ?? "",
  YOUTUBE_REDIRECT_URI: process.env.YOUTUBE_REDIRECT_URI ?? "http://localhost:53682/callback",
  CHANNEL: (process.env.CHANNEL ?? "bharatkaal") as ChannelId,
  // Local Piper TTS binary + voice model folder (see README "Free-tier setup").
  PIPER_PATH: process.env.PIPER_PATH ?? "piper",
  PIPER_VOICES_DIR: process.env.PIPER_VOICES_DIR ?? "voices",
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * All four channels used to share one Google account's YouTube OAuth grant, but each
 * channel is a separate brand account under that login - YouTube's consent screen makes
 * you pick one specific channel per authorization, so each channel needs its own
 * refresh token rather than one shared YOUTUBE_REFRESH_TOKEN.
 */
export function refreshTokenEnvVar(channel: ChannelId): string {
  return `YOUTUBE_REFRESH_TOKEN_${channel.toUpperCase()}`;
}

export function getYoutubeRefreshToken(channel: ChannelId): string {
  return requireEnv(refreshTokenEnvVar(channel));
}
