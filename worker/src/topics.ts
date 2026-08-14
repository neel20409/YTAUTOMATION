import { prisma } from "./db.js";

// DB-backed replacement for video-pipeline/src/topicQueue.ts's data/topics.json file - same
// operations, one row per topic instead of one JSON array per hardcoded channel.

export async function getNextPendingTopic(channelId: string) {
  return prisma.topic.findFirst({
    where: { channelId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });
}

export async function markTopicDone(topicId: string): Promise<void> {
  await prisma.topic.update({ where: { id: topicId }, data: { status: "DONE" } });
}

export async function addTopics(channelId: string, titles: string[]): Promise<void> {
  await prisma.topic.createMany({
    data: titles.map((title) => ({ channelId, title, status: "PENDING" as const })),
  });
}
