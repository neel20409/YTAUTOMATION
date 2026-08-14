import type { Channel } from "./generated/prisma/client.js";

// Same shape as video-pipeline/src/config.ts's ChannelConfig - the ported script/image/video
// generation modules all take this shape, so a DB-backed Channel row just needs mapping into it
// instead of coming from a hardcoded map.
export interface ChannelConfig {
  id: string;
  displayName: string;
  language: string;
  aspectRatio: "16:9" | "9:16";
  sceneCount: number;
  veoModel: string;
  ttsVoice: string;
  topicNiche: string;
  imageStyle: string;
  imageAccuracyAnchor: string;
  isMadeForKids: boolean;
}

export function toChannelConfig(channel: Channel): ChannelConfig {
  return {
    id: channel.id,
    displayName: channel.displayName,
    language: channel.language,
    aspectRatio: channel.aspectRatio === "WIDE" ? "16:9" : "9:16",
    sceneCount: channel.sceneCount,
    veoModel: channel.veoModel,
    ttsVoice: channel.ttsVoice,
    topicNiche: channel.topicNiche,
    imageStyle: channel.imageStyle,
    imageAccuracyAnchor: channel.imageAccuracyAnchor,
    isMadeForKids: channel.isMadeForKids,
  };
}
