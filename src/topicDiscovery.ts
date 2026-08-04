import { GoogleGenAI } from "@google/genai";
import { ENV, type ChannelConfig } from "./config.js";
import { withRetry, getActiveGeminiApiKey } from "./retry.js";

function getAiClient() {
  return new GoogleGenAI({ apiKey: getActiveGeminiApiKey() });
}

export interface DiscoveredTopic {
  title: string;
  rationale: string;
}

/**
 * Two-step topic discovery:
 * 1. A grounded call (Google Search tool) researches what's currently relevant/trending
 *    for this channel's niche - recent news, anniversaries, rediscoveries, rising interest.
 * 2. A plain call turns that research into a strict JSON topic list, explicitly avoiding
 *    anything overlapping with titles already in the queue (pending or done).
 *
 * Split into two calls because grounding (tools) and strict JSON mode don't combine
 * reliably on every model version - safer to research first, then structure separately.
 */
export async function discoverTrendingTopics(
  channel: ChannelConfig,
  existingTitles: string[],
  count = 5
): Promise<DiscoveredTopic[]> {
  const researchPrompt = `Search for currently relevant or trending topics related to: ${channel.topicNiche}.
Look for: recent news mentioning relevant places/figures, upcoming anniversaries or festivals,
new discoveries, or subjects with rising public/search interest in the last 30 days.
List what you find, each with a one-line note on why it's timely right now.`;

  let researchText = "";
  try {
    const research = await withRetry(() =>
      getAiClient().models.generateContent({
        model: ENV.GEMINI_MODEL,
        contents: researchPrompt,
        config: { tools: [{ googleSearch: {} }] },
      })
    );
    researchText = research.text ?? "";
  } catch (err) {
    console.warn(`[Topic Discovery] Grounded search hit rate limit (${(err as Error).message}). Falling back to direct model knowledge...`);
    researchText = `Popular and trending subjects for ${channel.topicNiche}`;
  }

  if (!researchText) {
    researchText = `Popular and trending subjects for ${channel.topicNiche}`;
  }

  const structuring = await withRetry(() =>
    getAiClient().models.generateContent({
      model: ENV.GEMINI_MODEL,
      contents: `Based on this research:

${researchText}

Pick the best ${count} video topic ideas for the YouTube channel "${channel.displayName}" (${channel.topicNiche}).

Do NOT repeat or closely overlap with any of these existing titles:
${existingTitles.map((t) => `- ${t}`).join("\n") || "(none yet)"}

Output ONLY valid JSON, no markdown fences:
{ "topics": [ { "title": string, "rationale": string (one sentence, why this is timely) } ] }`,
      config: { responseMimeType: "application/json" },
    })
  );

  const text = structuring.text;
  if (!text) throw new Error("Topic structuring returned empty response");

  const parsed = JSON.parse(text) as { topics: DiscoveredTopic[] };
  return parsed.topics;
}
