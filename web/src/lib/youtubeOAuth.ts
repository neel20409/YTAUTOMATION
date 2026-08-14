import { OAuth2Client } from "google-auth-library";

/**
 * Each Channel is its own YouTube brand account, so - same constraint as the single-operator
 * video-pipeline/src/getYoutubeToken.ts - every channel needs its own OAuth grant/refresh token;
 * there's no single grant that covers multiple channels.
 */
export function createYoutubeOAuthClient(): OAuth2Client {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REDIRECT_URI must be set.");
  }
  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

export const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
