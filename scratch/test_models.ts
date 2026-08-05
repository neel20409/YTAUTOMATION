import { GoogleGenAI } from "@google/genai";
import "dotenv/config";
import { ENV } from "../src/config.js";

async function main() {
  console.log("Keys available:", ENV.GEMINI_API_KEYS.length);
  const ai = new GoogleGenAI({ apiKey: ENV.GEMINI_API_KEYS[0] });

  try {
    const res = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: "Say hello",
    });
    console.log("✅ Basic generateContent:", res.text?.trim());
  } catch (err: any) {
    console.error("❌ Basic generateContent failed:", err.message);
  }

  try {
    const res2 = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: "List 2 topics",
      config: { responseMimeType: "application/json" },
    });
    console.log("✅ JSON mode generateContent:", res2.text?.trim());
  } catch (err: any) {
    console.error("❌ JSON mode failed:", err.message);
  }
}

main();
