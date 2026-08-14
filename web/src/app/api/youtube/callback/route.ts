import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptToken, verifyState } from "@/lib/crypto";
import { createYoutubeOAuthClient } from "@/lib/youtubeOAuth";

interface OAuthState {
  userId: string;
  channelId: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const dashboardUrl = new URL("/dashboard", request.url);

  if (oauthError) {
    dashboardUrl.searchParams.set("youtube_error", oauthError);
    return NextResponse.redirect(dashboardUrl);
  }
  if (!code || !stateParam) {
    dashboardUrl.searchParams.set("youtube_error", "missing_code_or_state");
    return NextResponse.redirect(dashboardUrl);
  }

  let state: OAuthState;
  try {
    state = verifyState<OAuthState>(stateParam);
  } catch {
    dashboardUrl.searchParams.set("youtube_error", "invalid_state");
    return NextResponse.redirect(dashboardUrl);
  }

  // Defense in depth: the state param is already signed and short-lived, but also require the
  // browser completing this redirect to still be logged in as the same user that started it -
  // stops a leaked/replayed state param from being usable from a different session.
  const session = await auth();
  if (!session?.user?.id || session.user.id !== state.userId) {
    dashboardUrl.searchParams.set("youtube_error", "session_mismatch");
    return NextResponse.redirect(dashboardUrl);
  }

  const channel = await prisma.channel.findUnique({ where: { id: state.channelId } });
  if (!channel || channel.userId !== session.user.id) {
    dashboardUrl.searchParams.set("youtube_error", "channel_not_found");
    return NextResponse.redirect(dashboardUrl);
  }

  const oauth2Client = createYoutubeOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    // Happens if the user has already granted consent before and Google skips issuing a new
    // refresh_token - `prompt: "consent"` in /api/youtube/connect is specifically there to
    // avoid this, but surface it clearly if it still happens.
    dashboardUrl.searchParams.set("youtube_error", "no_refresh_token");
    return NextResponse.redirect(dashboardUrl);
  }

  const channelsRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } }
  );
  const channelsData = await channelsRes.json().catch(() => null);
  const youtubeChannelId: string | undefined = channelsData?.items?.[0]?.id;
  if (!channelsRes.ok || !youtubeChannelId) {
    dashboardUrl.searchParams.set("youtube_error", "no_youtube_channel_found");
    return NextResponse.redirect(dashboardUrl);
  }

  await prisma.youtubeConnection.upsert({
    where: { channelId: channel.id },
    create: {
      channelId: channel.id,
      youtubeChannelId,
      refreshTokenEnc: encryptToken(tokens.refresh_token),
    },
    update: {
      youtubeChannelId,
      refreshTokenEnc: encryptToken(tokens.refresh_token),
    },
  });

  dashboardUrl.searchParams.set("youtube_connected", channel.id);
  return NextResponse.redirect(dashboardUrl);
}
