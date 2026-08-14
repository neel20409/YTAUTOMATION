import { google } from "googleapis";
import { createReadStream } from "node:fs";

// Adapted from video-pipeline/src/upload.ts: getAuthClient there read one of three
// process.env.YOUTUBE_REFRESH_TOKEN_<CHANNEL> vars. Here every channel's refresh token lives
// encrypted in the YoutubeConnection table (see web/src/app/api/youtube/callback/route.ts for
// how it got there), so it's passed in already-decrypted rather than read from env - but it
// must have been issued against the same YOUTUBE_CLIENT_ID/SECRET OAuth client as web/ uses for
// the connect flow, since a refresh token is only valid for the client it was granted to.

function getAuthClient(refreshToken: string) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET must be set.");
  }
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
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
  language: string,
  isMadeForKids: boolean,
  refreshToken: string
): Promise<UploadResult> {
  const auth = getAuthClient(refreshToken);
  const youtube = google.youtube({ version: "v3", auth });

  const res = await youtube.videos.insert({
    part: ["snippet", "status"],
    requestBody: {
      snippet: {
        title,
        description,
        categoryId: "27", // Education
        defaultLanguage: languageCode(language),
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: isMadeForKids,
      },
    },
    media: { body: createReadStream(filePath) },
  });

  const videoId = res.data.id;
  if (!videoId) throw new Error("YouTube upload succeeded but returned no video id");

  return { videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
}

export async function uploadThumbnail(
  videoId: string,
  thumbnailPath: string,
  refreshToken: string
): Promise<void> {
  const auth = getAuthClient(refreshToken);
  const youtube = google.youtube({ version: "v3", auth });
  await youtube.thumbnails.set({ videoId, media: { body: createReadStream(thumbnailPath) } });
}

function languageCode(language: string): string {
  const map: Record<string, string> = { Hindi: "hi", English: "en", Gujarati: "gu" };
  return map[language] ?? "en";
}
