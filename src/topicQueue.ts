import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ChannelId } from "./config.js";

const TOPICS_PATH = path.resolve("data/topics.json");

export interface Topic {
  id: string;
  title: string;
  language: string;
  status: "pending" | "done";
}

type TopicsFile = Record<ChannelId, Topic[]>;

export function getNextTopic(channel: ChannelId): Topic {
  const topics = readTopics();
  const next = topics[channel]?.find((t) => t.status === "pending");
  if (!next) {
    throw new Error(
      `No pending topics left for channel "${channel}". Add more entries to data/topics.json.`
    );
  }
  return next;
}

export function markTopicDone(channel: ChannelId, topicId: string): void {
  const topics = readTopics();
  const topic = topics[channel]?.find((t) => t.id === topicId);
  if (topic) {
    topic.status = "done";
    writeFileSync(TOPICS_PATH, JSON.stringify(topics, null, 2));
  }
}

/** All titles (pending + done) for a channel, used to avoid suggesting duplicates. */
export function getAllTitles(channel: ChannelId): string[] {
  const topics = readTopics();
  return (topics[channel] ?? []).map((t) => t.title);
}

export function countPending(channel: ChannelId): number {
  const topics = readTopics();
  return (topics[channel] ?? []).filter((t) => t.status === "pending").length;
}

/** Appends newly discovered topics to the queue with auto-generated ids. */
export function addTopics(
  channel: ChannelId,
  language: string,
  newTopics: { title: string }[]
): void {
  const topics = readTopics();
  if (!topics[channel]) topics[channel] = [];

  const list = topics[channel];
  const existingIds = new Set(list.map((t) => t.id));
  const prefix = channel.slice(0, 2);
  let n = list.length + 1;

  for (const nt of newTopics) {
    let id = `${prefix}-${String(n).padStart(3, "0")}`;
    while (existingIds.has(id)) {
      n++;
      id = `${prefix}-${String(n).padStart(3, "0")}`;
    }
    list.push({ id, title: nt.title, language, status: "pending" });
    existingIds.add(id);
    n++;
  }

  writeFileSync(TOPICS_PATH, JSON.stringify(topics, null, 2));
}

function readTopics(): TopicsFile {
  return JSON.parse(readFileSync(TOPICS_PATH, "utf-8"));
}
