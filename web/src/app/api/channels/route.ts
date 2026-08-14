import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const {
    displayName,
    language,
    aspectRatio,
    sceneCount,
    topicNiche,
    imageStyle,
    imageAccuracyAnchor,
    ttsVoice,
  } = body ?? {};

  if (
    typeof displayName !== "string" || !displayName.trim() ||
    typeof language !== "string" || !language.trim() ||
    (aspectRatio !== "WIDE" && aspectRatio !== "TALL") ||
    typeof topicNiche !== "string" || !topicNiche.trim() ||
    typeof imageStyle !== "string" || !imageStyle.trim() ||
    typeof imageAccuracyAnchor !== "string" || !imageAccuracyAnchor.trim() ||
    typeof ttsVoice !== "string" || !ttsVoice.trim()
  ) {
    return NextResponse.json({ error: "Missing or invalid channel fields." }, { status: 400 });
  }

  const channel = await prisma.channel.create({
    data: {
      userId: session.user.id,
      displayName: displayName.trim(),
      language: language.trim(),
      aspectRatio,
      sceneCount: Number.isFinite(sceneCount) && sceneCount > 0 ? Math.round(sceneCount) : 6,
      topicNiche: topicNiche.trim(),
      imageStyle: imageStyle.trim(),
      imageAccuracyAnchor: imageAccuracyAnchor.trim(),
      ttsVoice: ttsVoice.trim(),
    },
    select: { id: true },
  });

  return NextResponse.json({ channel });
}
