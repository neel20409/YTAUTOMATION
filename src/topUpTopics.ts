import { CHANNELS, type ChannelId } from "./config.js";
import { getAllTitles, countPending, addTopics } from "./topicQueue.js";
import { discoverTrendingTopics } from "./topicDiscovery.js";

const MIN_PENDING = 3; // if pending count drops to this or below, research more
const TOPUP_COUNT = 5; // how many new topics to add per top-up

async function main() {
  const onlyChannel = process.env.CHANNEL as ChannelId | undefined;
  const channelIds = onlyChannel ? [onlyChannel] : (Object.keys(CHANNELS) as ChannelId[]);

  for (const id of channelIds) {
    const channel = CHANNELS[id];
    const pending = countPending(id);
    console.log(`${channel.displayName}: ${pending} pending topic(s)`);

    if (pending > MIN_PENDING) {
      console.log("  Queue is healthy, skipping.");
      continue;
    }

    console.log(`  Researching ${TOPUP_COUNT} new topics...`);
    const existingTitles = getAllTitles(id);
    const discovered = await discoverTrendingTopics(channel, existingTitles, TOPUP_COUNT);

    addTopics(id, channel.language, discovered);
    for (const t of discovered) {
      console.log(`  + ${t.title}  (${t.rationale})`);
    }
  }
}

main().catch((err) => {
  console.error("Topic top-up failed:", err);
  process.exit(1);
});
