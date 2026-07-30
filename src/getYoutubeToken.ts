// Run this ONCE per channel locally (not in CI) to get that channel's refresh token:
//   CHANNEL=bharatkaal npm run get-youtube-token
// Each of the three channels is a separate brand account under the same Google login,
// and YouTube's consent screen makes you pick one specific channel per authorization -
// so this must be run once per channel, each producing its own refresh token. Copy the
// printed refresh token into your .env and into your GitHub Actions secret.

import "dotenv/config";
import { google } from "googleapis";
import http from "node:http";
import open from "open";
import { CHANNELS, refreshTokenEnvVar, type ChannelId } from "./config.js";

const CLIENT_ID = process.env.YOUTUBE_CLIENT_ID!;
const CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET!;
const REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI ?? "http://localhost:53682/callback";

const channelId = process.env.CHANNEL as ChannelId | undefined;
if (!channelId || !(channelId in CHANNELS)) {
  console.error(
    `Set CHANNEL to one of: ${Object.keys(CHANNELS).join(", ")}\n` +
      `Example: CHANNEL=bharatkaal npm run get-youtube-token`
  );
  process.exit(1);
}
const channel = CHANNELS[channelId];

async function main() {
  const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces a refresh_token to be issued every time
    scope: ["https://www.googleapis.com/auth/youtube.upload"],
  });

  const server = http.createServer(async (req, res) => {
    if (!req.url?.startsWith("/callback")) return;
    const url = new URL(req.url, REDIRECT_URI);
    const code = url.searchParams.get("code");

    res.end("Authenticated. You can close this tab and return to the terminal.");
    server.close();

    if (!code) {
      console.error("No authorization code received.");
      return;
    }

    const { tokens } = await oauth2Client.getToken(code);
    console.log(`\n${refreshTokenEnvVar(channel.id)}=${tokens.refresh_token}`);
    console.log("\nCopy this into your .env file and your GitHub Actions secrets.");
  });

  server.listen(53682, () => {
    console.log(
      `Opening browser for YouTube authorization - sign in with the account that manages "${channel.displayName}" and pick that channel when prompted...`
    );
    open(authUrl);
  });
}

main();
