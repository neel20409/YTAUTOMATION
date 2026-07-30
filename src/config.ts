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
  imageStyle: string; // visual-style directive injected into scriptGen's imagePrompt instructions
  imageAccuracyAnchor: string; // appended to every image prompt in imageGen.ts (not just the
    // system instruction) as a guaranteed guardrail against the free image model defaulting to
    // more heavily-represented but wrong iconography (e.g. rendering "ancient conqueror on a
    // throne" as Genghis Khan when the actual subject is a much less-represented figure like
    // Chanakya) - relying on the LLM to remember this in every scene isn't reliable enough alone.
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
    imageStyle:
      "Photorealistic, like a still from a big-budget historical documentary or film - natural " +
      "cinematic lighting, authentic period-correct clothing, architecture, weapons, and props for " +
      "the specific era and region depicted. Avoid anime, cartoon, illustration, or painterly styles.",
    imageAccuracyAnchor:
      "Setting: the Indian subcontinent. Every person shown must have South Asian Indian features " +
      "and skin tone, wearing historically accurate Indian clothing, jewelry, and hairstyles for the " +
      "specific era. Architecture, thrones, and objects must be Indian in style (carved sandstone or " +
      "marble, Indian motifs). Do NOT depict Mongolian, Central Asian, East Asian, Middle Eastern, " +
      "or European people, clothing, architecture, or iconography under any circumstances - this is " +
      "not Genghis Khan, not a Mongol court, not a Chinese or European palace.",
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
    imageStyle:
      "Photorealistic, like a professional travel/heritage-documentary photograph - natural " +
      "lighting (golden hour or soft daylight preferred), accurate architectural detail, and " +
      "authentic textures of stone, wood, and carving. Avoid anime, cartoon, illustration, or " +
      "painterly styles.",
    imageAccuracyAnchor:
      "Setting: the Indian subcontinent. Any people shown must have South Asian Indian features " +
      "and skin tone, in appropriate Indian dress. Architecture must be genuinely Indian heritage " +
      "architecture (temple shikhara towers, stepwells, Mughal or regional fort/palace styles, " +
      "carved sandstone or marble) - do NOT depict Mongolian, Central Asian, East Asian, Middle " +
      "Eastern, or European architecture or iconography.",
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
    imageStyle:
      "Warm, colorful children's storybook illustration - soft rounded shapes, gentle lighting, " +
      "and a friendly picture-book aesthetic suitable for young kids. Avoid photorealism.",
    imageAccuracyAnchor: "", // no real-world historical/cultural accuracy concern for this channel
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
