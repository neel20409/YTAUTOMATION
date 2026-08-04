import { CHANNELS, type ChannelId } from "./config.js";
import { getAllTitles, countPending, addTopics } from "./topicQueue.js";
import { discoverTrendingTopics } from "./topicDiscovery.js";

const MIN_PENDING = 3; // if pending count drops to this or below, research more
const TOPUP_COUNT = 5; // how many new topics to add per top-up

async function topUpChannel(id: ChannelId) {
  const channel = CHANNELS[id];
  if (!channel) {
    throw new Error(`Unknown channel ID '${id}'. Valid options: ${Object.keys(CHANNELS).join(", ")}`);
  }
  const pending = countPending(id);
  console.log(`\n${channel.displayName} (${channel.id}): ${pending} pending topic(s)`);

  if (pending > MIN_PENDING) {
    console.log("  Queue is healthy, skipping.");
    return;
  }

  console.log(`  Researching ${TOPUP_COUNT} new topics...`);
  const existingTitles = getAllTitles(id);
  const discovered = await discoverTrendingTopics(channel, existingTitles, TOPUP_COUNT);

  addTopics(id, channel.language, discovered);
  for (const t of discovered) {
    console.log(`  + ${t.title}  (${t.rationale})`);
  }
}

async function main() {
  const envChannel = process.env.CHANNEL?.toLowerCase();
  const runAll = process.argv.includes("--all") || !envChannel || envChannel === "all";

  const channelIds: ChannelId[] = runAll
    ? (Object.keys(CHANNELS) as ChannelId[])
    : [envChannel as ChannelId];

  console.log(`\n🚀 Starting topic top-up for channel(s): ${channelIds.join(", ")}`);

  const results: { id: ChannelId; success: boolean; error?: unknown }[] = [];

  for (let idx = 0; idx < channelIds.length; idx++) {
    const id = channelIds[idx];
    if (idx > 0) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    try {
      await topUpChannel(id);
      results.push({ id, success: true });
    } catch (err) {
      console.error(`❌ Failed topic top-up for channel '${id}':`, err);
      results.push({ id, success: false, error: err });
    }
  }

  if (channelIds.length > 1) {
    console.log("\n==================================================");
    console.log("=== TOP-UP SUMMARY ===");
    console.log("==================================================");
    let failures = 0;
    for (const r of results) {
      const channel = CHANNELS[r.id];
      if (r.success) {
        console.log(`✅ ${channel?.displayName ?? r.id}: SUCCESS`);
      } else {
        failures++;
        console.log(`❌ ${channel?.displayName ?? r.id}: FAILED - ${r.error instanceof Error ? r.error.message : r.error}`);
      }
    }
    if (failures > 0) {
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error("Topic top-up failed:", err);
  process.exit(1);
});
