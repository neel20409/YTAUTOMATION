import path from "node:path";
import { CHANNELS } from "../config.js";

export type CharacterId = "bloop" | "boo";

export interface CharacterConfig {
  id: CharacterId;
  displayName: string;
  personality: string; // used in script-gen prompt
  piperVoice: string;
  closedMouthImage: string;
  openMouthImage: string;
}

const CHARACTERS_DIR = path.resolve("shorts/characters");

export const CHARACTERS: Record<CharacterId, CharacterConfig> = {
  bloop: {
    id: "bloop",
    displayName: "Bloop",
    personality: "a cheerful, energetic blue blob who loves adventure and gets excited easily",
    piperVoice: "en_US-amy-medium",
    closedMouthImage: path.join(CHARACTERS_DIR, "bloop_transparent.png"),
    openMouthImage: path.join(CHARACTERS_DIR, "bloop_mouth_open.png"),
  },
  boo: {
    id: "boo",
    displayName: "Boo",
    personality: "a sweet, gentle pink ghost who is thoughtful and a little shy, but caring",
    piperVoice: "en_US-lessac-medium",
    closedMouthImage: path.join(CHARACTERS_DIR, "boo_transparent.png"),
    openMouthImage: path.join(CHARACTERS_DIR, "boo_mouth_open.png"),
  },
};

// Shorts reuse the Bloop and Boo YouTube channel's vertical aspect ratio.
export const SHORTS_ASPECT_RATIO = CHANNELS.bloop_and_boo.aspectRatio;
