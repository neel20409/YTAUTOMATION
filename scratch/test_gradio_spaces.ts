import { Client } from "@gradio/client";
import fs from "node:fs";

async function testGradioSpaces() {
  const hfToken = process.env.HF_TOKEN;
  console.log("HF Token present:", !!hfToken);

  const spaces = [
    "multimodalart/stable-video-diffusion",
    "fffiloni/Wan2.1-I2V-14B-480P",
    "Kijai/WanVideo",
  ];

  for (const space of spaces) {
    console.log(`\nTesting Gradio Space: ${space}`);
    try {
      const client = await Client.connect(space, hfToken ? ({ token: hfToken } as any) : undefined);
      console.log(`✅ Connected successfully to space: ${space}`);
    } catch (e: any) {
      console.log(`❌ Connection failed for ${space}:`, e.message || e);
    }
  }
}

testGradioSpaces();
