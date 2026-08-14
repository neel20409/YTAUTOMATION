import "dotenv/config";
import fs from "node:fs";

async function testGrokVideo() {
  const apiKey = process.env.GROK_API_KEY || process.env.XAI_API_KEY;
  console.log("GROK_API_KEY present:", !!apiKey);
  if (!apiKey) return;

  try {
    console.log("Sending POST to xAI video generation API...");
    const res = await fetch("https://api.x.ai/v1/videos/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-imagine-video-1.5",
        prompt: "A cute blue blob playing with wooden blocks, smooth animation",
        duration: 2,
      }),
    });

    console.log("HTTP status:", res.status, res.statusText);
    const data = await res.json();
    console.log("Response data:", JSON.stringify(data, null, 2));
  } catch (err: any) {
    console.error("Error:", err.message || err);
  }
}

testGrokVideo();
