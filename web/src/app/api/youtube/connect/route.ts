import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { signState } from "@/lib/crypto";
import { createYoutubeOAuthClient, YOUTUBE_UPLOAD_SCOPE } from "@/lib/youtubeOAuth";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const channelId = new URL(request.url).searchParams.get("channelId");
  if (!channelId) {
    return NextResponse.json({ error: "channelId query param is required." }, { status: 400 });
  }

  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel || channel.userId !== session.user.id) {
    return NextResponse.json({ error: "Channel not found." }, { status: 404 });
  }

  const oauth2Client = createYoutubeOAuthClient();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces a refresh_token to be issued every time, same as the CLI flow
    scope: [YOUTUBE_UPLOAD_SCOPE],
    state: signState({ userId: session.user.id, channelId }),
  });

  return NextResponse.redirect(authUrl);
}
