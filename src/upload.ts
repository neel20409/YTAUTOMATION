import { google } from "googleapis";
import { createReadStream } from "node:fs";
import { ENV, getYoutubeRefreshToken, type ChannelConfig } from "./config.js";

function getAuthClient(channel: ChannelConfig) {
  const oauth2Client = new google.auth.OAuth2(
    ENV.YOUTUBE_CLIENT_ID,
    ENV.YOUTUBE_CLIENT_SECRET,
    ENV.YOUTUBE_REDIRECT_URI
  );
  oauth2Client.setCredentials({ refresh_token: getYoutubeRefreshToken(channel.id) });
  return oauth2Client;
}

export interface UploadResult {
  videoId: string;
  url: string;
}

export async function uploadToYouTube(
  filePath: string,
  title: string,
  description: string,
  channel: ChannelConfig
): Promise<UploadResult> {
  const auth = getAuthClient(channel);
  const youtube = google.youtube({ version: "v3", auth });

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title,
        description,
        categoryId: "27", // Education
        defaultLanguage: languageCode(channel.language),
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: channel.isMadeForKids,
      },
    },
    media: {
      body: createReadStream(filePath),
    },
  });

  const videoId = res.data.id;
  if (!videoId) throw new Error("YouTube upload succeeded but returned no video id");

  return { videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
}

function languageCode(language: string): string {
  const map: Record<string, string> = {
    Hindi: "hi",
    English: "en",
    Gujarati: "gu",
  };
  return map[language] ?? "en";
}
