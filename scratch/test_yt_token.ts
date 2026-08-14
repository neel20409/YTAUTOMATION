import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

async function testYouTubeToken() {
  console.log("📡 Testing YouTube OAuth token refresh for bloop_and_boo...");

  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_CLIENT_ID,
    process.env.YOUTUBE_CLIENT_SECRET,
    process.env.YOUTUBE_REDIRECT_URI || "http://localhost:53682/callback"
  );

  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN_BLOOP_AND_BOO;
  if (!refreshToken) {
    console.error("❌ YOUTUBE_REFRESH_TOKEN_BLOOP_AND_BOO is missing!");
    return;
  }

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  try {
    const tokenResponse = await oauth2Client.getAccessToken();
    if (tokenResponse.token) {
      console.log("✅ SUCCESS: YouTube OAuth Access Token refreshed successfully!");
      console.log(`🔑 Access token preview: ${tokenResponse.token.slice(0, 15)}...`);
    } else {
      console.error("❌ Token response did not contain an access token.");
    }
  } catch (err: any) {
    console.error("❌ YouTube OAuth Token Refresh Failed:", err?.message || err);
    console.log("\n👉 Please run: CHANNEL=bloop_and_boo npm run get-youtube-token");
  }
}

testYouTubeToken();
