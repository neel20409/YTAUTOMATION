import { Client } from "@gradio/client";
import "dotenv/config";

async function testSpaces() {
  const hfToken = process.env.HF_TOKEN;
  console.log("HF_TOKEN present:", !!hfToken);

  const spaces = [
    "multimodalart/stable-video-diffusion",
    "multimodalart/wan2-1-fast",
  ];

  for (const space of spaces) {
    console.log(`\nTesting Space: ${space}`);
    try {
      const client = await Client.connect(
        space,
        hfToken ? ({ token: hfToken } as any) : undefined
      );
      console.log(`✅ Client connected to ${space}!`);
    } catch (err: any) {
      console.log(`❌ Failed to connect to ${space}:`, err.message || err);
    }
  }
}

testSpaces();
