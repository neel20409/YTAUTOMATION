import { GoogleGenAI } from "@google/genai";
import "dotenv/config";

const apiKey = process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY;
console.log("Testing API Key starting with:", apiKey?.substring(0, 10));

const ai = new GoogleGenAI({ apiKey });

async function testModel(modelName: string) {
  try {
    const res = await ai.models.generateContent({
      model: modelName,
      contents: "Hello, say hi!",
    });
    console.log(`✅ Model '${modelName}' SUCCESS:`, res.text?.trim());
  } catch (err: any) {
    console.log(`❌ Model '${modelName}' FAILED:`, err.message || err);
  }
}

async function main() {
  await testModel("gemini-2.5-flash");
  await testModel("gemini-2.0-flash");
  await testModel("gemini-1.5-flash");
  await testModel("gemini-3-flash-preview");
}

main();
