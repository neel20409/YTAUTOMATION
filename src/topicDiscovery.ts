import { GoogleGenAI } from "@google/genai";
import { ENV, type ChannelConfig } from "./config.js";
import { withRetry } from "./retry.js";

const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEY });

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

  const research = await withRetry(() =>
    ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: researchPrompt,
      config: { tools: [{ googleSearch: {} }] },
    })
  );

  const researchText = research.text ?? "";
  if (!researchText) {
    throw new Error("Topic research returned no results - check GEMINI_API_KEY and quota");
  }

  const structuring = await withRetry(() =>
    ai.models.generateContent({
      model: "gemini-3-flash-preview",
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
